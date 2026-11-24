# Aset 3D Greenhouse Edukatif

Paket ini berisi 18 model GLB dari greenhouse melon 8 × 20 m. Setiap model bisa diimpor sendiri ke Blender atau dimuat melalui Three.js GLTFLoader. Tekstur yang dipakai model sudah tertanam di file. Sensor dan aktuator adalah ilustrasi untuk simulasi edukatif.

| Kelompok | Nama file (semua berakhiran .glb) |
| --- | --- |
| Bangunan | greenhouse-frame, greenhouse-roof, greenhouse-shell, greenhouse-floor |
| Budidaya | melon-row |
| Irigasi | irrigation-network, irrigation-pump, irrigation-filter, irrigation-valve, flow-meter |
| Air dan nutrisi | water-tank, nutrient-mixing-tank, nutrient-stock-ab |
| Sensor | air-temperature-humidity-sensor, growing-medium-moisture-sensor, tank-level-sensor, ec-ph-sensor |
| Kontrol | iot-control-panel |

**Bangunan.** Rangka, atap, dinding kasa dengan vestibul dan dua daun pintu, serta lantai dengan saluran drainase tersedia sebagai model terpisah.

**Budidaya.** Melon memakai satu baris contoh dari Zona A dengan grow bag, cocopeat, sulur, daun, buah, tali, trelis, dan selang tetes. Komponen dikelompokkan sesuai model sumber.

**Irigasi.** Jaringan lengkap memuat header, manifold, katup, flow meter, ujung pembilas, dan selang tetes Zona A dan B. Pompa dan tandon tersedia sebagai model tersendiri. Jaringan dan baris melon sama-sama memuat selang tetes baris A01. Saat merakit keduanya dalam satu adegan, sembunyikan salah satu salinannya.

## Ekspor ulang dari repo

Jalankan dari root repo dengan Python 3. File hasil ekspor ditulis di folder ini.

```sh
python scripts/export-3d-assets.py
```

Skala mengikuti model utama dalam meter. Sumbu vertikal GLB adalah +Y. Aset diposisikan dekat titik nol agar mudah diletakkan ulang. Untuk mengembalikan posisi tepatnya di model utama pada Three.js, ambil array `greenhousePosition` dari `userData` node pembungkus aset, lalu tambahkan vektor itu ke posisi scene hasil load. Offset berisi koordinat X, Y, Z dalam meter.
