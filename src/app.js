const express = require("express");
const path = require("path");
const axios = require("axios"); // Kita butuh axios di sini
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Setup Template Engine EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Setup folder public untuk file statis (CSS, JS, gambar)
app.use(express.static(path.join(__dirname, "public")));

// Route untuk halaman utama
app.get("/", async (req, res) => {
  // Ubah menjadi fungsi async
  try {
    // Panggil API Danbooru untuk mendapatkan 25 postingan terbaru
    const response = await axios.get(
      "https://danbooru.donmai.us/posts.json?limit=25"
    );
    const posts = response.data; // Ambil data postingan

    // Render halaman 'index.ejs' dan kirim data 'posts' ke dalamnya
    res.render("index", { posts: posts });
  } catch (error) {
    // Tangani jika terjadi error saat memanggil API
    console.error("Error fetching data from Danbooru API:", error);
    res.status(500).send("Gagal mengambil data dari Danbooru API");
  }
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`Server CytusGallery berjalan di http://localhost:${PORT}`);
});
