import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DndContext, useDraggable, useDroppable, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { updatePlayerProgress, subscribeToPlayer, subscribeToSession, subscribeToPlayers } from '../../lib/db';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { SessionPlayer } from '../../types';

// ── Family Classes ──
interface FamilyZone {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  emoji: string;
  // Box position on the stage
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
}

const FAMILY_ZONES: FamilyZone[] = [
  {
    id: 'percussion', label: 'Percussion', color: '#fca5a5', bgColor: 'rgba(252,165,165,0.12)', borderColor: 'rgba(252,165,165,0.3)', glowColor: 'rgba(252,165,165,0.2)', emoji: '🥁',
    boxX: 30, boxY: 42, boxWidth: 40, boxHeight: 12
  },
  {
    id: 'brass', label: 'Brass', color: '#fdba74', bgColor: 'rgba(253,186,116,0.12)', borderColor: 'rgba(253,186,116,0.3)', glowColor: 'rgba(253,186,116,0.2)', emoji: '🎺',
    boxX: 20, boxY: 54, boxWidth: 60, boxHeight: 12
  },
  {
    id: 'woodwinds', label: 'Woodwinds', color: '#86efac', bgColor: 'rgba(134,239,172,0.12)', borderColor: 'rgba(134,239,172,0.3)', glowColor: 'rgba(134,239,172,0.2)', emoji: '🎵',
    boxX: 25, boxY: 67, boxWidth: 50, boxHeight: 12
  },
  {
    id: 'strings', label: 'Strings', color: '#93c5fd', bgColor: 'rgba(147,197,253,0.12)', borderColor: 'rgba(147,197,253,0.3)', glowColor: 'rgba(147,197,253,0.2)', emoji: '🎻',
    boxX: 5, boxY: 80, boxWidth: 90, boxHeight: 18
  },
];

// ── Static Instrument Data ──
// Image paths
const STAGE_IMAGE = '/images/orchestra-stage.png';
const INSTRUMENTS_GRID = '/images/instruments-grid.png';
const SPRITE_COLS = 5;
const SPRITE_ROWS = 4;

interface StaticInstrument {
  id: string;
  label: string;
  x: number; y: number; width: number; height: number;
  spriteRow: number; spriteCol: number;
  familyId: string;
}

const STATIC_INSTRUMENTS: StaticInstrument[] = [
  // Percussion 
  { id: 'timpani', label: 'Timpani', x: 42, y: 44, width: 8, height: 12, spriteRow: 0, spriteCol: 3, familyId: 'percussion' },
  { id: 'snare', label: 'Snare/Bass', x: 50, y: 44, width: 8, height: 12, spriteRow: 1, spriteCol: 0, familyId: 'percussion' },
  // Brass 
  { id: 'frenchhorns', label: 'French Horns', x: 25, y: 56, width: 10, height: 12, spriteRow: 2, spriteCol: 2, familyId: 'brass' },
  { id: 'trumpets', label: 'Trumpets', x: 40, y: 56, width: 10, height: 12, spriteRow: 2, spriteCol: 3, familyId: 'brass' },
  { id: 'trombones', label: 'Trombones', x: 50, y: 56, width: 10, height: 12, spriteRow: 2, spriteCol: 4, familyId: 'brass' },
  { id: 'tubas', label: 'Tubas', x: 65, y: 56, width: 10, height: 12, spriteRow: 2, spriteCol: 1, familyId: 'brass' },
  // Woodwinds 
  { id: 'flutes', label: 'Flutes', x: 30, y: 68, width: 10, height: 12, spriteRow: 3, spriteCol: 4, familyId: 'woodwinds' },
  { id: 'oboes', label: 'Oboes', x: 40, y: 68, width: 10, height: 12, spriteRow: 3, spriteCol: 1, familyId: 'woodwinds' },
  { id: 'clarinets', label: 'Clarinets', x: 50, y: 68, width: 10, height: 12, spriteRow: 3, spriteCol: 2, familyId: 'woodwinds' },
  { id: 'bassoons', label: 'Bassoons', x: 60, y: 68, width: 10, height: 12, spriteRow: 3, spriteCol: 0, familyId: 'woodwinds' },
  // Strings 
  { id: 'harp', label: 'Harp', x: 10, y: 76, width: 10, height: 14, spriteRow: 0, spriteCol: 0, familyId: 'strings' },
  { id: 'violin1', label: '1st Violins', x: 22, y: 80, width: 10, height: 12, spriteRow: 1, spriteCol: 4, familyId: 'strings' },
  { id: 'violin2', label: '2nd Violins', x: 34, y: 84, width: 10, height: 12, spriteRow: 2, spriteCol: 0, familyId: 'strings' },
  { id: 'violas', label: 'Violas', x: 46, y: 84, width: 10, height: 12, spriteRow: 1, spriteCol: 3, familyId: 'strings' },
  { id: 'cellos', label: 'Cellos', x: 58, y: 84, width: 10, height: 12, spriteRow: 1, spriteCol: 2, familyId: 'strings' },
  { id: 'doublebass', label: 'Double Basses', x: 70, y: 80, width: 10, height: 12, spriteRow: 1, spriteCol: 2, familyId: 'strings' },
];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Sound ──
const playSound = (type: 'pop' | 'ding' | 'fanfare') => {
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

// ── Persistence ──
const STORAGE_KEY = (sid: string) => `edu_orch3_state_${sid}`;
type PlacementMap = Record<string, string | null>; // zoneId → familyId

function saveState(sid: string, placements: PlacementMap, submitted: boolean, score: number) {
  localStorage.setItem(STORAGE_KEY(sid), JSON.stringify({ placements, submitted, score }));
}

function loadState(sid: string): { placements: PlacementMap; submitted: boolean; score: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(sid));
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return null;
}

