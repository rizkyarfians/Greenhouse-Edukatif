# Kebun Melon

Dashboard edukasi greenhouse 8 × 20 m dengan model yang bisa diputar, di-zoom, dan dibuka atapnya. Pilih Zona A atau B dan gunakan **Coba siram** untuk melihat pipa aktif, status pompa, level tandon, dan kelembapan media berubah. Siklus berhenti otomatis setelah 7,5 detik. Semua angka adalah data simulasi, tanpa koneksi ke sensor atau aktuator.

## Menjalankan dari source

```sh
npm ci
npm run dev
```

`npm run build` menghasilkan situs statis di `dist/`. Paket unduhan juga menyertakan hasil build. Untuk membuka hasil build secara lokal, jalankan server HTTP dari direktori proyek, misalnya `python3 -m http.server 8000 --directory dist`, lalu buka http://localhost:8000. Model GLB ada di `public/greenhouse.glb`.

Viewer menggunakan WebGL jika tersedia. Jika perangkat tidak menyediakan WebGL, viewer memakai renderer Canvas dengan warna dan geometri yang disederhanakan.

## Land Scanner — Cycle 1

Buka **Scan Lahan** dari dashboard. Kamera merupakan bantuan visual; GPS mengukur posisi ponsel saat tombol tambah patok ditekan. Datangi setiap batas berurutan, koreksi koordinat bila perlu, lalu simpan profil lokal atau ekspor GeoJSON. Kamera/GPS memerlukan HTTPS atau localhost; pada HP melalui IP lokal HTTP, gunakan koordinat manual atau deploy HTTPS. Data tidak dikirim ke server. Satu profil guest tersimpan per browser. Sketsa bukan citra satelit. Estimasi geometri menggunakan bidang singgung lokal (batas 10 km), bukan survei resmi.

Tes geometri: `node --test tests/land-geometry.test.js`. Build: `npm run build` menghasilkan index.html dan scan.html.
