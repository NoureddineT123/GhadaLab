import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession } from '../lib/db';
import { logout } from '../lib/auth';
import { useStore } from '../store';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function TeacherDashboard() {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const teacher = useStore(state => state.teacher);
  const navigate = useNavigate();

  const handleLaunchTemplate = async (gameId: string, templateName: string) => {
    setLoadingId(gameId);
    try {
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      const sessionId = await createSession(teacher?.uid || 'teacher-1', gameId, pin);
      navigate(`/teacher/session/${sessionId}`);
      toast.success(`Launched ${templateName}!`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to provision session.');
      setLoadingId(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="container" style={{ maxWidth: '1200px', paddingTop: '2rem' }}>

        {/* ── Header ── */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '4px', letterSpacing: '-0.02em' }}>
              <span style={{ background: 'linear-gradient(135deg, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Command Center</span>
            </h2>
            <p style={{ color: '#475569', fontSize: '0.85rem' }}>Logged in as {teacher?.email}</p>
          </div>
          <button className="btn btn-ghost" onClick={() => logout()} style={{ padding: '10px 20px', fontSize: '0.85rem', borderRadius: '10px' }}>
            Sign Out
          </button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', alignItems: 'start' }}>

          {/* ── Activity Library ── */}
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#94a3b8' }}>Activity Library</h3>
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>

              {/* Instrument Families */}
              <motion.div
                whileHover={{ y: -4, borderColor: 'rgba(99,102,241,0.3)' }}
                transition={{ duration: 0.2 }}
                style={{
                  padding: '1.5rem',
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.03))',
                  border: '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                    🎺
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Instrument Families</h4>
                    <span className="badge badge-primary" style={{ marginTop: '4px' }}>Drag & Drop</span>
                  </div>
                </div>
                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.2rem' }}>
                  Students categorize 22 instruments into Strings, Wind, and Percussion families. Auto-graded on submit.
                </p>
                <button
                  className="btn"
                  onClick={() => handleLaunchTemplate('instrument-families', 'Instrument Families')}
                  disabled={loadingId !== null}
                  style={{ width: '100%', borderRadius: '12px', padding: '12px', fontSize: '0.9rem' }}
                >
                  {loadingId === 'instrument-families' ? (
                    <div className="spinner" style={{ width: '18px', height: '18px' }} />
                  ) : (
                    '🚀 Launch Activity'
                  )}
                </button>
              </motion.div>

            </div>
          </div>

          {/* ── Sidebar ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Recent Sessions */}
            <div style={{
              padding: '1.5rem',
              borderRadius: '20px',
              background: 'rgba(15,23,42,0.5)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#94a3b8' }}>Recent Sessions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '0.88rem' }}>Instrument Families</strong>
                    <span style={{ color: '#475569', fontSize: '0.75rem' }}>Yesterday</span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.78rem' }}>24 Students • 86% Avg.</div>
                </div>
              </div>
            </div>

            {/* Weekly Stats */}
            <div style={{
              padding: '1.5rem',
              borderRadius: '20px',
              background: 'rgba(15,23,42,0.5)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#94a3b8' }}>Weekly Insights</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ padding: '12px', background: 'rgba(99,102,241,0.06)', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(99,102,241,0.1)' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#818cf8', lineHeight: 1 }}>48</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Students</div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(16,185,129,0.06)', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(16,185,129,0.1)' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399', lineHeight: 1 }}>3</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Sessions</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