// ── Sprite Component ──
function InstrumentSprite({ row, col, size = 40 }: { row: number; col: number; size?: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      backgroundImage: `url(${INSTRUMENTS_GRID})`,
      backgroundSize: `${SPRITE_COLS * 100}% ${SPRITE_ROWS * 100}%`,
      backgroundPosition: `${col === 0 ? 0 : (col / (SPRITE_COLS - 1)) * 100}% ${row === 0 ? 0 : (row / (SPRITE_ROWS - 1)) * 100}%`,
      backgroundRepeat: 'no-repeat',
      filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))',
    }} />
  );
}

// ── Draggable Family Group ──
function DraggableFamilyGroup({ family }: { family: FamilyZone }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `fam_${family.id}` });
  const insts = STATIC_INSTRUMENTS.filter(i => i.familyId === family.id);
  
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: isDragging ? 999 : 1, position: 'relative' as const, touchAction: 'none' as const }
    : { zIndex: 1, position: 'relative' as const, touchAction: 'none' as const };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <motion.div
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        style={{
          padding: '8px 16px', cursor: 'grab',
          background: isDragging ? 'rgba(99,102,241,0.2)' : family.bgColor,
          border: isDragging ? '2px solid rgba(99,102,241,0.5)' : `2px solid ${family.borderColor}`,
          borderRadius: '14px',
          boxShadow: isDragging ? '0 12px 32px rgba(0,0,0,0.5)' : `0 4px 12px rgba(0,0,0,0.15)`,
          transition: 'box-shadow 0.2s, border-color 0.2s',
          backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
        }}
        onPointerDown={() => playSound('pop')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>{family.emoji}</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: family.color, letterSpacing: '-0.01em' }}>{family.label}</span>
        </div>
        <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
          {insts.slice(0, 4).map(inst => (
             <InstrumentSprite key={inst.id} row={inst.spriteRow} col={inst.spriteCol} size={28} />
          ))}
          {insts.length > 4 && <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, paddingLeft: '2px' }}>+{insts.length - 4}</span>}
        </div>
      </motion.div>
    </div>
  );
}

