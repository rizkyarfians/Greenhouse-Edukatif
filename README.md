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

**Buka kamera** memenuhi viewport dengan tombol **Tambah patok GPS**, **Hapus terakhir**, dan **Tutup**. Saat titik direkam, status kamera menampilkan patok tersimpan. Tiang 3D dirender hanya apabila koordinat patok bisa diproyeksikan ke gambar dengan GPS dan kompas yang tersedia. Label tetap tersedia di perangkat tanpa WebGL. Jika GPS dan kompas tersedia, pin patok yang sudah direkam muncul di arah perkiraan pada kamera. Gunakan **Izinkan kompas HP** jika browser meminta izin sensor lewat ketukan. Jika pin belum bisa diproyeksikan, tampilan kamera tetap mengonfirmasi patok terakhir yang terekam dan menjelaskan apakah GPS, kompas, atau arah kamera perlu diperiksa. Tiang diproyeksikan dari koordinat GPS yang sama saat pengguna berpindah atau mengubah arah kamera. Tiang jauh diperbesar secukupnya agar terlihat tanpa menggeser titik dasarnya. Perubahan kecil pada pembacaan posisi kamera dan kompas disaring untuk mengurangi goyangan. Tampilan mengasumsikan lahan datar dan kamera sekitar 1,5 m di atas tanah. Perkiraan posisi bisa bergeser karena GPS, kompas, atau lensa. Jika terlalu dekat untuk menentukan arah, tampil **Dekat Patok**. Pengukuran tetap memakai koordinat.

Tes geometri: `node --test tests/land-geometry.test.js`. Build: `npm run build` menghasilkan index.html dan scan.html.

## Climate Intelligence — Cycle 2

