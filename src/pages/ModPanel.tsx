import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import {
  subscribeToAllSessions, subscribeToPlayers, updateSessionStatus,
  adminUpdatePlayer, adminUpdateSession, adminDeleteSession, adminDeletePlayer, subscribeToAllPlayers
} from '../lib/db';
import type { Session, SessionPlayer } from '../types';

const ADMIN_EMAIL = 'aasiandadyt@gmail.com';

// ── Utility Components ──

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '560px', width: '100%', maxHeight: '85vh', overflowY: 'auto', borderRadius: '20px', background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', padding: '1.5rem' }}>
        {children}
      </motion.div>
    </motion.div>
  );
}

function StatCard({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div style={{ padding: '0.8rem', borderRadius: '12px', background: `${color}08`, border: `1px solid ${color}20`, textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  );
}

function InputRow({ label, value, onChange, type = 'text' }: { label: string; value: string | number; onChange: (v: string) => void; type?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
      <label style={{ fontSize: '0.78rem', color: '#64748b', width: '90px', flexShrink: 0, textAlign: 'right' }}>{label}</label>
      <input className="input" type={type} value={value} onChange={e => onChange(e.target.value)}
        style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: '8px', flex: 1 }} />
    </div>
  );
}

// ── Player Detail Modal ──
function PlayerModal({ player, onClose, onSave, onDelete }: { player: SessionPlayer; onClose: () => void; onSave: (data: Partial<SessionPlayer>) => void; onDelete: () => void }) {
  const [name, setName] = useState(player.name);
  const [score, setScore] = useState(String(player.score));
  const [isKicked, setIsKicked] = useState(player.isKicked);
  const [hasFinished, setHasFinished] = useState(player.hasFinished);
  const [editProgress, setEditProgress] = useState(JSON.stringify(player.progress || {}, null, 2));
  const [showRaw, setShowRaw] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    let prog = player.progress;
    try { prog = JSON.parse(editProgress); } catch { toast.error('Invalid JSON in progress'); return; }
    onSave({ name, score: Number(score), isKicked, hasFinished, progress: prog });
  };

  return (
    <Modal onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>📝 Edit Player</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
      </div>

      {/* Player avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.2rem', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #4338ca)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', color: 'white', flexShrink: 0 }}>
          {player.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>{player.name}</div>
          <div style={{ color: '#475569', fontSize: '0.72rem', fontFamily: 'monospace' }}>ID: {player.id}</div>
        </div>
      </div>

      {/* Editable fields */}
      <InputRow label="Name" value={name} onChange={setName} />
      <InputRow label="Score" value={score} onChange={setScore} type="number" />

      {/* Toggles */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', marginTop: '4px' }}>
        <button onClick={() => setHasFinished(!hasFinished)}
          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${hasFinished ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`, background: hasFinished ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)', color: hasFinished ? '#34d399' : '#64748b', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
          {hasFinished ? '✓ Finished' : '○ Not Finished'}
        </button>
        <button onClick={() => setIsKicked(!isKicked)}
          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${isKicked ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`, background: isKicked ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)', color: isKicked ? '#f87171' : '#64748b', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
          {isKicked ? '⛔ Kicked' : '○ Active'}
        </button>
      </div>

      {/* Progress data */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Progress Data</span>
          <button onClick={() => setShowRaw(!showRaw)}
            style={{ fontSize: '0.68rem', color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            {showRaw ? 'Hide Raw' : 'Show Raw JSON'}
          </button>
        </div>
        {showRaw ? (
          <textarea value={editProgress} onChange={e => setEditProgress(e.target.value)}
            style={{ width: '100%', minHeight: '120px', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '0.75rem', resize: 'vertical', outline: 'none' }} />
        ) : (
          <div style={{ maxHeight: '120px', overflowY: 'auto', fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '8px' }}>
            {Object.entries(player.progress || {}).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span>{k}</span><span style={{ color: '#475569' }}>{String(v)}</span>
              </div>
            ))}
            {Object.keys(player.progress || {}).length === 0 && <span style={{ color: '#475569' }}>No progress data</span>}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <button className="btn" onClick={handleSave} style={{ flex: 1, padding: '10px', fontSize: '0.85rem', borderRadius: '10px' }}>
          💾 Save Changes
        </button>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            style={{ padding: '10px 16px', fontSize: '0.85rem', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer', fontWeight: 600 }}>
            🗑
          </button>
        ) : (
          <button onClick={onDelete}
            style={{ padding: '10px 16px', fontSize: '0.78rem', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontWeight: 700 }}>
            Confirm Delete
          </button>
        )}
      </div>
    </Modal>
  );
}

// ── Session Edit Modal ──
function SessionModal({ session, onClose, onSave, onDelete }: { session: Session; onClose: () => void; onSave: (data: Partial<Session>) => void; onDelete: () => void }) {
  const [pin, setPin] = useState(session.pin);
  const [gameId, setGameId] = useState(session.gameId);
  const [status, setStatus] = useState(session.status);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Modal onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>⚙️ Edit Session</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
      </div>

      <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.72rem', fontFamily: 'monospace', color: '#475569' }}>
        ID: {session.id}
      </div>

      <InputRow label="Game ID" value={gameId} onChange={setGameId} />
      <InputRow label="PIN" value={pin} onChange={setPin} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <label style={{ fontSize: '0.78rem', color: '#64748b', width: '90px', textAlign: 'right' }}>Status</label>
        <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
          {(['waiting', 'active', 'finished'] as const).map(s => (
            <button key={s} onClick={() => setStatus(s)}
              style={{ flex: 1, padding: '6px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                background: status === s ? (s === 'active' ? 'rgba(16,185,129,0.15)' : s === 'waiting' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)') : 'rgba(255,255,255,0.03)',
                color: status === s ? (s === 'active' ? '#34d399' : s === 'waiting' ? '#fbbf24' : '#f87171') : '#475569',
                border: `1px solid ${status === s ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'}` }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: '1rem' }}>
        Created: {new Date(session.createdAt).toLocaleString()}<br />
        Teacher: {session.teacherId}
      </div>

      <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <button className="btn" onClick={() => onSave({ pin, gameId, status })} style={{ flex: 1, padding: '10px', fontSize: '0.85rem', borderRadius: '10px' }}>
          💾 Save
        </button>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            style={{ padding: '10px 16px', fontSize: '0.85rem', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer', fontWeight: 600 }}>
            🗑
          </button>
        ) : (
          <button onClick={onDelete}
            style={{ padding: '10px 16px', fontSize: '0.78rem', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontWeight: 700 }}>
            Confirm Delete
          </button>
        )}
      </div>
    </Modal>
  );
}

// ── Broadcast Message ──
function BroadcastBar() {
  const [msg, setMsg] = useState('');
  return (
    <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', borderRadius: '12px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)', alignItems: 'center' }}>
      <span style={{ fontSize: '1rem' }}>📢</span>
      <input className="input" placeholder="Broadcast message to all sessions..." value={msg} onChange={e => setMsg(e.target.value)}
        style={{ padding: '6px 10px', fontSize: '0.82rem', borderRadius: '8px', flex: 1, background: 'rgba(0,0,0,0.2)' }} />
      <button onClick={() => { if (msg) { toast.success(`Broadcast: ${msg}`); setMsg(''); } }}
        style={{ padding: '6px 14px', fontSize: '0.75rem', borderRadius: '8px', background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
        Send
      </button>
    </div>
  );
}

// ═══════════════════════════════════════
// ── MAIN ADMIN PANEL ──
// ═══════════════════════════════════════
export default function ModPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allPlayers, setAllPlayers] = useState<SessionPlayer[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionPlayers, setSessionPlayers] = useState<Record<string, SessionPlayer[]>>({});

  // UI State
  const [activeTab, setActiveTab] = useState<'sessions' | 'players' | 'analytics'>('sessions');
  const [editingPlayer, setEditingPlayer] = useState<SessionPlayer | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'waiting' | 'finished'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'players' | 'score'>('date');
  const [playerSearch, setPlayerSearch] = useState('');
  const [playerFilter, setPlayerFilter] = useState<'all' | 'finished' | 'inprogress' | 'kicked'>('all');

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u && u.email === ADMIN_EMAIL) { setUser(u); setAuthorized(true); } else { setUser(null); setAuthorized(false); }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Load all sessions + all players globally
  useEffect(() => {
    if (!authorized) return;
    const u1 = subscribeToAllSessions(setSessions);
    const u2 = subscribeToAllPlayers(setAllPlayers);
    return () => { u1(); u2(); };
  }, [authorized]);

  // Load players for expanded session
  useEffect(() => {
    if (!expandedSession) return;
    const unsub = subscribeToPlayers(expandedSession, (players) => {
      setSessionPlayers(prev => ({ ...prev, [expandedSession]: players }));
    });
    return () => unsub();
  }, [expandedSession]);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user.email !== ADMIN_EMAIL) { await signOut(auth); toast.error('Access denied.'); }
    } catch { toast.error('Login failed.'); }
  };

  // ── Computed values ──
  const filteredSessions = useMemo(() => {
    let list = sessions;
    if (statusFilter !== 'all') list = list.filter(s => s.status === statusFilter);
    if (searchQuery) list = list.filter(s => s.pin.includes(searchQuery) || s.gameId.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.includes(searchQuery));
    if (sortBy === 'players') {
      list = [...list].sort((a, b) => {
        const ap = allPlayers.filter(p => p.sessionId === a.id && !p.isKicked).length;
        const bp = allPlayers.filter(p => p.sessionId === b.id && !p.isKicked).length;
        return bp - ap;
      });
    } else if (sortBy === 'score') {
      list = [...list].sort((a, b) => {
        const as_ = allPlayers.filter(p => p.sessionId === a.id && p.hasFinished);
        const bs_ = allPlayers.filter(p => p.sessionId === b.id && p.hasFinished);
        const aa = as_.length ? as_.reduce((s, p) => s + p.score, 0) / as_.length : 0;
        const ba = bs_.length ? bs_.reduce((s, p) => s + p.score, 0) / bs_.length : 0;
        return ba - aa;
      });
    }
    return list;
  }, [sessions, statusFilter, searchQuery, sortBy, allPlayers]);

  const filteredPlayers = useMemo(() => {
    let list = allPlayers;
    if (playerFilter === 'finished') list = list.filter(p => p.hasFinished);
    else if (playerFilter === 'inprogress') list = list.filter(p => !p.hasFinished && !p.isKicked);
    else if (playerFilter === 'kicked') list = list.filter(p => p.isKicked);
    if (playerSearch) list = list.filter(p => p.name.toLowerCase().includes(playerSearch.toLowerCase()) || p.id.includes(playerSearch) || p.sessionId.includes(playerSearch));
    return list.sort((a, b) => b.score - a.score);
  }, [allPlayers, playerFilter, playerSearch]);

  const stats = useMemo(() => {
    const totalPlayers = allPlayers.filter(p => !p.isKicked).length;
    const finishedPlayers = allPlayers.filter(p => p.hasFinished && !p.isKicked);
    const avgScore = finishedPlayers.length ? Math.round(finishedPlayers.reduce((s, p) => s + p.score, 0) / finishedPlayers.length) : 0;
    const topPlayer = finishedPlayers.sort((a, b) => b.score - a.score)[0];
    return {
      activeSessions: sessions.filter(s => s.status === 'active').length,
      waitingSessions: sessions.filter(s => s.status === 'waiting').length,
      finishedSessions: sessions.filter(s => s.status === 'finished').length,
      totalSessions: sessions.length,
      totalPlayers,
      finishedPlayers: finishedPlayers.length,
      avgScore,
      kickedPlayers: allPlayers.filter(p => p.isKicked).length,
      topPlayer,
      perfectScores: finishedPlayers.filter(p => p.score === 100).length,
    };
  }, [sessions, allPlayers]);

  // ── Handlers ──
  const handleSavePlayer = async (data: Partial<SessionPlayer>) => {
    if (!editingPlayer) return;
    await adminUpdatePlayer(editingPlayer.id, data);
    toast.success(`Updated ${data.name || editingPlayer.name}`);
    setEditingPlayer(null);
  };

  const handleDeletePlayer = async () => {
    if (!editingPlayer) return;
    await adminDeletePlayer(editingPlayer.id);
    toast.success(`Deleted ${editingPlayer.name}`);
    setEditingPlayer(null);
  };

  const handleSaveSession = async (data: Partial<Session>) => {
    if (!editingSession) return;
    await adminUpdateSession(editingSession.id, data);
    toast.success('Session updated');
    setEditingSession(null);
  };

  const handleDeleteSession = async () => {
    if (!editingSession) return;
    await adminDeleteSession(editingSession.id);
    toast.success('Session deleted');
    setEditingSession(null);
  };

  const bulkAction = async (action: string) => {
    if (action === 'end-all') {
      for (const s of sessions.filter(s => s.status === 'active')) await updateSessionStatus(s.id, 'finished');
      toast.success('All active sessions ended');
    } else if (action === 'unkick-all') {
      for (const p of allPlayers.filter(p => p.isKicked)) await adminUpdatePlayer(p.id, { isKicked: false });
      toast.success('All players unkicked');
    } else if (action === 'reset-scores') {
      for (const p of allPlayers.filter(p => p.hasFinished)) await adminUpdatePlayer(p.id, { score: 0, hasFinished: false, progress: {} });
      toast.success('All scores reset');
    }
  };

  // ── Login Screen ──
  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050810' }}><div className="spinner" /></div>;

  if (!authorized) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050810' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: '2.5rem', maxWidth: '380px', width: '90%', borderRadius: '20px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.3rem' }}>Admin Access</h2>
          <p style={{ color: '#475569', fontSize: '0.8rem', marginBottom: '1.5rem' }}>Authorized personnel only</p>
          <button className="btn" onClick={handleLogin}
            style={{ width: '100%', padding: '12px', fontSize: '0.9rem', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0' }}>
            Sign In
          </button>
        </motion.div>
      </div>
    );
  }

  // ═════════════════════════
  // ── ADMIN DASHBOARD ──
  // ═════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: '#050810' }}>
      <div className="container" style={{ maxWidth: '1300px', paddingTop: '1rem', paddingBottom: '2rem' }}>

        {/* ── Header ── */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', paddingBottom: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}><span style={{ color: '#ef4444' }}>⚡</span> Mod Panel</h2>
            <p style={{ color: '#475569', fontSize: '0.72rem' }}>{user?.email} • {new Date().toLocaleDateString()}</p>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button onClick={() => bulkAction('end-all')} style={{ padding: '5px 10px', fontSize: '0.68rem', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer', fontWeight: 600 }}>End All</button>
            <button onClick={() => bulkAction('unkick-all')} style={{ padding: '5px 10px', fontSize: '0.68rem', borderRadius: '6px', background: 'rgba(16,185,129,0.08)', color: '#34d399', border: '1px solid rgba(16,185,129,0.15)', cursor: 'pointer', fontWeight: 600 }}>Unkick All</button>
            <button onClick={() => bulkAction('reset-scores')} style={{ padding: '5px 10px', fontSize: '0.68rem', borderRadius: '6px', background: 'rgba(245,158,11,0.08)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.15)', cursor: 'pointer', fontWeight: 600 }}>Reset Scores</button>
            <button onClick={() => signOut(auth)} style={{ padding: '5px 10px', fontSize: '0.68rem', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>Logout</button>
          </div>
        </header>

        {/* ── Stats Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px', marginBottom: '1rem' }}>
          <StatCard value={stats.activeSessions} label="Live" color="#10b981" />
          <StatCard value={stats.waitingSessions} label="Waiting" color="#f59e0b" />
          <StatCard value={stats.finishedSessions} label="Ended" color="#ef4444" />
          <StatCard value={stats.totalPlayers} label="Players" color="#6366f1" />
          <StatCard value={stats.finishedPlayers} label="Submitted" color="#8b5cf6" />
          <StatCard value={`${stats.avgScore}%`} label="Avg Score" color="#06b6d4" />
          <StatCard value={stats.perfectScores} label="100%" color="#22c55e" />
          <StatCard value={stats.kickedPlayers} label="Kicked" color="#ef4444" />
          <StatCard value={stats.topPlayer?.name?.slice(0, 8) || '—'} label="Top Player" color="#ec4899" />
          <StatCard value={stats.totalSessions} label="Total" color="#94a3b8" />
        </div>

        {/* ── Broadcast ── */}
        <div style={{ marginBottom: '1rem' }}><BroadcastBar /></div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '4px' }}>
          {(['sessions', 'players', 'analytics'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', border: 'none', textTransform: 'capitalize',
                background: activeTab === tab ? 'rgba(99,102,241,0.12)' : 'transparent',
                color: activeTab === tab ? '#818cf8' : '#475569' }}>
              {tab === 'sessions' ? '📋 ' : tab === 'players' ? '👥 ' : '📊 '}{tab}
            </button>
          ))}
        </div>

        {/* ═══ SESSIONS TAB ═══ */}
        {activeTab === 'sessions' && (
          <>
            {/* Search + Filter bar */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <input className="input" placeholder="Search by PIN, game, or ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1, minWidth: '180px', padding: '8px 12px', fontSize: '0.82rem', borderRadius: '8px' }} />
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['all', 'active', 'waiting', 'finished'] as const).map(f => (
                  <button key={f} onClick={() => setStatusFilter(f)}
                    style={{ padding: '6px 12px', fontSize: '0.7rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)', textTransform: 'capitalize',
                      background: statusFilter === f ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                      color: statusFilter === f ? '#818cf8' : '#475569' }}>
                    {f}
                  </button>
                ))}
              </div>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                style={{ padding: '6px 10px', fontSize: '0.72rem', borderRadius: '6px', background: 'rgba(0,0,0,0.3)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                <option value="date">Sort: Date</option>
                <option value="players">Sort: Players</option>
                <option value="score">Sort: Avg Score</option>
              </select>
            </div>

            {/* Session list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredSessions.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: '#475569' }}>No sessions match filters</div>}
              {filteredSessions.map(session => {
                const isExpanded = expandedSession === session.id;
                const players = sessionPlayers[session.id] || allPlayers.filter(p => p.sessionId === session.id);
                const active = players.filter(p => !p.isKicked);
                const finished = active.filter(p => p.hasFinished);
                const avg = finished.length ? Math.round(finished.reduce((s, p) => s + p.score, 0) / finished.length) : 0;
                const sc = session.status === 'active' ? '#10b981' : session.status === 'waiting' ? '#f59e0b' : '#ef4444';

                return (
                  <div key={session.id} style={{ borderRadius: '12px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                    <div onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                      style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flexWrap: 'wrap' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: sc, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{session.gameId === 'instrument-families' ? 'Instrument Families' : session.gameId}</span>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>PIN: {session.pin}</span>
                      <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '20px', background: `${sc}15`, color: sc, fontWeight: 600 }}>{session.status}</span>
                      <span style={{ fontSize: '0.68rem', color: '#475569' }}>{active.length}p</span>
                      {finished.length > 0 && <span style={{ fontSize: '0.68rem', color: '#34d399' }}>avg:{avg}%</span>}
                      <span style={{ color: '#333', fontSize: '0.68rem', marginLeft: 'auto' }}>{new Date(session.createdAt).toLocaleDateString()}</span>
                      <button onClick={(e) => { e.stopPropagation(); setEditingSession(session); }}
                        style={{ padding: '2px 8px', fontSize: '0.65rem', background: 'rgba(99,102,241,0.08)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '4px', cursor: 'pointer' }}>
                        ✏️
                      </button>
                      <span style={{ color: '#475569', fontSize: '0.8rem' }}>{isExpanded ? '▾' : '▸'}</span>
                    </div>

                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '12px 14px' }}>
                        {/* Quick controls */}
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                          <button onClick={() => updateSessionStatus(session.id, 'active')} style={{ padding: '5px 10px', fontSize: '0.7rem', borderRadius: '6px', background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)', cursor: 'pointer', fontWeight: 600 }}>▶ Activate</button>
                          <button onClick={() => updateSessionStatus(session.id, 'waiting')} style={{ padding: '5px 10px', fontSize: '0.7rem', borderRadius: '6px', background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)', cursor: 'pointer', fontWeight: 600 }}>⏸ Pause</button>
                          <button onClick={() => updateSessionStatus(session.id, 'finished')} style={{ padding: '5px 10px', fontSize: '0.7rem', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', fontWeight: 600 }}>🏁 End</button>
                          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/join?pin=${session.pin}`); toast.success('Link copied'); }}
                            style={{ padding: '5px 10px', fontSize: '0.7rem', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>📋 Link</button>
                          <button onClick={() => { for (const p of active) adminUpdatePlayer(p.id, { score: 0, hasFinished: false, progress: {} }); toast.success('Scores reset'); }}
                            style={{ padding: '5px 10px', fontSize: '0.7rem', borderRadius: '6px', background: 'rgba(245,158,11,0.08)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.15)', cursor: 'pointer', fontWeight: 600 }}>🔄 Reset Scores</button>
                          <button onClick={() => { for (const p of players.filter(p => p.isKicked)) adminUpdatePlayer(p.id, { isKicked: false }); toast.success('Unkicked'); }}
                            style={{ padding: '5px 10px', fontSize: '0.7rem', borderRadius: '6px', background: 'rgba(16,185,129,0.08)', color: '#34d399', border: '1px solid rgba(16,185,129,0.15)', cursor: 'pointer', fontWeight: 600 }}>✅ Unkick All</button>
                        </div>

                        <div style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '8px' }}>
                          {active.length} active • {finished.length} submitted • {players.filter(p => p.isKicked).length} kicked
                        </div>

                        {/* Player cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
                          {players.sort((a, b) => b.score - a.score).map(player => (
                            <div key={player.id}
                              onClick={() => setEditingPlayer(player)}
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', opacity: player.isKicked ? 0.4 : 1, transition: 'border-color 0.15s' }}
                              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)')}
                              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.03)')}>
                              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: player.hasFinished ? 'rgba(16,185,129,0.2)' : player.isKicked ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}>
                                {player.name.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {player.name} {player.isKicked && <span style={{ color: '#ef4444', fontSize: '0.6rem' }}>KICKED</span>}
                                </div>
                                <div style={{ fontSize: '0.65rem', color: '#475569' }}>
                                  {player.hasFinished ? `${player.score}%` : 'In progress'}
                                </div>
                              </div>
                              <span style={{ fontSize: '0.7rem', color: '#475569' }}>✏️</span>
                            </div>
                          ))}
                          {players.length === 0 && <div style={{ color: '#475569', fontSize: '0.75rem', padding: '8px' }}>No players</div>}
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ═══ PLAYERS TAB (Global View) ═══ */}
        {activeTab === 'players' && (
          <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <input className="input" placeholder="Search by name, ID, or session..." value={playerSearch} onChange={e => setPlayerSearch(e.target.value)}
                style={{ flex: 1, minWidth: '180px', padding: '8px 12px', fontSize: '0.82rem', borderRadius: '8px' }} />
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['all', 'finished', 'inprogress', 'kicked'] as const).map(f => (
                  <button key={f} onClick={() => setPlayerFilter(f)}
                    style={{ padding: '6px 10px', fontSize: '0.68rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)', textTransform: 'capitalize',
                      background: playerFilter === f ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                      color: playerFilter === f ? '#818cf8' : '#475569' }}>
                    {f === 'inprogress' ? 'In Progress' : f}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '8px' }}>{filteredPlayers.length} players</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '6px' }}>
              {filteredPlayers.map(player => (
                <div key={player.id} onClick={() => setEditingPlayer(player)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', opacity: player.isKicked ? 0.4 : 1 }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)')}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: player.hasFinished ? 'rgba(16,185,129,0.2)' : player.isKicked ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {player.name}
                      {player.isKicked && <span style={{ color: '#ef4444', fontSize: '0.65rem', marginLeft: '6px' }}>KICKED</span>}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#475569', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Session: {player.sessionId.slice(0, 12)}...
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: player.hasFinished ? '#34d399' : '#475569' }}>
                      {player.hasFinished ? `${player.score}%` : '—'}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#475569' }}>{player.hasFinished ? 'Done' : 'Working'}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ═══ ANALYTICS TAB ═══ */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Score Distribution */}
            <div style={{ padding: '1.2rem', borderRadius: '14px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: '#94a3b8' }}>📊 Score Distribution</h3>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '120px' }}>
                {[
                  { range: '0-20', color: '#ef4444' },
                  { range: '21-40', color: '#f59e0b' },
                  { range: '41-60', color: '#fbbf24' },
                  { range: '61-80', color: '#34d399' },
                  { range: '81-100', color: '#10b981' },
                ].map(({ range, color }) => {
                  const [min, max] = range.split('-').map(Number);
                  const count = allPlayers.filter(p => p.hasFinished && p.score >= min && p.score <= max).length;
                  const totalFinished = allPlayers.filter(p => p.hasFinished).length;
                  const height = totalFinished ? Math.max(8, (count / totalFinished) * 100) : 8;
                  return (
                    <div key={range} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>{count}</span>
                      <div style={{ width: '100%', height: `${height}%`, minHeight: '4px', background: `${color}30`, borderRadius: '4px 4px 0 0', border: `1px solid ${color}40` }} />
                      <span style={{ fontSize: '0.6rem', color: '#475569' }}>{range}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Players */}
            <div style={{ padding: '1.2rem', borderRadius: '14px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: '#94a3b8' }}>🏅 Top 10 Players (All Time)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {allPlayers.filter(p => p.hasFinished && !p.isKicked).sort((a, b) => b.score - a.score).slice(0, 10).map((p, i) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: i === 0 ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <span style={{ width: '24px', textAlign: 'center', fontSize: i < 3 ? '1rem' : '0.75rem', fontWeight: 700 }}>{i < 3 ? medals[i] : i + 1}</span>
                      <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600 }}>{p.name}</span>
                      <span style={{ fontWeight: 700, color: '#34d399', fontSize: '0.9rem' }}>{p.score}%</span>
                    </div>
                  );
                })}
                {allPlayers.filter(p => p.hasFinished).length === 0 && <div style={{ color: '#475569', fontSize: '0.78rem', padding: '1rem', textAlign: 'center' }}>No finished players yet</div>}
              </div>
            </div>

            {/* Session Activity Timeline */}
            <div style={{ padding: '1.2rem', borderRadius: '14px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: '#94a3b8' }}>📅 Session Timeline</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sessions.slice(0, 15).map(s => {
                  const sp = allPlayers.filter(p => p.sessionId === s.id);
                  const sc = s.status === 'active' ? '#10b981' : s.status === 'waiting' ? '#f59e0b' : '#475569';
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: sc, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.72rem', color: '#475569', width: '100px', flexShrink: 0 }}>{new Date(s.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 500 }}>{s.gameId === 'instrument-families' ? 'Instrument Families' : s.gameId}</span>
                      <span style={{ fontSize: '0.68rem', color: '#475569' }}>{sp.filter(p => !p.isKicked).length}p</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Facts */}
            <div style={{ padding: '1.2rem', borderRadius: '14px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: '#94a3b8' }}>⚡ Quick Facts</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>
                <div>🎮 Total sessions created: <strong style={{ color: '#e2e8f0' }}>{sessions.length}</strong></div>
                <div>👥 Total unique players: <strong style={{ color: '#e2e8f0' }}>{new Set(allPlayers.map(p => p.name)).size}</strong></div>
                <div>📝 Total submissions: <strong style={{ color: '#e2e8f0' }}>{allPlayers.filter(p => p.hasFinished).length}</strong></div>
                <div>🏆 Perfect scores: <strong style={{ color: '#e2e8f0' }}>{stats.perfectScores}</strong></div>
                <div>⛔ Total kicks: <strong style={{ color: '#e2e8f0' }}>{stats.kickedPlayers}</strong></div>
                <div>📊 Global average: <strong style={{ color: '#e2e8f0' }}>{stats.avgScore}%</strong></div>
                <div>🎯 Highest score: <strong style={{ color: '#e2e8f0' }}>{allPlayers.filter(p => p.hasFinished).sort((a, b) => b.score - a.score)[0]?.score || 0}%</strong></div>
                <div>📉 Lowest score: <strong style={{ color: '#e2e8f0' }}>{allPlayers.filter(p => p.hasFinished).length ? allPlayers.filter(p => p.hasFinished).sort((a, b) => a.score - b.score)[0]?.score : 0}%</strong></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {editingPlayer && (
          <PlayerModal player={editingPlayer} onClose={() => setEditingPlayer(null)} onSave={handleSavePlayer} onDelete={handleDeletePlayer} />
        )}
        {editingSession && (
          <SessionModal session={editingSession} onClose={() => setEditingSession(null)} onSave={handleSaveSession} onDelete={handleDeleteSession} />
        )}
      </AnimatePresence>
    </div>
  );
}
