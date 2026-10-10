# Analisis: dari portal game edukasi umum menjadi Ruang Fokus untuk anak ADHD

Dokumen ini berisi (1) hasil pemeriksaan `denigames.netlify.app`, (2) dasar desain ADHD yang dipakai,
dan (3) keputusan desain konkret beserta alasan dan batasannya.

---

## 1. Objek yang diperiksa

`https://denigames.netlify.app` tidak lagi menyajikan konten di domain itu — server mengembalikan
pengalihan lintas-origin (HTTP 3xx) ke **`https://papaninteraktif.com`**. Jadi yang dianalisis adalah
situs tujuan tersebut.

| Aspek | Temuan |
|---|---|
| Nama situs | Papan Interaktif (Papan Interaktif Digital) |
| Penyusun | Deni Ranoptri, M.Pd |
| Bahasa | Indonesia, dengan versi Inggris sebagian (`/en/journal`) |
| Jenis | Katalog/portal game edukasi, bukan satu aplikasi game |
| Sasaran | PAUD/TK, SD, SMP, SMA; guru; pemakaian di Interactive Flat Panel (IFP)/smartboard |
| Model | Gratis, tanpa langganan, didanai iklan (Google AdSense) |

### 1.1 Teknologi yang terlihat

| Lapisan | Detail |
|---|---|
| Kerangka | React + Vite, satu berkas bundel `assets/index-*.js` berukuran ±1,38 MB |
| Gaya | Tailwind CSS dimuat dari CDN (`cdn.tailwindcss.com`) — bukan hasil kompilasi |
| Font | Google Fonts (Nunito) |
| PWA | Ada `manifest.json`, `theme-color`, dan penangan `beforeinstallprompt` |
| SEO | Metadata Open Graph, Twitter Card, JSON-LD (`WebSite`, `Organization`, `FAQPage`, `ItemList`) |
| Analitik | Google Analytics (`G-…`) dan AdSense (`ca-pub-…`) |
| Routing | `history.pushState` manual dengan `popstate` — bukan React Router, jadi tiap kali muat ulang terjadi *full reload* |
| Game | **33 game** yang sebagian besar berada di **subdomain terpisah** (`*.papaninteraktif.com`), dibuka sebagai tautan keluar (`target="_blank"`) |
| Penyimpanan | **Tidak ada.** Bundel tidak menyentuh `localStorage` maupun `sessionStorage` |

### 1.2 Cakupan katalog

Dari bundel berhasil diekstrak 33 entri game (tersimpan di
[referensi-katalog-papaninteraktif.json](referensi-katalog-papaninteraktif.json)). Sebarannya:

| Tingkat | Jumlah | Contoh |
|---|---|---|
| `paud` | 9 | Tatap Hap, Cocok Logi, Mesin Gacha, Pendekar Balon, Detektif Cilik, Lab Warna, Dunia Hewan, Tarik Dino, Color Link Junior |
| `sd` | 15 | Math Domino, Jejak Angka, Banua Fruit Blast, Si Pemanah, Rimba Pedia, Martabak Pecahan, Si Taktik, Perang Antariksa, Jagoan Kata, Geo Squad, Ruang.io, Mancing Kata, Jalan Kancil, AI Basketball, Celestial Weaver |
| `general` (lintas jenjang) | 8 | Heli Rescue, ScienceLink, Puzzle Gambar, Doodle AI, Lomba 17an, NusaBoard, Gabung Ceria, Tanzib |

Kategori yang didefinisikan: **Numerasi, Literasi, Logika, Ice Breaking, Religion, Sport**.
Setiap entri membawa metadata yang rapi: `id`, `title`, `subtitle`, `description`, `audience`,
`educationLevel`, `learningFocus`, `tags`, `categoryKeys`, `bgColor`, `howToPlay[]`,
`educationalBenefits[]`, `isNew`, `url`. Selain itu ada mode **UMUM** dan **JUNIOR**, kartu detail
per game, pencarian, filter kategori, dan penyaring tingkat (mis. "Anak PAUD & TK").

### 1.3 Yang sudah bagus dan layak dipertahankan

1. **Kurasi rapi.** 33 game dengan metadata konsisten dan langkah bermain yang ditulis jelas.
2. **Nol hambatan masuk.** Tanpa akun, tanpa pemasangan, tanpa berlangganan.
3. **Penyaringan berlapis.** Kategori, tingkat, pencarian, dan penanda "Baru".
4. **Sadar aksesibilitas dasar.** Ditemukan 177 kemunculan atribut `aria-*`, `sr-only` untuk label,
   dan `htmlFor` pada kolom pencarian.
