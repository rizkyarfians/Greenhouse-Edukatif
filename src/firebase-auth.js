const config = __AUTOMOTION_FIREBASE_CONFIG__;

export const firebaseConfigured = config !== null;
export const firebaseConfigIssue = __AUTOMOTION_FIREBASE_CONFIG_ISSUE__;
let initialized;

export function loadFirebaseAuth() {
  initialized ??= Promise.all([import('firebase/app'), import('firebase/auth')]).then(([app, sdk]) => {
    const firebaseApp = app.initializeApp(config);
    const auth = sdk.getAuth(firebaseApp);
    const provider = new sdk.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return {
      app: firebaseApp,
      watchUser: listener => sdk.onAuthStateChanged(auth, listener),
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
