import {firebaseConfigured, loadFirebaseAuth} from './firebase-auth.js';

export async function currentSession() {
  try {
    if (new URLSearchParams(location.search).get('account') === 'google') {
      sessionStorage.removeItem('automotion.guest');
    }
    if (sessionStorage.getItem('automotion.guest') === '1') return {mode: 'guest', name: 'Mode tamu'};
  } catch {
    // Browser storage can be unavailable even when authentication works.
  }

  if (firebaseConfigured) {
    const firebase = await loadFirebaseAuth();
    const user = await firebase.currentUser();
    if (user) return {mode: 'firebase', name: user.displayName || user.email || 'Akun Google', uid: user.uid, firebase};
  } else {
    const response = await fetch('/api/auth/session', {signal: AbortSignal.timeout(4000)});
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const {user} = await response.json();
      if (user) return {mode: 'server', name: user.name || user.email || 'Akun Google', uid: user.sub};
    }
  }
  return null;
}
