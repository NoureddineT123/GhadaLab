import { create } from 'zustand';
import type { User } from 'firebase/auth';

interface AppState {
  teacher: User | null;
  isAuthorized: boolean;
  setTeacherAuth: (teacher: User | null, isAuthorized: boolean) => void;
  soundEnabled: boolean;
  toggleSound: () => void;
}

export const useStore = create<AppState>((set) => ({
  teacher: null,
  isAuthorized: false,
  setTeacherAuth: (teacher, isAuthorized) => set({ teacher, isAuthorized }),
  soundEnabled: true,
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
}));
