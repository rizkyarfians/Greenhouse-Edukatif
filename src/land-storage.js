import {currentSession} from './account-session.js';
import {accountStorageApi} from './account-storage-api.js';
import {landProfile, landStorageKey} from './land-profile.js';

export function browserLand() {
  const data = JSON.parse(localStorage.getItem(landStorageKey) ?? 'null');
  const profile = landProfile(data);
  if (data && !profile) throw new Error('Profil browser tidak valid');
  return profile ? {...profile, updatedAt: data.updatedAt} : null;
}

export async function landStore() {
  const account = await currentSession();
  if (account && account.mode !== 'guest') {
    const request = accountStorageApi(account);
    return {
      account,
      load: () => request('land'),
      save: (profile, revision) => request('land', {method: 'PUT', body: {profile, revision}}),
      remove: revision => request('land', {method: 'DELETE', body: {revision}}),
    };
  }
  return {
    load: () => ({profile: browserLand(), revision: null}),
    save(profile) {
      const saved = {...profile, updatedAt: new Date().toISOString()};
      localStorage.setItem(landStorageKey, JSON.stringify(saved));
      return {profile: saved, revision: null};
    },
    remove: () => localStorage.removeItem(landStorageKey),
  };
}

export async function loadLand() {
  const store = await landStore();
  return (await store.load()).profile;
}
