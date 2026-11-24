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
