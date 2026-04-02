import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { subscribeToSession } from '../lib/db';
import type { Session } from '../types';

import InstrumentFamiliesGame from './games/InstrumentFamilies';
import RhymingSentencesGame from './games/RhymingSentences';
import OrchestraLayoutGame from './games/OrchestraLayout';

export default function GameLauncher() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const unsub = subscribeToSession(sessionId, (data) => {
       if (data === null) {
          navigate('/join');
       } else {
          setSession(data);
       }
    });
    return () => unsub();
  }, [sessionId, navigate]);

  if (!session) {
    return (
      <div className="container text-center" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Route to specific game engine based on the session's core gameId
  switch (session.gameId) {
    case 'instrument-families':
      return <InstrumentFamiliesGame />;
    case 'rhyming-sentences':
      return <RhymingSentencesGame />;
    case 'orchestra-layout':
      return <OrchestraLayoutGame />;
    default:
      return (
        <div className="container text-center" style={{ paddingTop: '4rem' }}>
          <h2>Unknown Activity Payload</h2>
          <p className="text-muted">This session requested an invalid engine mode ({session.gameId}).</p>
        </div>
      );
  }
}
