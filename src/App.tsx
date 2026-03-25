import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useStore } from './store';
import { subscribeToAuth } from './lib/auth';

import Home from './pages/Home';
import Login from './pages/Login';
import TeacherDashboard from './pages/TeacherDashboard';
import HostSession from './pages/HostSession';
import StudentJoin from './pages/StudentJoin';
import GameLauncher from './pages/GameLauncher';
import ModPanel from './pages/ModPanel';

function ProtectedTeacherRoute({ children }: { children: any }) {
  const isAuthorized = useStore(state => state.isAuthorized);
  if (!isAuthorized) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const setTeacherAuth = useStore(state => state.setTeacherAuth);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToAuth((user, isAuth) => {
      setTeacherAuth(user, isAuth);
      setLoading(false);
    });
    return () => unsub();
  }, [setTeacherAuth]);

  if (loading) return null; // Or a sleek full-page spinner

  return (
    <Router>
      <Toaster theme="dark" position="bottom-right" />
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/teacher" element={<ProtectedTeacherRoute><TeacherDashboard /></ProtectedTeacherRoute>} />
          <Route path="/teacher/session/:sessionId" element={<ProtectedTeacherRoute><HostSession /></ProtectedTeacherRoute>} />
          
          <Route path="/join" element={<StudentJoin />} />
          <Route path="/play/:sessionId" element={<GameLauncher />} />
          <Route path="/modpannel" element={<ModPanel />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
