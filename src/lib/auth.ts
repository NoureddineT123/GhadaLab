import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

const ALLOWED_EMAILS = ['ghadanahouli@gmail.com', 'aasiandadyt@gmail.com'];

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (!result.user.email || !ALLOWED_EMAILS.includes(result.user.email)) {
      // Force sign out immediately if unauthorized
      await auth.signOut();
      throw new Error('UNAUTHORIZED');
    }
    return result.user;
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      throw error;
    }
    console.error("Auth Error:", error);
    throw new Error('Authentication failed');
  }
}

export async function logout() {
  return signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null, isAuthorized: boolean) => void) {
  return onAuthStateChanged(auth, (user) => {
    if (user && user.email && ALLOWED_EMAILS.includes(user.email)) {
      callback(user, true);
    } else {
      callback(null, false);
    }
  });
}
