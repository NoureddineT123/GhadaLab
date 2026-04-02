import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DndContext, useDraggable, useDroppable, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { updatePlayerProgress, subscribeToPlayer, subscribeToSession, subscribeToPlayers } from '../../lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { SessionPlayer } from '../../types';

// ── Rhyming Pairs Data ──
interface RhymingPair {
  id: string;
  lineA: string;        // first line (always visible)
  lineB: string;        // second/rhyming line (gets shuffled)
  lang: 'en' | 'ar';
}

const RHYMING_PAIRS: RhymingPair[] = [
  { id: 'p1',  lineA: 'Hickory, dickory, dock',                                   lineB: 'The mouse ran up the clock',                                 lang: 'en' },
  { id: 'p2',  lineA: 'Three, four',                                               lineB: 'Open on the door',                                           lang: 'en' },
  { id: 'p3',  lineA: 'He put her in a pumpkin shell',                             lineB: 'And there he kept her very well',                             lang: 'en' },
  { id: 'p4',  lineA: "We'll catch a little fox,",                                 lineB: 'And put him in a box',                                        lang: 'en' },
  { id: 'p5',  lineA: 'Rain, rain, go away,',                                      lineB: 'Come again another day',                                      lang: 'en' },
  { id: 'p6',  lineA: 'Out came the sun and dried up all the rain',                lineB: 'and the Itsy Bitsy spider went up the spout again!',          lang: 'en' },
  { id: 'p7',  lineA: 'يَوم ويَومين وجمعة .. وشَهر وشَهرين',                        lineB: 'تعبِتْ بِعَيني الدمعة .. وِين غايب وَينْ',                      lang: 'ar' },
  { id: 'p8',  lineA: 'يارا الـ غفي عَ زندها خيّا الزغير',                           lineB: 'وضلّت تغنّي والدني حدّا تطير',                                 lang: 'ar' },
  { id: 'p9',  lineA: 'بتطلّْ بتلُوحْ والقلبْ مجروحْ',                               lineB: 'وأيّامْ عالبالْ بتعنّْ وتروحْ',                                 lang: 'ar' },
  { id: 'p10', lineA: 'وبكرا بتشتّي الدّني عَالقصص المجرّحة',                        lineB: 'بيبقى إسمك يا حبيبي وإسمي بينمحى',                             lang: 'ar' },
  { id: 'p11', lineA: 'لأجلك يا بهيّة المساكِن',                                     lineB: 'يا زهرة المدائن',                                               lang: 'ar' },
  { id: 'p12', lineA: 'احكيلي احكيلي عن بلدي احكيلي',                                lineB: 'يا نسيم اللّي مارق عَ الشّجر مقابيلي',                          lang: 'ar' },
];

// Fisher-Yates shuffle
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Sound ──
const playSound = (type: 'pop' | 'ding' | 'buzz' | 'fanfare') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    if (type === 'pop') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'ding') {
      osc.type = 'triangle'; osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
      g.gain.setValueAtTime(0.4, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'buzz') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.2);
      g.gain.setValueAtTime(0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'fanfare') {
      [523, 659, 784, 1047].forEach((freq, i) => {
        const o = ctx.createOscillator(); const gn = ctx.createGain();
        o.connect(gn); gn.connect(ctx.destination); o.type = 'triangle';
        o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
        gn.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
        gn.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.4);
        o.start(ctx.currentTime + i * 0.15); o.stop(ctx.currentTime + i * 0.15 + 0.4);
      });
    }
  } catch { /* skip */ }
};

// ── Persistence helpers ──
const STORAGE_KEY = (sessionId: string) => `edu_rhyme_state_${sessionId}`;
const SHUFFLE_KEY = (sessionId: string) => `edu_rhyme_shuffle_${sessionId}`;

// matches[pairId] = lineBPairId (which lineB is assigned to this slot)
type MatchMap = Record<string, string | null>;

function saveGameState(sessionId: string, matches: MatchMap, submitted: boolean, score: number) {
  localStorage.setItem(STORAGE_KEY(sessionId), JSON.stringify({ matches, submitted, score }));
}

function loadGameState(sessionId: string): { matches: MatchMap; submitted: boolean; score: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(sessionId));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function getShuffledLineBOrder(sessionId: string): RhymingPair[] {
  try {
    const raw = localStorage.getItem(SHUFFLE_KEY(sessionId));
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      return ids.map(id => RHYMING_PAIRS.find(p => p.id === id)!).filter(Boolean);
    }
  } catch { /* ignore */ }
  const shuffled = shuffleArray(RHYMING_PAIRS);
  localStorage.setItem(SHUFFLE_KEY(sessionId), JSON.stringify(shuffled.map(p => p.id)));
  return shuffled;
}

