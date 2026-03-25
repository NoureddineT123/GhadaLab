import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  addDoc,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { db } from './firebase';
import type { Session, SessionPlayer } from '../types';

// References
const SESSIONS_COL = 'sessions';
const PLAYERS_COL = 'session_players';

/**
 * Creates a new game session
 */
export async function createSession(teacherId: string, gameId: string, pin: string) {
  const sessionData: Partial<Session> = {
    teacherId,
    gameId,
    status: 'waiting',
    pin,
    gameState: { startedAt: Date.now(), currentRound: 0 },
    createdAt: Date.now()
  };
  
  const docRef = await addDoc(collection(db, SESSIONS_COL), sessionData);
  return docRef.id;
}

/**
 * Listen to a session's state changes
 */
export function subscribeToSession(sessionId: string, callback: (session: Session | null) => void) {
  return onSnapshot(doc(db, SESSIONS_COL, sessionId), (docSnapshot) => {
    if (docSnapshot.exists()) {
      callback({ id: docSnapshot.id, ...docSnapshot.data() } as Session);
    } else {
      callback(null);
    }
  });
}

/**
 * Find session by PIN
 */
export async function getSessionByPin(pin: string): Promise<Session | null> {
  const q = query(collection(db, SESSIONS_COL), where("pin", "==", pin));
  return new Promise((resolve) => {
    const unsubscribe = onSnapshot(q, (snapshot) => {
      unsubscribe();
      if (!snapshot.empty) {
        resolve({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Session);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Update session state (Teacher only via UI/Rules)
 */
export async function updateSessionStatus(sessionId: string, status: 'waiting' | 'active' | 'finished') {
  await updateDoc(doc(db, SESSIONS_COL, sessionId), { status });
}

/**
 * Join session
 */
export async function joinSession(sessionId: string, name: string, deviceId: string) {
  // Kick old sessions from the same device
  const q = query(collection(db, PLAYERS_COL), where("sessionId", "==", sessionId), where("deviceId", "==", deviceId));
  const snapshot = await getDocs(q);
  
  snapshot.forEach(async (d) => {
    if (!d.data().isKicked) {
      await updateDoc(doc(db, PLAYERS_COL, d.id), { isKicked: true });
    }
  });

  // Create unique ID to avoid overwriting and relying on name strictly, since we now rely on deviceId
  const playerId = `${sessionId}_${name.replace(/\s+/g, '')}_${Date.now()}`;
  const playerRef = doc(db, PLAYERS_COL, playerId);
  
  await setDoc(playerRef, {
    sessionId,
    name,
    deviceId,
    score: 0,
    progress: {},
    isKicked: false,
    hasFinished: false,
    joinedAt: serverTimestamp()
  });
  
  return playerId;
}

/**
 * Listen to all players in a session (Teacher view)
 */
export function subscribeToPlayers(sessionId: string, callback: (players: SessionPlayer[]) => void) {
  const q = query(collection(db, PLAYERS_COL), where("sessionId", "==", sessionId));
  return onSnapshot(q, (snapshot) => {
    const players: SessionPlayer[] = [];
    snapshot.forEach((doc) => players.push({ id: doc.id, ...doc.data() } as SessionPlayer));
    callback(players);
  });
}

/**
 * Listen to single player state (Student view)
 */
export function subscribeToPlayer(playerId: string, callback: (player: SessionPlayer | null) => void) {
  return onSnapshot(doc(db, PLAYERS_COL, playerId), (docSnapshot) => {
    if (docSnapshot.exists()) {
      callback({ id: docSnapshot.id, ...docSnapshot.data() } as SessionPlayer);
    } else {
      callback(null);
    }
  });
}

/**
 * Kick player
 */
export async function kickPlayer(playerId: string) {
  await updateDoc(doc(db, PLAYERS_COL, playerId), { isKicked: true });
}

/**
 * Update player progress (called directly upon drop/finish events)
 */
export async function updatePlayerProgress(playerId: string, score: number, progress: any, hasFinished: boolean = false) {
  await updateDoc(doc(db, PLAYERS_COL, playerId), {
    score,
    progress,
    hasFinished
  });
}

/**
 * Subscribe to ALL sessions (Admin only)
 */
export function subscribeToAllSessions(callback: (sessions: Session[]) => void) {
  return onSnapshot(collection(db, SESSIONS_COL), (snapshot) => {
    const sessions: Session[] = [];
    snapshot.forEach((d) => sessions.push({ id: d.id, ...d.data() } as Session));
    sessions.sort((a, b) => b.createdAt - a.createdAt);
    callback(sessions);
  });
}

// ── Admin CRUD ──

/** Update any player fields */
export async function adminUpdatePlayer(playerId: string, data: Partial<SessionPlayer>) {
  await updateDoc(doc(db, PLAYERS_COL, playerId), data as any);
}

/** Update any session fields */
export async function adminUpdateSession(sessionId: string, data: Partial<Session>) {
  await updateDoc(doc(db, SESSIONS_COL, sessionId), data as any);
}

/** Delete a session */
export async function adminDeleteSession(sessionId: string) {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, SESSIONS_COL, sessionId));
}

/** Delete a player */
export async function adminDeletePlayer(playerId: string) {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, PLAYERS_COL, playerId));
}

/** Subscribe to ALL players across all sessions */
export function subscribeToAllPlayers(callback: (players: SessionPlayer[]) => void) {
  return onSnapshot(collection(db, PLAYERS_COL), (snapshot) => {
    const players: SessionPlayer[] = [];
    snapshot.forEach((d) => players.push({ id: d.id, ...d.data() } as SessionPlayer));
    callback(players);
  });
}

