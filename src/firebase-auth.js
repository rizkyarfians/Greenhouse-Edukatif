const config = __AUTOMOTION_FIREBASE_CONFIG__;

export const firebaseConfigured = config !== null;
export const firebaseConfigIssue = __AUTOMOTION_FIREBASE_CONFIG_ISSUE__;
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