// ── Color Palette per pair ──
const PAIR_COLORS = [
  { bg: 'rgba(99,102,241,0.10)',  border: 'rgba(99,102,241,0.25)',  text: '#a5b4fc' },
  { bg: 'rgba(244,114,182,0.10)', border: 'rgba(244,114,182,0.25)', text: '#f9a8d4' },
  { bg: 'rgba(52,211,153,0.10)',  border: 'rgba(52,211,153,0.25)',  text: '#6ee7b7' },
  { bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.25)',  text: '#fcd34d' },
  { bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.25)', text: '#fca5a5' },
  { bg: 'rgba(56,189,248,0.10)',  border: 'rgba(56,189,248,0.25)',  text: '#7dd3fc' },
  { bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.25)', text: '#c4b5fd' },
  { bg: 'rgba(253,186,116,0.10)', border: 'rgba(253,186,116,0.25)', text: '#fdba74' },
  { bg: 'rgba(134,239,172,0.10)', border: 'rgba(134,239,172,0.25)', text: '#86efac' },
  { bg: 'rgba(196,181,253,0.10)', border: 'rgba(196,181,253,0.25)', text: '#ddd6fe' },
  { bg: 'rgba(147,197,253,0.10)', border: 'rgba(147,197,253,0.25)', text: '#93c5fd' },
  { bg: 'rgba(253,164,175,0.10)', border: 'rgba(253,164,175,0.25)', text: '#fda4af' },
];

// ── Draggable Line B Card ──
function DraggableLineB({ pairId, text, lang, colorIdx }: { pairId: string; text: string; lang: 'en' | 'ar'; colorIdx: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `lineb_${pairId}` });
  const color = PAIR_COLORS[colorIdx % PAIR_COLORS.length];
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: isDragging ? 999 : 1, position: 'relative' as const, touchAction: 'none' as const }
    : { zIndex: 1, position: 'relative' as const, touchAction: 'none' as const };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <motion.div
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.97 }}
        style={{
          padding: '10px 14px',
          cursor: 'grab',
          background: isDragging ? 'rgba(99,102,241,0.15)' : color.bg,
          border: isDragging ? `1.5px solid rgba(99,102,241,0.5)` : `1px solid ${color.border}`,
          borderRadius: '12px',
          boxShadow: isDragging ? '0 12px 32px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.12)',
          transition: 'box-shadow 0.2s, border-color 0.2s',
          backdropFilter: 'blur(8px)',
          direction: lang === 'ar' ? 'rtl' : 'ltr',
          textAlign: lang === 'ar' ? 'right' : 'left',
        }}
        onPointerDown={() => playSound('pop')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>📝</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#e2e8f0', lineHeight: 1.5 }}>{text}</span>
        </div>
      </motion.div>
    </div>
  );
}

