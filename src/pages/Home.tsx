import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: '2rem' }}>

      {/* Animated background orbs */}
      <motion.div
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: '-15%', left: '-10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 60%)', zIndex: 0, pointerEvents: 'none' }}
      />
      <motion.div
        animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: '45vw', height: '45vw', background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 60%)', zIndex: 0, pointerEvents: 'none' }}
      />
      <motion.div
        animate={{ x: [0, 15, 0], y: [0, 15, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: '30%', right: '20%', width: '30vw', height: '30vw', background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 60%)', zIndex: 0, pointerEvents: 'none' }}
      />

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        style={{ textAlign: 'center', position: 'relative', zIndex: 1, maxWidth: '680px' }}
      >
        {/* Icon */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ fontSize: '4.5rem', marginBottom: '1.5rem', filter: 'drop-shadow(0 8px 24px rgba(99,102,241,0.25))' }}
        >
          🎸
        </motion.div>

        {/* Title */}
        <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4.2rem)', fontWeight: 900, marginBottom: '1rem', lineHeight: 1.1, letterSpacing: '-0.03em' }}>
          Music{' '}
          <span style={{ background: 'linear-gradient(135deg, #818cf8, #ec4899, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Activities
          </span>
        </h1>

        {/* Subtitle */}
        <p style={{ color: '#64748b', fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', maxWidth: '520px', margin: '0 auto 2.5rem auto', lineHeight: 1.7 }}>
          The interactive platform for real-time music education. Host live activities directly to your students' devices.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
            <Link
              to="/join"
              className="btn"
              style={{
                padding: '16px 40px',
                fontSize: '1.05rem',
                borderRadius: '14px',
                boxShadow: '0 8px 28px rgba(99,102,241,0.3)',
                textDecoration: 'none',
              }}
            >
              🎵 Join Activity
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
            <Link
              to="/login"
              className="btn btn-ghost"
              style={{
                padding: '16px 40px',
                fontSize: '1.05rem',
                borderRadius: '14px',
                textDecoration: 'none',
              }}
            >
              Educator Portal →
            </Link>
          </motion.div>
        </div>

        {/* Subtle tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          style={{ color: '#334155', fontSize: '0.78rem', marginTop: '3rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}
        >
          Built for classrooms • Real-time sync • Zero setup
        </motion.p>
      </motion.div>
    </div>
  );
}