// ── Droppable Zone on the Orchestra Map ──
function DroppableFamilyZone({
  zone,
  placedFamily,
  submitted,
  isCorrect,
}: {
  zone: FamilyZone;
  placedFamily: FamilyZone | null;
  submitted: boolean;
  isCorrect?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `zone_${zone.id}` });
  const insts = placedFamily ? STATIC_INSTRUMENTS.filter(i => i.familyId === placedFamily.id) : [];

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'absolute',
        left: `${zone.boxX}%`, top: `${zone.boxY}%`, width: `${zone.boxWidth}%`, height: `${zone.boxHeight}%`,
        borderRadius: '16px',
        background: submitted
          ? isCorrect ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'
          : placedFamily ? 'transparent' : isOver ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.02)',
        border: submitted
          ? isCorrect ? '2px solid rgba(16,185,129,0.5)' : '2px solid rgba(239,68,68,0.5)'
          : placedFamily ? 'none' : isOver ? '2px dashed rgba(99,102,241,0.6)' : '1px dashed rgba(255,255,255,0.15)',
        transition: 'all 0.2s ease',
        boxShadow: isOver ? `0 0 24px ${zone.glowColor}` : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
        pointerEvents: 'auto',
      }}
    >
      {placedFamily ? (
         <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '8px', width: '100%', flexWrap: 'wrap' }}>
           {insts.map(inst => (
             <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} key={inst.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <InstrumentSprite row={inst.spriteRow} col={inst.spriteCol} size={46} />
                <span style={{ fontSize: '0.65rem', color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,1)', fontWeight: 800, textAlign: 'center', lineHeight: 1.1, marginTop: '2px' }}>
                  {inst.label}
                </span>
             </motion.div>
           ))}
           {submitted && (
             <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '1.5rem', background: 'rgba(15,23,42,0.8)', borderRadius: '50%' }}>
               {isCorrect ? '✅' : '❌'}
             </div>
           )}
         </div>
      ) : (
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
          {isOver ? 'Drop Here' : 'Empty Spot'}
        </span>
      )}
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
export default function OrchestraLayoutGame() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [sessionStatus, setSessionStatus] = useState<string>('active');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [allPlayers, setAllPlayers] = useState<SessionPlayer[]>([]);

  // placements: zoneId → familyId (which family label was dropped on which zone)
  const [placements, setPlacements] = useState<PlacementMap>(() => {
    if (sessionId) { const s = loadState(sessionId); if (s) return s.placements; }
    const m: PlacementMap = {};
    FAMILY_ZONES.forEach(z => (m[z.id] = null));
    return m;
  });

  const [submitted, setSubmitted] = useState(() => {
    if (sessionId) { const s = loadState(sessionId); if (s) return s.submitted; }
    return false;
  });
  const [finalScore, setFinalScore] = useState(() => {
    if (sessionId) { const s = loadState(sessionId); if (s) return s.score; }
    return 0;
  });

  // Shuffled family labels
  const [shuffledFamilies] = useState<FamilyZone[]>(() => shuffleArray(FAMILY_ZONES));

  const playerName = (() => {
    const pid = localStorage.getItem('currentPlayerId');
    if (pid) { const parts = pid.split('_'); return parts.length > 1 ? parts.slice(1).join('_') : 'Student'; }
    return 'Student';
  })();

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } });
  const sensors = useSensors(pointerSensor, touchSensor);

  const persistState = useCallback((newPlacements: PlacementMap, sub: boolean, sc: number) => {
    if (sessionId) saveState(sessionId, newPlacements, sub, sc);
  }, [sessionId]);

  useEffect(() => { if (submitted) setShowLeaderboard(true); }, []);

  // Session sync
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

  // Drag handler
  const handleDragEnd = (event: DragEndEvent) => {
    if (sessionStatus !== 'active' || submitted) return;
    const { active, over } = event;
    if (!over) return;

    const familyId = (active.id as string).replace('fam_', '');
    const targetZoneId = (over.id as string).replace('zone_', '');
    if (!(over.id as string).startsWith('zone_')) return;

    const newPlacements = { ...placements };
    Object.keys(newPlacements).forEach(k => {
      if (newPlacements[k] === familyId) newPlacements[k] = null;
    });
    newPlacements[targetZoneId] = familyId;
    setPlacements(newPlacements);
    persistState(newPlacements, submitted, finalScore);
    playSound('pop');
  };

  // Submit
  const handleSubmit = async () => {
    if (submitted) return;
    let correct = 0;
    FAMILY_ZONES.forEach(zone => {
      if (placements[zone.id] === zone.id) correct++;
    });
    const score = Math.round((correct / FAMILY_ZONES.length) * 100);
    setFinalScore(score);
    setSubmitted(true);
    persistState(placements, true, score);

    const playerId = localStorage.getItem('currentPlayerId');
    if (playerId) {
      const progressSnapshot: any = {};
      FAMILY_ZONES.forEach(zone => {
        const placedId = placements[zone.id];
        const placedFam = placedId ? FAMILY_ZONES.find(f => f.id === placedId) : null;
        progressSnapshot[`Zone for: ${zone.label}`] = placedFam ? placedFam.label : '—';
      });
      await updatePlayerProgress(playerId, score, progressSnapshot, true);
    }
    playSound(score >= 70 ? 'fanfare' : 'ding');
    toast.success(`Submitted! ${score}% (${correct}/${FAMILY_ZONES.length})`);
    setShowLeaderboard(true);
  };

  const placedFamilyIds = new Set(Object.values(placements).filter(Boolean) as string[]);
  const unmatchedFamilies = shuffledFamilies.filter(f => !placedFamilyIds.has(f.id));
  const placedCount = placedFamilyIds.size;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <div className="container" style={{ paddingTop: '1rem', paddingBottom: '3rem', maxWidth: '1200px' }}>

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
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 'clamp(1.1rem, 4vw, 1.5rem)', fontWeight: 800, margin: 0 }}>
              <span style={{ background: 'linear-gradient(135deg, #fbbf24, #f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Orchestra Layout</span>
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '2px 0 0' }}>Drag the group of instruments into their correct spot on stage.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ width: '60px', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <motion.div animate={{ width: `${(placedCount / FAMILY_ZONES.length) * 100}%` }}
                  style={{ height: '100%', borderRadius: '3px', background: placedCount === FAMILY_ZONES.length ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #fbbf24, #f472b6)' }} />
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{placedCount}/{FAMILY_ZONES.length}</span>
            </div>
            <button className="btn" onClick={handleSubmit} disabled={submitted}
              style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '0.82rem', opacity: submitted ? 0.5 : 1, background: submitted ? 'linear-gradient(135deg, #10b981, #059669)' : undefined }}>
              {submitted ? `✓ ${finalScore}%` : '✨ Submit'}
            </button>
          </div>
        </header>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>

          {/* ── Family Labels Bank ── */}
          <div style={{
            marginBottom: '1rem',
            padding: '16px 20px',
            borderRadius: '16px',
            background: 'rgba(15,23,42,0.5)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {unmatchedFamilies.map(family => (
                <DraggableFamilyGroup key={family.id} family={family} />
              ))}
              {unmatchedFamilies.length === 0 && !submitted && (
                <p style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600, padding: '8px 0' }}>
                  ✓ All labels placed! Click Submit when ready.
                </p>
              )}
              {submitted && (
                <p style={{ color: '#818cf8', fontSize: '0.85rem', fontWeight: 600, padding: '8px 0' }}>
                  Score: {finalScore}%
                </p>
              )}
            </div>
          </div>

          {/* ── Orchestra Stage Layout ── */}
          <div style={{
            position: 'relative',
            borderRadius: '24px',
            overflow: 'hidden',
            aspectRatio: '16 / 10',
            boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
            {/* 3D Stage Background Image */}
            <img
              src={STAGE_IMAGE}
              alt="Orchestra Stage"
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', filter: 'brightness(0.9) contrast(1.1)',
                pointerEvents: 'none',
              }}
            />

            {/* Dark overlay for contrast */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, rgba(15,23,42,0.6) 0%, rgba(15,23,42,0.2) 60%, rgba(15,23,42,0.6) 100%)',
              pointerEvents: 'none',
            }} />

            {/* AUDIENCE marker */}
            <div style={{
              position: 'absolute', bottom: '2%', left: '50%', transform: 'translateX(-50%)',
              fontSize: 'clamp(0.6rem, 1vw, 0.8rem)', color: 'rgba(255,255,255,0.5)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.3em', pointerEvents: 'none',
              textShadow: '0 2px 8px rgba(0,0,0,0.8)',
            }}>
              🎭 Audience
            </div>

            {/* Conductor marker */}
            <div style={{
              position: 'absolute', bottom: '0%', left: '46%', width: '8%', height: '8%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none',
              zIndex: 20,
            }}>
              <span style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>🎼</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#d8b4fe', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>Conductor</span>
            </div>

            {/* Absolutely Placed Family Drop Zones */}
            {FAMILY_ZONES.map(zone => {
              const placedId = placements[zone.id];
              const placedFamily = placedId ? FAMILY_ZONES.find(f => f.id === placedId) : null;
              return (
                <DroppableFamilyZone
                  key={zone.id}
                  zone={zone}
                  placedFamily={placedFamily || null}
                  submitted={submitted}
                  isCorrect={submitted ? placements[zone.id] === zone.id : undefined}
                />
              );
            })}


          </div>

        </DndContext>
      </div>
    </div>
  );
}