// ── Drop Slot (each first-line row has a drop zone for the second line) ──
function DropSlot({
  pairId,
  lineA,
  lang,
  matchedLineB,
  matchedLang,
  pairIndex,
  submitted,
  isCorrect,
}: {
  pairId: string;
  lineA: string;
  lang: 'en' | 'ar';
  matchedLineB: string | null;
  matchedLang: 'en' | 'ar' | null;
  pairIndex: number;
  submitted: boolean;
  isCorrect?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot_${pairId}` });
  const color = PAIR_COLORS[pairIndex % PAIR_COLORS.length];

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: pairIndex * 0.04 }}
      style={{
        padding: '14px',
        borderRadius: '16px',
        background: submitted
          ? isCorrect ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'
          : isOver ? 'rgba(99,102,241,0.10)' : 'rgba(15,23,42,0.5)',
        border: submitted
          ? isCorrect ? '1.5px solid rgba(16,185,129,0.3)' : '1.5px solid rgba(239,68,68,0.3)'
          : isOver ? '1.5px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.05)',
        transition: 'all 0.2s ease',
        boxShadow: isOver ? '0 0 20px rgba(99,102,241,0.08)' : 'none',
      }}
    >
      {/* Pair Number */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{
          width: '26px', height: '26px', borderRadius: '8px',
          background: color.bg, border: `1px solid ${color.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.72rem', fontWeight: 700, color: color.text, flexShrink: 0,
        }}>
          {pairIndex + 1}
        </div>
        <span style={{
          fontSize: '0.65rem', fontWeight: 600, color: '#475569',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {lang === 'ar' ? 'عربي' : 'English'}
        </span>
        {submitted && (
          <span style={{ marginLeft: 'auto', fontSize: '1rem' }}>
            {isCorrect ? '✅' : '❌'}
          </span>
        )}
      </div>

      {/* Line A (always visible) */}
      <div style={{
        padding: '10px 14px',
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
        marginBottom: '6px',
        direction: lang === 'ar' ? 'rtl' : 'ltr',
        textAlign: lang === 'ar' ? 'right' : 'left',
      }}>
        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2e8f0', lineHeight: 1.6 }}>{lineA}</span>
      </div>

      {/* Drop zone / matched line B */}
      <div style={{
        padding: matchedLineB ? '10px 14px' : '14px',
        borderRadius: '10px',
        background: matchedLineB ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.015)',
        border: matchedLineB
          ? '1px solid rgba(99,102,241,0.15)'
          : isOver ? '1.5px dashed rgba(99,102,241,0.5)' : '1.5px dashed rgba(255,255,255,0.08)',
        minHeight: '42px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: matchedLineB ? 'flex-start' : 'center',
        transition: 'all 0.2s ease',
        direction: matchedLang === 'ar' ? 'rtl' : matchedLang === 'en' ? 'ltr' : lang === 'ar' ? 'rtl' : 'ltr',
        textAlign: matchedLang === 'ar' ? 'right' : matchedLang === 'en' ? 'left' : 'center',
      }}>
        {matchedLineB ? (
          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#c4b5fd', lineHeight: 1.5 }}>
            {matchedLineB}
          </span>
        ) : (
          <span style={{ fontSize: '0.75rem', color: '#475569', fontStyle: 'italic' }}>
            ↓ Drop the matching line here
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ── Leaderboard ──
function Leaderboard({ players, myScore, myName }: { players: SessionPlayer[]; myScore: number; myName: string }) {
  const finished = [...players].filter(p => !p.isKicked && p.hasFinished).sort((a, b) => b.score - a.score);
  const waiting = [...players].filter(p => !p.isKicked && !p.hasFinished);
  const allSorted = [...finished, ...waiting];
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,26,0.92)', backdropFilter: 'blur(20px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div style={{ maxWidth: '500px', width: '100%', padding: '2rem', borderRadius: '20px', background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.3rem' }}>🏆</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.2rem' }}>Leaderboard</h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.2rem' }}>Your score: <strong style={{ color: '#10b981' }}>{myScore}%</strong></p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '50vh', overflowY: 'auto', paddingRight: '4px' }}>
          {allSorted.map((player, idx) => {
            const isMe = player.name === myName;
            const isFinished = player.hasFinished;
            const rank = isFinished ? finished.indexOf(player) : -1;
            return (
              <motion.div key={player.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px',
                  background: isMe ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                  border: isMe ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.04)',
                  opacity: isFinished ? 1 : 0.5,
                }}
              >
                <span style={{ width: '24px', textAlign: 'center', fontSize: rank >= 0 && rank < 3 ? '1.1rem' : '0.8rem', fontWeight: 700, color: rank >= 0 && rank < 3 ? 'white' : '#64748b' }}>
                  {isFinished ? (rank < 3 ? medals[rank] : `${rank + 1}`) : '—'}
                </span>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: isMe ? 'linear-gradient(135deg, #6366f1, #4338ca)' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ flex: 1, textAlign: 'left', fontWeight: isMe ? 700 : 500, fontSize: '0.85rem' }}>
                  {player.name} {isMe && <span style={{ fontSize: '0.65rem', color: '#818cf8' }}>(You)</span>}
                </span>
                <span style={{ fontWeight: 700, color: isFinished ? '#10b981' : '#475569', fontSize: '0.9rem' }}>
                  {isFinished ? `${player.score}%` : '...'}
                </span>
              </motion.div>
            );
          })}
          {allSorted.length === 0 && <p style={{ color: '#64748b', padding: '1.5rem', fontSize: '0.85rem' }}>Waiting for players...</p>}
        </div>
      </div>
    </motion.div>
  );
}