5. **Multi-perangkat.** Tata letak responsif sampai layar besar IFP, dengan mode layar penuh.

### 1.4 Keterbatasan bila dipakai anak dengan ADHD

Semua poin di bawah ini bukan "kesalahan" portal tersebut — portal itu memang dirancang untuk
pengguna umum. Tetapi masing-masing menimbulkan hambatan spesifik bagi anak ADHD.

| # | Keterbatasan | Dampak bagi anak ADHD |
|---|---|---|
| 1 | **Durasi game tidak diketahui di muka** | Kesulitan memperkirakan kapan selesai → kecemasan dan penolakan memulai. Tidak ada tombol "5 menit saja". |
| 2 | **Tidak ada timer yang terlihat saat bermain** | *Time blindness*: anak kehilangan jejak waktu, lalu kaget ketika dihentikan orang tua — sering berujung konflik. |
| 3 | **Game dibuka di tab baru, di domain lain** | Anak keluar dari lingkungan terkendali; mudah teralih, dan tidak ada jalan kembali yang konsisten. |
| 4 | **Tidak ada penyimpanan progres sama sekali** | Tidak ada bintang, lencana, atau riwayat. Kehilangan umpan balik jangka menengah yang membantu motivasi. |
| 5 | **Reward bergantung pada skor permainan** | Anak yang impulsif atau salah menjawab bisa pulang tanpa apa pun. Tidak ada penghargaan atas usaha. |
| 6 | **Tidak ada jeda gerak terjadwal** | Sesi berjalan sampai anak bosan atau orang tua menghentikan, bukan sampai tuntas. |
| 7 | **Tidak ada penopang memori kerja** | Instruksi hanya ada di kartu detail sebelum bermain. Begitu bermain, instruksi hilang dari layar. |
| 8 | **Iklan AdSense** | Unsur paling mengganggu bagi atensi: gambar bergerak, tombol palsu, dan sesuatu yang bisa diklik di luar permainan. |
| 9 | **Rangsangan visual tinggi** | Latar bertekstur, gradien, dan banyak warna sekaligus; menyulitkan anak yang mudah *overload*. |
| 10 | **Catatan pendamping tidak dirancang** | Tidak ada cara melihat durasi fokus, tingkat kemandirian, atau mengamati pola; tidak ada ekspor untuk konsultasi. |
| 11 | **Bundel 1,38 MB + Tailwind CDN** | Muat awal lambat pada perangkat sekolah dan koneksi terbatas. |
| 12 | **Bergantung 33 subdomain terpisah** | Pengalaman tidak konsisten; kontrol orang tua (mis. membatasi konten) menjadi tidak praktis. |

### 1.5 Kesimpulan analisis

Portal itu **kuat sebagai katalog dan lemah sebagai pengalaman bermain terpandu.** Yang hilang bukan
jumlah game, melainkan **struktur sesi**: kapan mulai, berapa lama, kapan berhenti, apa yang didapat,
dan bagaimana orang dewasa di sekitarnya bisa ikut mendampingi.

Ruang Fokus sengaja tidak meniru 33 game tersebut (dan tidak menyalin kode atau asetnya). Ia mengambil
**bentuk luarnya** — katalog game, kartu detail dengan langkah bermain dan manfaat — lalu mengganti
mesin pengalamannya dengan dukungan yang dibutuhkan ADHD.

---

## 2. Dasar desain ADHD yang dipakai

Bagian ini menjelaskan mengapa fitur tertentu ada. Rujukan ilmiah bersifat umum, bukan protokol klinis.

### 2.1 Umpan balik harus segera