Simpan polygon valid, kemudian **Lanjut ke analisis iklim**. Setelah persetujuan, browser mengirim hanya koordinat pusat lahan (dibulatkan 5 desimal) ke Open-Meteo. ERA5 90 hari berakhir enam hari sebelum hari ini untuk mengakomodasi jeda arsip; zona waktu Asia/Jakarta. Prakiraan 14 hari dan elevasi merupakan sumber terpisah yang boleh gagal tanpa menggagalkan historis. Nilai kosong tidak dianggap nol; cakupan ditampilkan per metrik. Pola musim opsional menggunakan 10 tahun kalender lengkap dan tiga bulan kalender berikutnya; bukan prediksi musiman. Tidak ada rekomendasi tanaman otomatis pada cycle ini. Cache lokal dicocokkan dengan polygon, ekspor JSON tersedia. Free API hanya untuk prototype nonkomersial; gunakan proxy server dan lisensi yang sesuai sebelum penggunaan komersial. Sumber Open-Meteo / Copernicus / ECMWF. Tes: node --test tests/*.test.js (Windows CMD: node --test tests/land-geometry.test.js tests/climate-core.test.js).

## Crop Recommendation — Cycle 3

Dari halaman iklim, buka rekomendasi tanaman. Isi kondisi air, tekstur, drainase dan pH (boleh kosong). Screening v0.1 mencakup 10 komoditas lahan terbuka, faktor pembatas, skor ternormalisasi pada data tersedia, cakupan terpisah, dan alasan. Kandidat hanya ketika semua parameter terisi dan tidak ada faktor pembatas/catatan risiko; bukan jaminan kelayakan budidaya. Data iklim yang tidak cocok dengan polygon atau lebih dari 30 hari tidak digunakan; prakiraan ekstrem maksimal usia 2 hari. Klimatologi 3 bulan dipakai hanya jika bulan cocok dan minimal 8 tahun lengkap masing-masing, selain itu historis 90 hari sebagai konteks suhu. Curah hujan tidak dianggap pasokan irigasi. Profil suhu/pH/umur/jarak tanam dan bobot adalah asumsi prototype belum tervalidasi, referensi metodologi FAO ECOCROP dan Crop Water Needs. Simpan pilihan sebagai automotion.recommendation.v1 atau ekspor JSON untuk generator 3D. Tes: node --test tests/land-geometry.test.js tests/climate-core.test.js tests/recommendation-core.test.js.

## Dynamic Farm — Cycle 4

Simpan rencana tanaman dari Cycle 3 lalu buka rencana 3D. Terrain datar dibentuk dari polygon (termasuk cekung), baris tanam dipotong pada batas dan kapasitas dibatasi target area efektif. Sampel visual maksimal 3.000 instans; kapasitas grid tidak sama dengan objek visual. Persentase efektif belum membentuk bedengan/jalan. Zona berdasarkan sumbu timur–barat; luas tidak selalu sama. Sepuluh crop menggunakan model geometri prosedural ilustratif, bukan aset botani realistis. Marker sensor tanah, cuaca, katup, pompa, tandon dapat diklik; aliran air dan kelembapan hanya simulasi. Tidak ada hardware control atau rancangan hidraulik. WebGL gagal → sketsa 2D dan panel masih bisa digunakan. Layout disimpan lokal untuk polygon, komoditas dan waktu rencana yang sama. Tes: node --test tests/land-geometry.test.js tests/climate-core.test.js tests/recommendation-core.test.js tests/farm-layout.test.js.

## Beranda simulasi guest

Mode greenhouse melon dan lahan terbuka padi dari feature/guest-simulation dipulihkan ke main, termasuk aset GLB padi, penyimpanan guest dan detail perangkat. Simulasi langsung tidak membutuhkan scan. Fitur scan, iklim, rekomendasi dan farm planner tetap terpisah.

## Jenis lahan lintas modul

Beranda menyediakan simulasi langsung greenhouse melon dan sawah padi, serta dua jalur scan. Profil scan menyimpan landType; profil lama dianggap open-field. Climate adalah iklim luar bangunan. Screening greenhouse berbasis tanah memakai suhu indoor yang diinput pengguna (tidak otomatis memakai suhu outdoor), lima kandidat awal termasuk melon; screening outdoor tetap 10 komoditas. Farm planner menampilkan garis rangka konseptual untuk greenhouse dan memvalidasi jenis profil/rencana. Belum mencakup hidroponik, desain struktur/atap, atau pengukuran kondisi indoor. Tes tambahan: node --test tests/land-type.test.js.

## Simpan simulasi sebagai tamu

Di beranda, beri nama sesi lalu pilih **Mulai simulasi**. Gunakan **Simpan simulasi** untuk menyimpan zona, pembacaan sensor, level tandon, kelembapan tiap zona, dan tampilan atap. Buka kembali sesi dari **Simulasi tersimpan**. Pompa mulai dalam keadaan mati saat sesi dibuka.

Simpanan disimpan di penyimpanan lokal browser untuk alamat situs yang sama. Mode ini belum menggunakan akun atau sinkronisasi antardevice.

## Jenis lahan

Pilih **Greenhouse Melon** untuk mencoba irigasi tetes di Zona A dan B, atau **Lahan Terbuka Padi** untuk melihat satu petak sawah dengan tanah, bibit padi, pematang, dan saluran air dalam 3D. Di sawah, tombol **Alirkan air** dan **Kuras air** mengubah genangan. Kelembapan tanah naik saat pengisian. Nilai pengairan adalah data simulasi, dengan tinggi air diperbesar pada model 3D. Viewer WebGL memakai `public/lahan-terbuka-padi.glb`. Tampilan sederhana tersedia jika perangkat tidak mendukung WebGL atau aset gagal dimuat.

Simpanan menyimpan jenis lahan dan kondisi terakhir. Simpanan dari versi sebelumnya tetap dibuka sebagai Greenhouse Melon. Saat membuka simpanan sawah, pintu air mulai dalam keadaan tertutup.

## Workflow pengembangan

Untuk sementara main adalah satu-satunya branch pengembangan aktif. Semua fitur dan aset digabungkan di main; branch lama dipertahankan sebagai arsip. Clone atau pull origin main untuk mendapatkan versi lengkap.

## Backend engineering guideline

Acuan arsitektur dan acceptance gate backend: [Automotion Server Architecture & Engineering Guideline](docs/SERVER_ARCHITECTURE_GUIDELINE.md). Rancangan ini bersifat proposed; belum ada backend production atau deployment. Seluruh pengembangan tetap di main.

## Backend lokal · B01 Foundation

Butuh Node.js 24 dan Docker Compose v2. Dari root repo, salin `.env.example` ke `.env` (`copy .env.example .env` di Windows CMD atau `cp .env.example .env` di Bash). Konfigurasi contoh untuk development lokal.

```sh
npm --prefix server ci
docker compose --env-file .env -f infrastructure/compose.yaml up -d --wait db
npm --prefix server run db:migrate
npm --prefix server start
```

API tersedia di `http://127.0.0.1:3001`. Cek alamat ini lewat browser atau `curl` (`curl.exe` di Windows).

| Endpoint | Hasil |
|---|---|
| `/health/live` | HTTP 200 saat proses API berjalan. |
| `/health/ready` | HTTP 200 saat PostGIS bisa diakses, atau 503 saat koneksi atau pemeriksaan PostGIS gagal. |

PostgreSQL hanya dibuka di loopback pada port 5433. Jika port bentrok, ubah `POSTGRES_HOST_PORT` dan port pada `DATABASE_URL` di `.env`. Untuk mode watch gunakan `npm --prefix server run dev`. Frontend masih dijalankan lewat `npm run dev` dari root.

```sh
npm --prefix server test
npm --prefix server run test:integration
```

Tes integrasi memakai database pengembangan dari `.env` dan menjalankan migrasi. Untuk menghentikan database dengan volume data tetap tersimpan, jalankan `docker compose --env-file .env -f infrastructure/compose.yaml down`.

## Halaman masuk untuk trial

Halaman awal menyediakan **Masuk dengan Google** dan **Lanjut sebagai tamu**. Untuk tes Scan Lahan di HP, pilih tamu, pilih jenis lahan, lalu gunakan kamera dan GPS melalui alamat HTTPS. Build statis bisa disajikan dari folder `dist` seperti biasa. Hasil scan dan simulasi disimpan di browser, termasuk saat penguji masuk dengan Google.

### Aktifkan login Google dengan Firebase

1. Di [Firebase Console](https://console.firebase.google.com/), pilih project Automotion atau buat project. Buka **Project settings → General → Your apps**, pilih ikon **Web (</>)**, lalu register app. Salin konfigurasi web `firebaseConfig`.
2. Buka **Authentication → Get started → Sign-in method → Google**, aktifkan Google, pilih email dukungan bila diminta, lalu simpan.
3. Di **Authentication → Settings → Authorized domains**, tambahkan hostname HTTPS yang dipakai untuk membuka app, misalnya `contoh.trycloudflare.com`. Isi hostname saja. Tambahkan `localhost` secara terpisah jika ingin tes lokal dan domain itu belum terdaftar.
4. Buat `.env.local` di root repo, lalu isi nilai Web App dari Firebase Console.

   ```dotenv
   VITE_FIREBASE_API_KEY=nilai_apiKey
   VITE_FIREBASE_AUTH_DOMAIN=nilai_authDomain
   VITE_FIREBASE_PROJECT_ID=nilai_projectId
   VITE_FIREBASE_APP_ID=nilai_appId
   ```

5. Jalankan `npm ci` dan `npm run build`, lalu refresh halaman utama di HP. Firebase Auth bisa dipakai dari build statis pada tunnel yang mengarah ke port 8080. Jika tunnel sementara berganti hostname, tambahkan hostname yang baru ke **Authorized domains**.

Gunakan konfigurasi Web App saja. Google login melalui Firebase membuka pemilih akun Google di pop-up dan menampilkan akun pada dashboard. Data scan masih tersimpan di browser. Firebase ID token belum diverifikasi oleh Fastify karena alur trial belum memiliki endpoint penyimpanan per akun.

### Alternatif login Google melalui Fastify

1. Di Google Cloud Console, atur consent screen dan buat OAuth client dengan tipe **Web application**. Daftarkan URI callback persis seperti yang akan dipakai, misalnya `http://localhost:3001/api/auth/google/callback`. Untuk HP, gunakan hostname HTTPS yang dapat didaftarkan di Google Cloud dan arahkan tunnel atau reverse proxy ke Fastify. Jika aplikasi masih dalam mode **Testing**, masukkan akun penguji jika Google Cloud meminta test users.
2. Isi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, dan `AUTH_SESSION_SECRET` di `.env`. Buat nilai rahasia sesi dengan `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Simpan rahasia hanya di server.
3. Jalankan `npm --prefix server ci`, `npm run build`, lalu `npm --prefix server start`. Buka aplikasi dari origin yang sama dengan callback terdaftar. Untuk contoh localhost, alamatnya `http://localhost:3001/`. Fastify menyajikan `dist` sekaligus API login. Jika tunnel masih menuju server Python statis di port 8080, mode tamu tetap berjalan. Untuk Google, arahkan origin publik ke Fastify di port 3001.

Jika konfigurasi Google belum diisi, tombol Google dinonaktifkan dan jalur tamu tersedia. Login Google hanya meminta identitas profil dan email. Akses kotak masuk Gmail dan sinkronisasi simpanan antarperangkat belum termasuk di trial.
