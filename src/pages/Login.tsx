import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { loginWithGoogle } from '../lib/auth';
import { toast } from 'sonner';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      toast.success('Successfully authenticated.');
      navigate('/teacher');
    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED') {
        toast.error('Unauthorized. Only registered educators can access this portal.');
      } else {
        toast.error('Authentication failed.');
      }
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{
          padding: '3rem',
          maxWidth: '440px',
          width: '100%',
          borderRadius: '24px',
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          textAlign: 'center',
        }}
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ fontSize: '2.8rem', marginBottom: '1.2rem' }}
        >
          🎵
        </motion.div>

        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.3rem', letterSpacing: '-0.02em' }}>Music Activities</h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem' }}>Educator Command Center</p>

        <button
          className="btn"
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '1rem',
            borderRadius: '12px',
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {loading ? (
            <div className="spinner" style={{ width: '20px', height: '20px' }} />
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </>
          )}
        </button>

        <p style={{ color: '#334155', fontSize: '0.75rem', marginTop: '1.5rem' }}>
          Access restricted to authorized educators
        </p>
      </motion.div>
    </div>
  );
}
