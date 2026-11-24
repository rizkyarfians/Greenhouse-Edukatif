# Kebun Melon

Dashboard edukasi greenhouse 8 × 20 m dengan model yang bisa diputar, di-zoom, dan dibuka atapnya. Pilih Zona A atau B dan gunakan **Coba siram** untuk melihat pipa aktif, status pompa, level tandon, dan kelembapan media berubah. Siklus berhenti otomatis setelah 7,5 detik. Semua angka adalah data simulasi, tanpa koneksi ke sensor atau aktuator.

## Menjalankan dari source

```sh
npm ci
npm run dev
```

`npm run build` menghasilkan situs statis di `dist/`. Paket unduhan juga menyertakan hasil build. Untuk membuka hasil build secara lokal, jalankan server HTTP dari direktori proyek, misalnya `python3 -m http.server 8000 --directory dist`, lalu buka http://localhost:8000. Model GLB ada di `public/greenhouse.glb`.

Viewer menggunakan WebGL jika tersedia. Jika perangkat tidak menyediakan WebGL, viewer memakai renderer Canvas dengan warna dan geometri yang disederhanakan.

## Simpan simulasi sebagai tamu

Di beranda, beri nama sesi lalu pilih **Mulai simulasi**. Gunakan **Simpan simulasi** untuk menyimpan zona, pembacaan sensor, level tandon, kelembapan tiap zona, dan tampilan atap. Buka kembali sesi dari **Simulasi tersimpan**. Pompa mulai dalam keadaan mati saat sesi dibuka.

Simpanan disimpan di penyimpanan lokal browser untuk alamat situs yang sama. Mode ini belum menggunakan akun atau sinkronisasi antardevice.

## Jenis lahan

Pilih **Greenhouse Melon** untuk mencoba irigasi tetes di Zona A dan B, atau **Lahan Terbuka Padi** untuk melihat satu petak sawah dengan tanah, bibit padi, pematang, dan saluran air dalam 3D. Di sawah, tombol **Alirkan air** dan **Kuras air** mengubah genangan. Kelembapan tanah naik saat pengisian. Nilai pengairan adalah data simulasi, dengan tinggi air diperbesar pada model 3D.

Simpanan menyimpan jenis lahan dan kondisi terakhir. Simpanan dari versi sebelumnya tetap dibuka sebagai Greenhouse Melon. Saat membuka simpanan sawah, pintu air mulai dalam keadaan tertutup.
