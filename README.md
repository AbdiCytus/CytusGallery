# 🌌 CytusGallery

CytusGallery adalah aplikasi web galeri berbasis API **Danbooru** yang dirancang untuk menampilkan konten gambar maupun video dengan tampilan modern, interaktif, dan responsif.  
Proyek ini terinspirasi dari gaya **Pinterest Grid** namun dipadukan dengan berbagai fitur lanjutan seperti filter, slider, sidebar, hingga penyimpanan preferensi pengguna.

---

## ✨ Fitur Utama

1. 🔍 **Searchbar + Auto Suggest**

   - Pencarian konten berdasarkan **tag**.
   - Mendukung **auto suggest** hingga 10 hasil (tanpa scroll).
   - Dapat dikonfirmasi dengan tombol **Enter** atau **Search**.
   - Posisi searchbar berada di bawah header.

2. 🖼 **Grid Layout**

   - Tampilan konten berbentuk grid seperti **Pinterest**.
   - Desktop → 5 kolom, Mobile → 2 kolom.
   - Setiap konten memiliki indeks unik.

3. 📑 **Pagination**

   - Berada di bawah halaman, sebelum footer.
   - Menampilkan 3 halaman terdekat, sisanya menggunakan format `...`.
   - Jumlah pagination dihitung dari **total konten ÷ konten per halaman**.
   - Default: **25 konten per halaman** (maksimal hingga 200).

4. 📖 **Detail Konten**

   - Menampilkan detail lengkap sebuah konten:
     - Metadata
     - Copyright
     - Character
     - Artist
     - Meta Tags
     - General Tags

5. 🎚 **Filter**

   - **Berdasarkan Rating:**
     - Safe → hanya `rating:g`
     - Moderate → semua kecuali `rating:e`
     - Explicit → semua kecuali `rating:g`
     - Default → nonaktif (semua rating ditampilkan)
   - **Berdasarkan Tipe Konten:**
     - Image → jpg, png, webp
     - Video → mp4, webm
     - Default → nonaktif (semua tipe ditampilkan)
   - Catatan: gunakan `large_file_url` untuk menentukan tipe file (bukan `file_ext`).

6. 📱 **Responsive**

   - Desain web otomatis menyesuaikan ke semua ukuran layar.

7. 🎞 **Slider Konten**

   - Menampilkan **10 konten dengan skor tertinggi**.
   - Lokasi: di bawah searchbar.
   - Hanya tampil di **halaman pertama**.

8. 📂 **Sidebar Menu**

   - Dibuka dengan **hamburger menu** di header kanan.
   - Berisi pengaturan seperti **toggle auto suggest** & filter.

9. ⬇️ **Download Konten**

   - Tersedia tombol download di halaman detail.

10. 🏷 **Clickable Tags**

    - Semua tag (kecuali metadata) dapat diklik untuk melakukan pencarian baru.

11. 🖱 **Hover & Transisi**

    - Desktop → hover konten → overlay muncul.
    - Mobile → klik konten → overlay muncul.
    - Overlay berisi **character, copyright,
      dan tombol menuju detail** (aktif setelah overlay tampil).

12. 📤 **Share Konten**

    - Tombol share tersedia di halaman detail.

13. 🧭 **Header & Footer**

    - Header: judul di kiri, hamburger menu di kanan.
    - Mobile: header otomatis disembunyikan saat scroll ke bawah, muncul kembali saat di scroll ke atas.
    - Footer standar di bagian bawah halaman.

14. ⚙️ **Custom Konten Per Page**
    - User dapat mengatur jumlah konten per halaman (maksimal **200**).

---

## 🔧 Fitur Tambahan

1. **Simpan Data Pengaturan Pengguna**

   - Preferensi (filter, auto suggest, dll) tetap tersimpan meskipun refresh.

2. **Simpan Tag Pencarian**

   - Tag pencarian terakhir dipertahankan saat refresh.
   - Akan dihapus otomatis ketika user keluar dari web.

3. **Autoplay Hover Video (Desktop)**

   - Video diputar otomatis saat dihover.
   - Mode mute, loop 5 detik.
   - Default **nonaktif**, dapat diaktifkan lewat pengaturan.

4. **Lazy Loading**

   - Default **nonaktif**, bisa diaktifkan sesuai kebutuhan.

5. **Sliding Copyright**
   - Menampilkan **15 tag copyright** berjalan horizontal.
   - Lokasi: di bawah pagination, sebelum footer.
   - Hanya tampil ketika **tidak ada pencarian tag**.
   - Semua tag dapat diklik untuk pencarian cepat.

---

## 🎨 Tema & Warna

- **Primary:** Gradasi abu-abu kehitaman.
- **Filter tambahan:**
  - Safe → gradasi hijau tua.
  - Moderate → gradasi emas tua.
  - Explicit → gradasi merah tua.
- Jika filter nonaktif → kembali ke warna primary default.

---

## 📛 Nama Proyek

**CytusGallery**