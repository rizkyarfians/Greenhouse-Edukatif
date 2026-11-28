export function accountStorageApi(account) {
  return async (path, {method = 'GET', body} = {}) => {
    const headers = {Accept: 'application/json'};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (account.mode === 'firebase') {
      const user = await account.firebase.currentUser();
      if (user?.uid !== account.uid) throw Object.assign(new Error('Account changed'), {status: 401});
      headers.Authorization = 'Bearer ' + await user.getIdToken();
    }
    const response = await fetch('/api/storage/' + path, {method, headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store', signal: AbortSignal.timeout(12_000)});
    if (response.status === 204) return;
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json().catch(() => ({}));
      throw Object.assign(new Error('Penyimpanan akun gagal'), {status: response.status, code: data?.error});
    }
    return response.json();
  };
}

export function accountSimulationStore(account) {
  const request = accountStorageApi(account);
  function save(project, copy = false) {
    return request('simulations/' + project.id + (copy ? '?copy=1' : ''), {method: 'PUT', body: project});
  }
  return {
    list: () => request('simulations'),
    save,
    async copyIfMissing(project) {
      return (await save(project, true)).saved;
    },
  };
}

export function storageError(error, action) {
  if (error?.status === 401) return 'Sesi akun berakhir. Masuk kembali lalu coba lagi.';
  if (error?.code === 'firebase-auth-unconfigured') return 'Login Google belum terhubung ke server penyimpanan.';
  if (error?.status === 404 || error?.status === 405) return 'API penyimpanan belum tersedia. Buka aplikasi dari alamat server Fastify.';
  if (error?.status === 403) return 'Server menolak akses simpanan akun.';
  return 'Gagal ' + action + '. Periksa koneksi dan coba lagi.';
}
