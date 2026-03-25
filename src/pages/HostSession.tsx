import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { subscribeToSession, subscribeToPlayers, updateSessionStatus, kickPlayer } from '../lib/db';
import type { Session, SessionPlayer } from '../types';

export default function HostSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [students, setStudents] = useState<SessionPlayer[]>([]);

  useEffect(() => {
    if (!sessionId) return;
    const unsubSession = subscribeToSession(sessionId, setSession);
    const unsubPlayers = subscribeToPlayers(sessionId, setStudents);
    return () => { unsubSession(); unsubPlayers(); };
  }, [sessionId]);

  const handleCopyLink = () => {
    if (!session?.pin) return;
    const joinUrl = `${window.location.origin}/join?pin=${session.pin}`;
    navigator.clipboard.writeText(joinUrl);
    toast.success('Join link copied!');
  };

  const handleStatusChange = async (status: Session['status']) => {
    if (!sessionId) return;
    await updateSessionStatus(sessionId, status);
    toast.success(`Session is now ${status}`);
  };

  if (!session) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: '36px', height: '36px' }} />
    </div>
  );

  const activeStudents = students.filter(s => !s.isKicked);
  const finishedStudents = activeStudents.filter(s => s.hasFinished);
  const avgScore = finishedStudents.length > 0 ? Math.round(finishedStudents.reduce((sum, s) => sum + s.score, 0) / finishedStudents.length) : 0;

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="container animate-fade-in" style={{ maxWidth: '1280px', paddingTop: '1.5rem' }}>

        {/* ── Header ── */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div>
            <button className="btn btn-ghost mb-3" onClick={() => navigate('/teacher')} style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px', marginBottom: '8px' }}>
              ← Back
            </button>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              <span style={{ background: 'linear-gradient(135deg, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {session.gameId === 'instrument-families' ? 'Instrument Families' : session.gameId}
              </span>
            </h2>
            <p style={{ color: '#475569', fontSize: '0.85rem', marginTop: '2px' }}>Live Session Control</p>
          </div>

          {/* PIN Display */}
          <div style={{
            padding: '1rem 1.5rem',
            borderRadius: '16px',
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.15)',
            textAlign: 'center',
            minWidth: '180px',
          }}>
            <div style={{ fontSize: '0.7rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Join PIN</div>
            <div style={{ fontSize: '2.4rem', fontWeight: 900, letterSpacing: '6px', lineHeight: 1, color: 'white' }}>{session.pin}</div>
            <button
              onClick={handleCopyLink}
              style={{ marginTop: '6px', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}
            >
              Copy Link
            </button>
          </div>
        </header>

        {/* ── Control Bar ── */}
        <div style={{
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          borderRadius: '14px',
          background: 'rgba(15,23,42,0.5)',
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span className={`badge ${session.status === 'active' ? 'badge-success' : session.status === 'finished' ? 'badge-danger' : 'badge-warning'}`}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
              {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
            </span>
            <span className="badge badge-primary">
              {activeStudents.length} Connected
            </span>
            {finishedStudents.length > 0 && (
              <span className="badge badge-success">
                {finishedStudents.length} Submitted • Avg: {avgScore}%
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {session.status === 'waiting' && (
              <button className="btn" onClick={() => handleStatusChange('active')} style={{ padding: '8px 20px', fontSize: '0.85rem', borderRadius: '10px' }}>
                🚀 Start
              </button>
            )}
            {session.status === 'active' && (
              <>
                <button className="btn btn-ghost" onClick={() => handleStatusChange('waiting')} style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '10px', borderColor: 'rgba(245,158,11,0.3)', color: '#f59e0b' }}>
                  ⏸ Pause
                </button>
                <button className="btn btn-danger" onClick={() => handleStatusChange('finished')} style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '10px' }}>
                  🏁 End Round
                </button>
              </>
            )}
            {session.status === 'finished' && (
              <button className="btn" onClick={() => handleStatusChange('waiting')} style={{ padding: '8px 20px', fontSize: '0.85rem', borderRadius: '10px' }}>
                🔄 Reset
              </button>
            )}
          </div>
        </div>

        {/* ── Leaderboard (visible when students submit) ── */}
        {finishedStudents.length > 0 && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '1.5rem',
            borderRadius: '16px',
            background: 'rgba(15,23,42,0.5)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🏆</span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Leaderboard</h3>
              <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{finishedStudents.length}/{activeStudents.length} submitted</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[...finishedStudents].sort((a, b) => b.score - a.score).map((student, idx) => {
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: idx === 0 ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                      border: idx === 0 ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(255,255,255,0.03)',
                    }}
                  >
                    <span style={{ width: '28px', textAlign: 'center', fontSize: idx < 3 ? '1.2rem' : '0.85rem', fontWeight: 700, color: idx < 3 ? 'white' : '#64748b' }}>
                      {idx < 3 ? medals[idx] : `${idx + 1}`}
                    </span>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: idx === 0 ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '0.8rem', color: 'white', flexShrink: 0,
                    }}>
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem' }}>{student.name}</span>
                    <span style={{ fontWeight: 700, color: '#34d399', fontSize: '0.95rem' }}>{student.score}%</span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Student Grid ── */}
        <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {activeStudents.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: '#475569' }}>
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2, repeat: Infinity }} style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.4 }}>👀</motion.div>
              <p>Waiting for students to join...</p>
            </div>
          ) : (
            activeStudents.map((student, idx) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                style={{
                  padding: '1.2rem',
                  borderRadius: '16px',
                  background: 'rgba(15,23,42,0.5)',
                  border: student.hasFinished ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: student.hasFinished ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6366f1, #4338ca)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '0.9rem', color: 'white', flexShrink: 0,
                    }}>
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{student.name}</span>
                      {student.hasFinished && <span className="badge badge-success" style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '0.65rem' }}>Done</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => kickPlayer(student.id)}
                    style={{ padding: '4px 10px', fontSize: '0.7rem', background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Kick
                  </button>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Score</span>
                    <span style={{ fontWeight: 700, color: student.hasFinished ? '#34d399' : '#64748b', fontSize: '0.9rem' }}>
                      {student.hasFinished ? `${student.score}%` : '—'}
                    </span>
                  </div>

                  {student.hasFinished ? (
                    <div style={{ fontSize: '0.75rem', color: '#475569', maxHeight: '80px', overflowY: 'auto' }}>
                      {Object.entries(student.progress || {}).map(([instrument, cat]) => (
                        <div key={instrument} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <span>{instrument}</span>
                          <span style={{ opacity: 0.6 }}>→ {String(cat)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: '30%', height: '100%', background: 'var(--primary)', borderRadius: '2px', opacity: 0.5 }} />
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
