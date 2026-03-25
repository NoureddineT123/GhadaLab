import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DndContext, useDraggable, useDroppable, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { updatePlayerProgress, subscribeToPlayer, subscribeToSession, subscribeToPlayers } from '../../lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { InstrumentIcon } from '../../components/InstrumentIcons';
import type { SessionPlayer } from '../../types';

// ── Data ──
type InstrumentCategory = 'bank' | 'wind' | 'percussion' | 'string';

interface Instrument {
  id: string;
  name: string;
  category: string;
}

const INITIAL_INSTRUMENTS: Instrument[] = [
  { id: '1', name: 'Violin', category: 'string' },
  { id: '2', name: 'Viola', category: 'string' },
  { id: '3', name: 'Cello', category: 'string' },
  { id: '4', name: 'Double Bass', category: 'string' },
  { id: '5', name: 'Harp', category: 'string' },
  { id: '6', name: 'Guitar', category: 'string' },
  { id: '7', name: 'Flute', category: 'wind' },
  { id: '8', name: 'Piccolo', category: 'wind' },
  { id: '9', name: 'Clarinet', category: 'wind' },
  { id: '10', name: 'Oboe', category: 'wind' },
  { id: '11', name: 'Bassoon', category: 'wind' },
  { id: '12', name: 'Saxophone', category: 'wind' },
  { id: '13', name: 'Trumpet', category: 'wind' },
  { id: '14', name: 'Trombone', category: 'wind' },
  { id: '15', name: 'French Horn', category: 'wind' },
  { id: '16', name: 'Tuba', category: 'wind' },
  { id: '17', name: 'Drums', category: 'percussion' },
  { id: '18', name: 'Xylophone', category: 'percussion' },
  { id: '19', name: 'Cymbals', category: 'percussion' },
  { id: '20', name: 'Triangle', category: 'percussion' },
  { id: '21', name: 'Timpani', category: 'percussion' },
  { id: '22', name: 'Maracas', category: 'percussion' },
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

const FAMILY_META: Record<string, { emoji: string; label: string }> = {
  bank: { emoji: '🎵', label: 'Instrument Bank' },
  string: { emoji: '🎻', label: 'Strings' },
  wind: { emoji: '🎺', label: 'Wind' },
  percussion: { emoji: '🥁', label: 'Percussion' },
};

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
const STORAGE_KEY = (sessionId: string) => `edu_game_state_${sessionId}`;
const SHUFFLE_KEY = (sessionId: string) => `edu_game_shuffle_${sessionId}`;

function saveGameState(sessionId: string, items: Record<string, InstrumentCategory>, submitted: boolean, score: number) {
  localStorage.setItem(STORAGE_KEY(sessionId), JSON.stringify({ items, submitted, score }));
}

function loadGameState(sessionId: string): { items: Record<string, InstrumentCategory>; submitted: boolean; score: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(sessionId));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function getShuffledOrder(sessionId: string): Instrument[] {
  try {
    const raw = localStorage.getItem(SHUFFLE_KEY(sessionId));
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      return ids.map(id => INITIAL_INSTRUMENTS.find(i => i.id === id)!).filter(Boolean);
    }
  } catch { /* ignore */ }
  const shuffled = shuffleArray(INITIAL_INSTRUMENTS);
  localStorage.setItem(SHUFFLE_KEY(sessionId), JSON.stringify(shuffled.map(i => i.id)));
  return shuffled;
}

// ── Draggable Item ──
function DraggableItem({ id, name }: { id: string; name: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: isDragging ? 999 : 1, position: 'relative' as const }
    : { zIndex: 1, position: 'relative' as const };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <motion.div
        whileHover={{ scale: 1.03, y: -1 }}
        whileTap={{ scale: 0.97 }}
        style={{
          padding: '7px 12px', margin: '2px 0', cursor: 'grab',
          background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
          border: isDragging ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.06)',
          borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px',
          boxShadow: isDragging ? '0 12px 32px rgba(0,0,0,0.5)' : '0 2px 6px rgba(0,0,0,0.12)',
          transition: 'box-shadow 0.2s, border-color 0.2s',
        }}
        onPointerDown={() => playSound('pop')}
      >
        <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <InstrumentIcon name={name} size={22} />
        </div>
        <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#e2e8f0' }}>{name}</span>
      </motion.div>
    </div>
  );
}