// ── Main Game Component ──
export default function RhymingSentencesGame() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [sessionStatus, setSessionStatus] = useState<string>('active');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [allPlayers, setAllPlayers] = useState<SessionPlayer[]>([]);

  // matches: slotPairId → lineBPairId  (which lineB is placed in which slot)
  const [matches, setMatches] = useState<MatchMap>(() => {
    if (sessionId) { const s = loadGameState(sessionId); if (s) return s.matches; }
    const m: MatchMap = {};
    RHYMING_PAIRS.forEach(p => (m[p.id] = null));
    return m;
  });

  const [submitted, setSubmitted] = useState(() => {
    if (sessionId) { const s = loadGameState(sessionId); if (s) return s.submitted; }
    return false;
  });
  const [finalScore, setFinalScore] = useState(() => {
    if (sessionId) { const s = loadGameState(sessionId); if (s) return s.score; }
    return 0;
  });

  // Shuffled lineB order (persist so refresh keeps the same order)
  const [shuffledLineBs] = useState<RhymingPair[]>(() =>
    sessionId ? getShuffledLineBOrder(sessionId) : shuffleArray(RHYMING_PAIRS)
  );

  const playerName = (() => {
    const pid = localStorage.getItem('currentPlayerId');
    if (pid) { const parts = pid.split('_'); return parts.length > 1 ? parts.slice(1).join('_') : 'Student'; }
    return 'Student';
  })();

  // Sensors
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } });
  const sensors = useSensors(pointerSensor, touchSensor);

  const persistState = useCallback((newMatches: MatchMap, sub: boolean, sc: number) => {
    if (sessionId) saveGameState(sessionId, newMatches, sub, sc);
  }, [sessionId]);

  useEffect(() => { if (submitted) setShowLeaderboard(true); }, []);

  // ── Session + Player Sync ──
  useEffect(() => {
    if (!sessionId) return;
    const unsubs: (() => void)[] = [];
    unsubs.push(subscribeToSession(sessionId, session => {
      if (session) {
        setSessionStatus(session.status);
        if (session.status === 'waiting') { navigate('/join'); toast.info('Session reset. Please rejoin.'); }
        if (session.status === 'finished') setShowLeaderboard(true);
      }
    }));
    unsubs.push(subscribeToPlayers(sessionId, setAllPlayers));
    const playerId = localStorage.getItem('currentPlayerId');
    if (playerId) {
      unsubs.push(subscribeToPlayer(playerId, player => {
        if (player?.isKicked) { toast.error('You were removed.'); localStorage.removeItem('currentPlayerId'); navigate('/'); }
      }));
    }
    return () => unsubs.forEach(fn => fn());
  }, [sessionId, navigate]);

  // ── Drag handler ──
  const handleDragEnd = (event: DragEndEvent) => {
    if (sessionStatus !== 'active' || submitted) return;
    const { active, over } = event;
    if (!over) return;

    const lineBPairId = (active.id as string).replace('lineb_', '');
    const targetSlotId = (over.id as string).replace('slot_', '');

    // Check if this lineB is being dragged to a slot
    if (!(over.id as string).startsWith('slot_')) return;

    // Remove this lineB from any existing slot
    const newMatches = { ...matches };
    Object.keys(newMatches).forEach(k => {
      if (newMatches[k] === lineBPairId) newMatches[k] = null;
    });

    // If target slot already has a lineB, swap it out (send it back to pool)
    // (it will just appear back in the unmatched pool)

    // Place the lineB in the target slot
    newMatches[targetSlotId] = lineBPairId;
    setMatches(newMatches);
    persistState(newMatches, submitted, finalScore);
    playSound('pop');
  };

  // ── Submit & auto-grade ──
  const handleSubmit = async () => {
    if (submitted) return;
    let correct = 0;
    RHYMING_PAIRS.forEach(pair => {
      if (matches[pair.id] === pair.id) correct++;
    });
    const score = Math.round((correct / RHYMING_PAIRS.length) * 100);
    setFinalScore(score);
    setSubmitted(true);
    persistState(matches, true, score);

    const playerId = localStorage.getItem('currentPlayerId');
    if (playerId) {
      const progressSnapshot: any = {};
      RHYMING_PAIRS.forEach(pair => {
        const matchedId = matches[pair.id];
        const matchedPair = matchedId ? RHYMING_PAIRS.find(p => p.id === matchedId) : null;
        progressSnapshot[pair.lineA.substring(0, 30)] = matchedPair ? matchedPair.lineB.substring(0, 30) : '—';
      });
      await updatePlayerProgress(playerId, score, progressSnapshot, true);
    }
    playSound(score >= 70 ? 'fanfare' : 'ding');
    toast.success(`Submitted! ${score}% (${correct}/${RHYMING_PAIRS.length})`);
    setShowLeaderboard(true);
  };

  // Compute unmatched lineBs (those not placed in any slot)
  const matchedLineBIds = new Set(Object.values(matches).filter(Boolean) as string[]);
  const unmatchedLineBs = shuffledLineBs.filter(p => !matchedLineBIds.has(p.id));
  const placedCount = matchedLineBIds.size;

  // Get correct answers for submitted view
  const getCorrectness = (slotPairId: string) => matches[slotPairId] === slotPairId;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <div className="container" style={{ paddingTop: '1rem', paddingBottom: '3rem', maxWidth: '1400px' }}>

        <AnimatePresence>
          {sessionStatus === 'paused' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(10,14,26,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(16px)' }}>
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }} style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>👀</motion.div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #818cf8, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Eyes Up Front!</h2>
                <p style={{ color: '#64748b', marginTop: '0.3rem', fontSize: '0.9rem' }}>Teacher has paused the activity.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {showLeaderboard && <Leaderboard players={allPlayers} myScore={finalScore} myName={playerName} />}

        {/* ── Header ── */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 'clamp(1.1rem, 4vw, 1.5rem)', fontWeight: 800, margin: 0 }}>
              <span style={{ background: 'linear-gradient(135deg, #f472b6, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Rhyming Sentences</span>
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '2px 0 0' }}>Match each first line with its rhyming second line</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ width: '60px', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <motion.div animate={{ width: `${(placedCount / RHYMING_PAIRS.length) * 100}%` }}
                  style={{ height: '100%', borderRadius: '3px', background: placedCount === RHYMING_PAIRS.length ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #f472b6, #c084fc)' }} />
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{placedCount}/{RHYMING_PAIRS.length}</span>
            </div>
            <button className="btn" onClick={handleSubmit} disabled={submitted}
              style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '0.82rem', opacity: submitted ? 0.5 : 1, background: submitted ? 'linear-gradient(135deg, #10b981, #059669)' : undefined }}>
              {submitted ? `✓ ${finalScore}%` : '✨ Submit'}
            </button>
          </div>
        </header>

        {/* ── Game Board ── */}
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.2rem' }} className="rhyme-game-grid">
            {/* Left: Slots with first lines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '1.1rem' }}>📜</span>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#94a3b8', margin: 0 }}>Match the Pairs</h3>
              </div>
              {RHYMING_PAIRS.map((pair, idx) => {
                const matchedLineBId = matches[pair.id];
                const matchedPair = matchedLineBId ? RHYMING_PAIRS.find(p => p.id === matchedLineBId) : null;
                return (
                  <DropSlot
                    key={pair.id}
                    pairId={pair.id}
                    lineA={pair.lineA}
                    lang={pair.lang}
                    matchedLineB={matchedPair?.lineB || null}
                    matchedLang={matchedPair?.lang || null}
                    pairIndex={idx}
                    submitted={submitted}
                    isCorrect={submitted ? getCorrectness(pair.id) : undefined}
                  />
                );
              })}
            </div>

            {/* Right: Pool of unmatched lineBs */}
            <div style={{ position: 'sticky', top: '1rem', alignSelf: 'start' }}>
              <div style={{
                padding: '1rem',
                borderRadius: '16px',
                background: 'rgba(15,23,42,0.5)',
                border: '1px solid rgba(255,255,255,0.04)',
                minHeight: '200px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '1rem' }}>🎵</span>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', margin: 0 }}>Second Lines</h3>
                  <span style={{
                    fontSize: '0.65rem', background: 'rgba(255,255,255,0.06)',
                    color: '#94a3b8', padding: '1px 6px', borderRadius: '20px', fontWeight: 600,
                  }}>
                    {unmatchedLineBs.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {unmatchedLineBs.map((pair) => {
                    const originalIdx = RHYMING_PAIRS.findIndex(p => p.id === pair.id);
                    return (
                      <DraggableLineB
                        key={pair.id}
                        pairId={pair.id}
                        text={pair.lineB}
                        lang={pair.lang}
                        colorIdx={originalIdx}
                      />
                    );
                  })}
                  {unmatchedLineBs.length === 0 && !submitted && (
                    <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
                      <p style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>✓ All matched!</p>
                      <p style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '4px' }}>Click Submit when ready</p>
                    </div>
                  )}
                  {submitted && (
                    <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
                      <p style={{ color: '#818cf8', fontSize: '0.85rem', fontWeight: 600 }}>
                        Score: {finalScore}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DndContext>

        {/* Mobile responsive override */}
        <style>{`
          @media (max-width: 768px) {
            .rhyme-game-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </div>
  );
}
