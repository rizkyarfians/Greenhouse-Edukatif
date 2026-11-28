import './dashboard-account.css';
import {headerAccount, setHeaderAccount} from './app-header.js';
import {currentSession} from './account-session.js';

const content = document.getElementById('dashboard-content');
const loading = document.getElementById('dashboard-loading');

function revealDashboard() {
  loading.hidden = true;
  content.hidden = false;
}

export const dashboardAccount = headerAccount.then(session => {
  if (!session) {
    location.replace('./index.html');
    return null;
  }
  revealDashboard();
  session.firebase?.watchUser(user => {
    if (user?.uid === session.uid) return;
    content.hidden = true;
    loading.hidden = false;
    location.reload();
  });
  return session;
});

window.addEventListener('pageshow', async event => {
  if (!event.persisted) return;
  content.hidden = true;
  loading.hidden = false;
  const previous = await dashboardAccount;
  const current = await currentSession().catch(() => null);
  if (!current) {
    location.replace('./index.html');
  } else if (previous?.mode === current.mode && previous?.uid === current.uid &&
             previous?.mode !== 'server') {
    setHeaderAccount(current);
    revealDashboard();
  } else {
    location.reload();
  }
});
