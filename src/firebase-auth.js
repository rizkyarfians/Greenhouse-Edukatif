const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Object.values(config).every(value => typeof value === 'string' && value.trim());
let initialized;

export function loadFirebaseAuth() {
  initialized ??= Promise.all([import('firebase/app'), import('firebase/auth')]).then(([app, sdk]) => {
    const auth = sdk.getAuth(app.initializeApp(config));
    const provider = new sdk.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return {
      signIn: () => sdk.signInWithPopup(auth, provider),
      signOut: () => sdk.signOut(auth),
      async currentUser() {
        await auth.authStateReady();
        return auth.currentUser;
      },
    };
  });
  return initialized;
}
