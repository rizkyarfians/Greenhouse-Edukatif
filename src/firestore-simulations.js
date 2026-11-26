import {collection, doc, getDocs, getFirestore, runTransaction, serverTimestamp, setDoc} from 'firebase/firestore/lite';
import {readProject} from './simulation-storage.js';

export function firestoreSimulationStore({uid, firebase}) {
  const db = getFirestore(firebase.app);
  const projects = collection(db, 'automotionAccounts', uid, 'simulations');

  function fields(project) {
    const data = readProject(project.id, project);
    if (!data || data.name.length > 60) throw new Error('Data simulasi tidak valid.');
    const {id, updatedAt, ...record} = data;
    return {...record, updatedAt: serverTimestamp()};
  }

  return {
    async list() {
      const snapshot = await getDocs(projects);
      return snapshot.docs.map(entry => {
        const data = entry.data();
        return readProject(entry.id, {...data, updatedAt: data.updatedAt?.toMillis?.()});
      }).filter(Boolean);
    },
    save(project) {
      const data = fields(project);
      return setDoc(doc(projects, project.id), data);
    },
    copyIfMissing(project) {
      const data = fields(project);
      const target = doc(projects, project.id);
      return runTransaction(db, async transaction => {
        if ((await transaction.get(target)).exists()) return false;
        transaction.set(target, data);
        return true;
      });
    },
  };
}
