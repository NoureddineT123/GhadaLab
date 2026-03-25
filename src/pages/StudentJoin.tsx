import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getSessionByPin, joinSession, subscribeToSession, subscribeToPlayer } from '../lib/db';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function StudentJoin() {
  const [searchParams] = useSearchParams();
  const [pin, setPin] = useState(searchParams.get('pin') || '');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [inLobby, setInLobby] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);
  const navigate = useNavigate();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 6 || name.length < 2) return;

    setLoading(true);
    try {
      const session = await getSessionByPin(pin);
      if (!session) {
        toast.error('Invalid Game PIN! Check the board.');
        setLoading(false);
        return;
      }
      let deviceId = localStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('deviceId', deviceId);
      }
      const pid = await joinSession(session.id, name, deviceId);
      localStorage.setItem('currentPlayerId', pid);
      setActiveSession(session);
      setLoading(false);
      setInLobby(true);
      toast.success('Joined successfully!');
    } catch (e) {
      console.error(e);
      toast.error('Connection error. Please try again.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (inLobby && activeSession) {
      const unsub = subscribeToSession(activeSession.id, (session) => {
        if (session?.status === 'active') {
          navigate(`/play/${session.id}`);
        }
      });
      return () => unsub();
    }
  }, [inLobby, activeSession, navigate]);

  useEffect(() => {
    const playerId = localStorage.getItem('currentPlayerId');
    if (inLobby && playerId) {
      const unsubPlayer = subscribeToPlayer(playerId, (player) => {
        if (player?.isKicked) {
          toast.error('You have been kicked by the teacher.');
          localStorage.removeItem('currentPlayerId');
          navigate('/');
        }
      });
      return () => unsubPlayer();
    }
  }, [inLobby, navigate]);

  // ── Lobby Waiting Screen ──
  if (inLobby) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{
            padding: '3rem',
            maxWidth: '440px',
            width: '100%',
            textAlign: 'center',
            borderRadius: '24px',
            background: 'rgba(15,23,42,0.7)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          }}
        >
          {/* Avatar */}
          <motion.div
            animate={{ boxShadow: ['0 0 20px rgba(99,102,241,0.2)', '0 0 40px rgba(99,102,241,0.4)', '0 0 20px rgba(99,102,241,0.2)'] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              width: '72px', height: '72px', margin: '0 auto 1.5rem auto', borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #4338ca)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem', fontWeight: 800, color: 'white',
            }}
          >
            {name.charAt(0).toUpperCase()}
          </motion.div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.3rem' }}>You're in, {name}!</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem' }}>See your name on the classroom board?</p>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '10px 20px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="spinner" style={{ width: '16px', height: '16px' }} />
            <span style={{ color: '#94a3b8', fontSize: '0.88rem' }}>Waiting for teacher to start...</span>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Join Form ──
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{
          padding: '2.5rem',
          maxWidth: '420px',
          width: '100%',
          borderRadius: '24px',
          background: 'rgba(15,23,42,0.7)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #6366f1, #ec4899, #8b5cf6)' }} />

        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.3rem', textAlign: 'center' }}>Join Session</h2>
        <p style={{ color: '#64748b', textAlign: 'center', fontSize: '0.9rem', marginBottom: '2rem' }}>Enter the PIN on the board</p>

        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Game PIN</label>
            <input
              type="text"
              placeholder="123456"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="input"
              style={{ fontSize: '1.4rem', letterSpacing: '8px', textAlign: 'center', fontWeight: 700, padding: '16px' }}
              readOnly={loading}
              autoFocus
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Name</label>
            <input
              type="text"
              placeholder="First Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              style={{ fontSize: '1.05rem', padding: '14px 18px' }}
              readOnly={loading}
            />
          </div>

          <button
            type="submit"
            className="btn"
            disabled={loading || pin.length < 6 || name.length < 2}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '1rem',
              borderRadius: '12px',
              marginTop: '0.5rem',
              display: 'flex',
              justifyContent: 'center',
              opacity: (loading || pin.length < 6 || name.length < 2) ? 0.5 : 1,
            }}
          >
            {loading ? <div className="spinner" style={{ width: '20px', height: '20px' }} /> : '🚀 Enter Lobby'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