Anak dengan ADHD lebih terpengaruh oleh **penundaan hadiah** dibanding anak seusianya: nilai sebuah
hadiah menurun tajam bila harus ditunggu ([studi pilihan tertunda pada anak ADHD](https://www.sciencedirect.com/science/article/abs/pii/S0005791611000589)).
Prinsip pengelolaan perilaku yang paling konsisten didukung bukti menekankan **konsekuensi langsung,
sering, dan diberikan lebih awal** daripada konsekuensi besar yang jarang
([ringkasan studi kelas berbasis token dan penguatan segera](https://core.ac.uk/download/pdf/185289667.pdf),
[dokumen implementasi token economy di kelas](https://files.eric.ed.gov/fulltext/ED363085.pdf)).

**Diterapkan sebagai:** nada suara dan perubahan warna dalam milidetik; bintang dihitung seketika;
tidak ada penilaian yang ditunda sampai akhir ronde.

### 2.2 Memori kerja sering menjadi penghambat, bukan kemampuan

Memori kerja anak ADHD umumnya lebih lemah, sehingga instruksi bertingkat mudah hilang di tengah jalan.
Program pelatihan memori kerja memang dapat meningkatkan performa pada tugas yang dilatih, tetapi
manfaatnya **jarang berpindah jauh** ke gejala sehari-hari
([meta-analisis pelatihan kognitif terkomputerisasi untuk ADHD](https://ouci.dntb.gov.ua/en/works/7X2NDrql/),
[tinjauan sistematis pelatihan memori kerja pada anak ADHD](https://m2.mtmt.hu/api/publication/33397190)).

**Diterapkan sebagai:** aplikasi tidak menjanjikan "menyembuhkan". Ia memilih strategi yang buktinya
lebih kuat — **menopang** memori kerja alih-alih melatihnya: kartu langkah, tombol "Ulangi langkah",
pengingat langkah permanen, titik penanda posisi, dan pilihan ganda alih-alih mengarang jawaban.

### 2.3 Gerak membantu, bukan mengganggu

Aktivitas fisik akut dapat meningkatkan fungsi eksekutif anak ADHD
([studi aktivitas fisik akut dan fungsi eksekutif](https://pmc.ncbi.nlm.nih.gov/articles/PMC6098027/)),
dan olahraga dipandang sebagai penopang yang menjanjikan dalam perencanaan intervensi
([tinjauan peran olahraga pada ADHD](https://pmc.ncbi.nlm.nih.gov/articles/PMC3724411/)).

**Diterapkan sebagai:** **Jeda Gerak** otomatis 12–15 detik di antara ronde, dengan gerakan acak yang
bisa dilakukan sambil duduk, plus tombol Jeda Gerak mandiri 30 detik di beranda.

### 2.4 Regulasi diri perlu dilatih sebagai keterampilan

Pernapasan lambat dan latihan menunda respons adalah komponen umum program regulasi diri untuk anak.
Latihan menahan respons (Go–No-Go) menyasar tepat kesulitan inti ADHD: **inhibisi respons**.

**Diterapkan sebagai:** game **Tahan Dulu!** (Go–No-Go), **Tenang Dulu** (toleransi menunggu), dan
**Napas Warna** (pernapasan ~4–7 detik per siklus). Ketiganya tanpa hukuman saat gagal.

### 2.5 Pujian harus menyasar usaha

Memuji inteligensi membuat anak lebih rapuh menghadapi kegagalan, sedangkan pujian atas usaha dan
strategi lebih melindungi motivasi ([studi pujian dan reaksi terhadap kegagalan](https://www.eurekalert.org/news-releases/1016561)).

**Diterapkan sebagai:** semua teks ringkasan berbunyi "kamu berusaha keras", "kamu tetap mencoba
setelah salah", "kamu bertahan fokus 3 menit" — tidak pernah "kamu pintar" atau "kamu hebat karena
nilaimu tinggi". Bintang diberikan walau anak berhenti di tengah.

### 2.6 Waktu harus dibuat terlihat

*Time blindness* adalah keluhan yang sangat umum pada ADHD; **timer visual** (bukan angka saja)
membantu anak memperkirakan sisa waktu ([pembahasan alat membuat waktu terlihat](https://get-set.app/blog/adhd-time-blindness-tools/),
[penggunaan timer visual](https://mypatientadvice.co.uk/knowledge-base/how-can-i-use-visual-timers-to-better-judge-when-to-leave-in-adhd/)).

**Diterapkan sebagai:** batang timer selalu tampil di panggung game, berubah warna pada 40% dan 15%
sisa waktu, dengan bunyi tik lembut pada 10 detik terakhir; ditambah alat **Timer Visual** mandiri
berupa cincin yang menyusut.

### 2.7 Desain teknologi untuk anak ADHD

Ko-desain dengan anak ADHD menekankan pentingnya tampilan yang dapat dipahami sekilas, kendali anak
atas interaksi, dan dukungan regulasi bersama antara anak dan pendamping
([Co-Designing Situated Displays for Family Co-Regulation with ADHD Children, CHI 2024](https://dl.acm.org/doi/full/10.1145/3613904.3642745)).

**Diterapkan sebagai:** Area Pendamping terpisah dari tampilan anak, catatan pengamatan (bukan
diagnosis), ekspor data untuk konsultasi, dan pengaturan yang bisa diubah pendamping tanpa mengganggu
tampilan anak.

---

## 3. Perbandingan langsung

| Dimensi | Papan Interaktif / denigames | Ruang Fokus |
|---|---|---|
| Bentuk | Katalog 33 game di 33 subdomain | 6 game dalam satu aplikasi |
| Iklan | AdSense | Tidak ada |
| Akun / pelacakan | Tanpa akun, ada Google Analytics | Tanpa akun, tanpa analitik, tanpa jaringan |
| Durasi sesi | Tidak diketahui di muka | Ditentukan di muka (2 – 2,5 menit per game) |
| Timer | Tidak ada | Selalu terlihat + alat timer mandiri |
| Akhir sesi | Ditentukan anak/orang tua | Ronde terbatas dengan akhir yang jelas |
| Umpan balik | Di dalam game masing-masing | Seragam: suara + warna + teks, seketika |
| Konsekuensi salah | Bergantung game | Tidak pernah mengurangi poin; ada isyarat & petunjuk |
| Penopang memori kerja | Kartu detail sebelum main | Kartu langkah + pengingat permanen + "Ulangi langkah" |
| Jeda gerak | Tidak ada | Otomatis antar ronde + alat mandiri |
| Progres | Tidak disimpan | Bintang, lencana, riwayat, grafik 7 hari (lokal) |
| Reward | Skor permainan | Bintang untuk menyelesaikan & berusaha; hadiah bisa ditukar |
| Panel pendamping | Tidak ada | Area Pendamping: statistik, catatan, pengaturan, ekspor |
| Aksesibilitas | Atribut ARIA dasar | Target 56 px, mode baca, mode kurangi gerakan, kontras AA |
| Ukuran | ±1,38 MB JS saja, + Tailwind &amp; font dari CDN | ±204 KB total (144 KB JS + 40 KB CSS + 21 KB HTML), tanpa dependensi |
| Rangsangan visual | Gradien, tekstur, banyak warna | Latar tenang, satu tugas per layar |

---

## 4. Keputusan desain per game

| Game | Tugas kognitif | Keputusan adaptasi ADHD |
|---|---|---|
| **Lampu Fokus** | Atensi berkelanjutan & selektif | Hanya satu target per putaran; pengganggu bergerak pelan (bukan berkedip) untuk menghindari overstimulasi; empat temuan benar per ronde lalu jeda |
| **Ingat Urutan** | Memori kerja visual-spasial | Urutan hanya 3 → 5 langkah (tidak pernah 8–9); tersedia "Lihat lagi" 2× per ronde; titik penanda mengurangi beban mengingat posisi |
| **Tahan Dulu!** | Inhibisi respons (Go–No-Go) | Rasio ramah 4 boleh : 1 tahan di ronde pertama; jendela respons 1,2–1,5 detik (bukan tembak cepat); bom yang berhasil ditahan justru diberi pujian sebagai keberhasilan inti |
| **Napas Warna** | Regulasi diri | Tanpa target napas, tanpa penilaian; tombol "Sudah cukup, selesai" selalu tersedia; hitungan napas tampil agar anak tahu kapan selesai |
| **Pasar Angka** | Numerasi sampai 20 | Selalu pilihan ganda (mengurangi beban menulis dan memori kerja); ronde pertama memakai gambar konkret; salah tidak mengurangi poin dan soal bisa dicoba ulang |
| **Tenang Dulu** | Toleransi menunggu | Waktu tunggu 2–9 detik; ada penghitung visual yang berjalan agar anak tidak "buta waktu"; melepas terlalu cepat hanya diulang dengan tenang |

---

## 5. Bug nyata yang ditemukan saat pengujian

Harness `tools/smoke.mjs` menjalankan aplikasi dengan DOM tiruan. Selain 107 pemeriksaan yang lulus,
ia menemukan bug yang tidak terlihat dari sekadar membaca kode:

1. **Jeda gerak mematikan sesi.** `App.go()` mengakhiri sesi setiap kali meninggalkan layar game —
   termasuk saat mengunjungi layar jeda gerak. Akibatnya, setiap jeda antar ronde menghentikan sesi
   sebelum anak menyelesaikan tiga ronde. Diperbaiki dengan opsi `keepSession`.
2. **`self.addScore` bukan fungsi.** Karena `setScore`/`addScore` berada pada objek host dan bukan pada
   `Session`, skor tidak pernah bertambah pada dua game. Fungsi skor kini berada langsung di `Session`.
3. **Penangkap galat ikut gagal.** Blok `catch` di `Session.start()` memakai `stage` yang bisa `null`,
   sehingga penangan galat melempar galat baru dan menutupi penyebab aslinya. Kini dilindungi.
4. **Tombol "Keluar" salah nama.** Tombol itu sebenarnya **menyudahi sesi dan menampilkan ringkasan
   positif**, bukan sekadar kembali. Diberi label "Selesai" dan dialognya diperjelas.
5. **Penghitung game bercampur antar ronde.** Penghitung benar/salah di Pasar Angka tidak direset saat
   ronde baru, sehingga akurasi yang tercatat untuk pendamping menjadi salah.
6. **`this` tidak stabil di attention.js.** `host.setSteps(this.steps, …)` bergantung pada konteks
   pemanggilan; kini memakai referensi `game` yang tetap.

Semuanya lolos verifikasi setelah perbaikan: **107 pemeriksaan lulus, 0 galat runtime.**

---

## 6. Batasan dan hal yang belum diklaim

- **Bukan alat diagnosis.** Tidak ada skrining, kuesioner, atau interpretasi klinis.
- **Bukan pengganti terapi.** Aplikasi tidak menggantikan penanganan profesional, obat, terapi perilaku,
  atau dukungan sekolah.
- **Bukan program terapi teruji.** Prinsip desainnya mengikuti rekomendasi umum dan temuan penelitian,
  tetapi aplikasi ini sendiri belum diuji dalam uji klinis dan tidak mengklaim efek terapeutik.
- **Efek latihan kognitif diperdebatkan.** Meta-analisis menunjukkan perbaikan pada tugas yang dilatih
  dengan sedikit perpindahan ke gejala sehari-hari. Karena itu aplikasi ini menekankan **dukungan
  lingkungan dan struktur**, bukan janji perbaikan kognitif.
- **Data lokal saja.** Tidak ada sinkronisasi antar perangkat; membersihkan data browser menghapus riwayat.
- **Instruksi bersuara** bergantung pada ketersediaan suara `id-ID` di sistem operasi.
- **Belum diuji dengan pengguna nyata.** Validasi berikutnya yang paling berharga adalah uji kebergunaan
  bersama beberapa anak ADHD dan pendampingnya, lalu mengukur penyelesaian sesi dan tingkat kemandirian.

---

## 7. Sumber

**Situs yang dianalisis**

- [papaninteraktif.com](https://papaninteraktif.com/) — katalog, metadata, dan bundel React
- [denigames.netlify.app](https://denigames.netlify.app/) — mengalihkan ke alamat di atas

**Rujukan desain**

- Penundaan hadiah pada anak ADHD — [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0005791611000589)
- Penguatan segera & token economy di kelas — [studi kelas](https://core.ac.uk/download/pdf/185289667.pdf), [implementasi token economy](https://files.eric.ed.gov/fulltext/ED363085.pdf)
- Pelatihan kognitif terkomputerisasi untuk ADHD (meta-analisis) — [ouci.dntb.gov.ua](https://ouci.dntb.gov.ua/en/works/7X2NDrql/)
- Tinjauan sistematis pelatihan memori kerja pada anak ADHD — [MTMT](https://m2.mtmt.hu/api/publication/33397190)
- Aktivitas fisik akut dan fungsi eksekutif anak ADHD — [PMC6098027](https://pmc.ncbi.nlm.nih.gov/articles/PMC6098027/)
- Peran olahraga dalam perencanaan intervensi ADHD — [PMC3724411](https://pmc.ncbi.nlm.nih.gov/articles/PMC3724411/)
- Pujian atas inteligensi vs usaha — [EurekAlert](https://www.eurekalert.org/news-releases/1016561)
- Timer visual dan *time blindness* — [get-set.app](https://get-set.app/blog/adhd-time-blindness-tools/), [mypatientadvice](https://mypatientadvice.co.uk/knowledge-base/how-can-i-use-visual-timers-to-better-judge-when-to-leave-in-adhd/)
- Ko-desain tampilan untuk koregulasi keluarga dengan anak ADHD (CHI 2024) — [ACM DL](https://dl.acm.org/doi/full/10.1145/3613904.3642745)