// ── Droppable Column ──
function DroppableColumn({ id, items, instrumentOrder }: { id: InstrumentCategory; items: Instrument[]; instrumentOrder: Instrument[] }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const meta = FAMILY_META[id];
  // Display in shuffle order for bank, alphabetical for categories
  const displayItems = id === 'bank'
    ? instrumentOrder.filter(i => items.some(it => it.id === i.id))
    : items;

  return (
    <div
      ref={setNodeRef}
      style={{
        padding: '0.75rem', minHeight: id === 'bank' ? '200px' : '120px',
        display: 'flex', flexDirection: 'column',
        background: isOver ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
        border: isOver ? '1.5px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.04)',
        borderRadius: '14px', transition: 'all 0.2s ease',
        boxShadow: isOver ? '0 0 20px rgba(99,102,241,0.08)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', justifyContent: 'center' }}>
        <span style={{ fontSize: '1rem' }}>{meta.emoji}</span>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', margin: 0 }}>{meta.label}</h3>
        {id !== 'bank' && (
          <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.06)', color: '#94a3b8', padding: '1px 6px', borderRadius: '20px', fontWeight: 600 }}>
            {items.length}
          </span>
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {displayItems.map(i => <DraggableItem key={i.id} id={i.id} name={i.name} />)}
      </div>
    </div>
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

// ── Main Game ──
export default function InstrumentFamiliesGame() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [sessionStatus, setSessionStatus] = useState<string>('active');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [allPlayers, setAllPlayers] = useState<SessionPlayer[]>([]);

  // Restore persisted state or initialize fresh
  const [submitted, setSubmitted] = useState(() => {
    if (sessionId) { const s = loadGameState(sessionId); if (s) return s.submitted; }
    return false;
  });
  const [finalScore, setFinalScore] = useState(() => {
    if (sessionId) { const s = loadGameState(sessionId); if (s) return s.score; }
    return 0;
  });
  const [items, setItems] = useState<Record<string, InstrumentCategory>>(() => {
    if (sessionId) {
      const saved = loadGameState(sessionId);
      if (saved) return saved.items;
    }
    const state: Record<string, InstrumentCategory> = {};
    INITIAL_INSTRUMENTS.forEach(i => (state[i.id] = 'bank'));
    return state;
  });

  // Shuffled order (persisted so refresh preserves order)
  const [instrumentOrder] = useState<Instrument[]>(() => sessionId ? getShuffledOrder(sessionId) : shuffleArray(INITIAL_INSTRUMENTS));

  const playerName = (() => {
    const pid = localStorage.getItem('currentPlayerId');
    if (pid) { const parts = pid.split('_'); return parts.length > 1 ? parts.slice(1).join('_') : 'Student'; }
    return 'Student';
  })();

  // Touch + pointer sensors for mobile DnD
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } });
  const sensors = useSensors(pointerSensor, touchSensor);

  // Persist state on every change
  const persistState = useCallback((newItems: Record<string, InstrumentCategory>, sub: boolean, sc: number) => {
    if (sessionId) saveGameState(sessionId, newItems, sub, sc);
  }, [sessionId]);

  // If already submitted on load, show leaderboard
  useEffect(() => {
    if (submitted) setShowLeaderboard(true);
  }, []);

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
    const instrumentId = active.id as string;
    const dropCategoryId = over.id as InstrumentCategory;
    if (items[instrumentId] !== dropCategoryId) {
      playSound('pop');
      const newItems = { ...items, [instrumentId]: dropCategoryId };
      setItems(newItems);
      persistState(newItems, submitted, finalScore);
    }
  };

  // ── Submit & auto-grade ──
  const handleSubmit = async () => {
    if (submitted) return;
    let correct = 0;
    INITIAL_INSTRUMENTS.forEach(instr => { if (items[instr.id] === instr.category) correct++; });
    const score = Math.round((correct / INITIAL_INSTRUMENTS.length) * 100);
    setFinalScore(score);
    setSubmitted(true);
    persistState(items, true, score);

    const playerId = localStorage.getItem('currentPlayerId');
    if (playerId) {
      const progressSnapshot: any = {};
      INITIAL_INSTRUMENTS.forEach(i => { progressSnapshot[i.name] = items[i.id]; });
      await updatePlayerProgress(playerId, score, progressSnapshot, true);
    }
    playSound(score >= 70 ? 'fanfare' : 'ding');
    toast.success(`Submitted! ${score}% (${correct}/${INITIAL_INSTRUMENTS.length})`);
    setShowLeaderboard(true);
  };

  const bankItems = INITIAL_INSTRUMENTS.filter(i => items[i.id] === 'bank');
  const winds = INITIAL_INSTRUMENTS.filter(i => items[i.id] === 'wind');
  const percussion = INITIAL_INSTRUMENTS.filter(i => items[i.id] === 'percussion');
  const strings = INITIAL_INSTRUMENTS.filter(i => items[i.id] === 'string');
  const placedCount = INITIAL_INSTRUMENTS.length - bankItems.length;

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

        {/* ── Header (responsive) ── */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 'clamp(1.1rem, 4vw, 1.5rem)', fontWeight: 800, margin: 0 }}>
              <span style={{ background: 'linear-gradient(135deg, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Instrument Families</span>
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '2px 0 0' }}>Drag instruments into their correct family</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ width: '60px', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <motion.div animate={{ width: `${(placedCount / INITIAL_INSTRUMENTS.length) * 100}%` }}
                  style={{ height: '100%', borderRadius: '3px', background: placedCount === INITIAL_INSTRUMENTS.length ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #6366f1, #818cf8)' }} />
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{placedCount}/{INITIAL_INSTRUMENTS.length}</span>
            </div>
            <button className="btn" onClick={handleSubmit} disabled={submitted}
              style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '0.82rem', opacity: submitted ? 0.5 : 1, background: submitted ? 'linear-gradient(135deg, #10b981, #059669)' : undefined }}>
              {submitted ? `✓ ${finalScore}%` : '✨ Submit'}
            </button>
          </div>
        </header>

        {/* ── Game Board (responsive: side-by-side desktop, stacked mobile) ── */}
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 260px) 1fr', gap: '1rem' }} className="game-grid">
            <div>
              <DroppableColumn id="bank" items={bankItems} instrumentOrder={instrumentOrder} />
              {bankItems.length > 0 && <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.72rem', marginTop: '6px' }}>↑ Drag from here</p>}
              {bankItems.length === 0 && !submitted && (
                <div style={{ textAlign: 'center', padding: '0.75rem', marginTop: '6px' }}>
                  <p style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 600 }}>✓ All placed!</p>
                  <p style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '2px' }}>Click Submit when ready</p>
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', alignContent: 'start' }}>
              <DroppableColumn id="string" items={strings} instrumentOrder={instrumentOrder} />
              <DroppableColumn id="wind" items={winds} instrumentOrder={instrumentOrder} />
              <DroppableColumn id="percussion" items={percussion} instrumentOrder={instrumentOrder} />
            </div>
          </div>
        </DndContext>

        {/* Mobile responsive override */}
        <style>{`
          @media (max-width: 700px) {
            .game-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </div>
  );
}
