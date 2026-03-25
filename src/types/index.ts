export interface User {
  uid: string;
  email: string;
  displayName: string;
}

export interface GameDefinition {
  id: string;
  title: string;
  type: string;
  config: any;
}

export interface GameState {
  startedAt?: number;
  currentRound?: number;
  [key: string]: any;
}

export interface Session {
  id: string;
  teacherId: string;
  classId?: string;
  gameId: string;
  status: 'waiting' | 'active' | 'finished';
  pin: string;
  gameState: GameState;
  createdAt: number;
}

export interface SessionPlayer {
  id: string; // usually a combined id of session+name or generated
  sessionId: string;
  name: string;
  score: number;
  progress: any;
  isKicked: boolean;
  hasFinished: boolean;
  joinedAt: number;
}

// The Game Engine setup
export interface GameEngine {
  init(session: Session): void;
  onPlayerAction(playerId: string, action: any): void;
  getState(): GameState;
  calculateScore(playerId: string): number;
}
