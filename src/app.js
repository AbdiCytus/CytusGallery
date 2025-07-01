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
app.use((req, res, next) => {
  res.locals.tags = req.query.tags || "";
  next();
});

// Route untuk halaman utama
app.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 25; // Default konten per halaman

    // 1. Ambil total jumlah post untuk menghitung total halaman
    const countResponse = await axios.get(
      "https://danbooru.donmai.us/counts/posts.json"
    );
    const totalPosts = countResponse.data.counts.posts;
    const totalPages = Math.ceil(totalPosts / limit);

    // 2. Ambil data post untuk halaman saat ini
    const postsResponse = await axios.get(
      `https://danbooru.donmai.us/posts.json?page=${page}&limit=${limit}`
    );
    const posts = postsResponse.data;
    res.render("index", {
      posts: posts,
      currentPage: page,
      totalPages: totalPages,
      limit: limit,
      tags: "", // Tag kosong untuk halaman utama
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Gagal mengambil data dari Danbooru API");
  }
});

// Tambahkan route baru ini di bawah route '/'
app.get("/search", async (req, res) => {
  const tags = req.query.tags || "";
  if (!tags) {
    return res.redirect("/");
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 25;

    // Logika untuk mendapatkan total halaman dari tag. Sedikit rumit.
    // Kita asumsikan tag pertama adalah yang utama untuk menghitung total.
    const mainTag = tags.split(" ")[0];
    const tagInfoResponse = await axios.get(
      `https://danbooru.donmai.us/tags.json?search[name]=${mainTag}`
    );
    const totalPosts = tagInfoResponse.data[0]?.post_count || 0;
    const totalPages = Math.ceil(totalPosts / limit);

    const postsResponse = await axios.get(
      `https://danbooru.donmai.us/posts.json?tags=${tags}&page=${page}&limit=${limit}`
    );
    const posts = postsResponse.data;

    res.render("search", {
      posts: posts,
      currentPage: page,
      totalPages: totalPages,
      limit: limit,
      tags: tags,
    });
  } catch (error) {
    console.error("Error fetching search data:", error);
    res.status(500).send("Gagal mencari data");
  }
});

app.get("/posts/:id", async (req, res) => {
  try {
    const postId = req.params.id;
    const response = await axios.get(
      `https://danbooru.donmai.us/posts/${postId}.json`
    );
    const post = response.data;

    res.render("detail", { post: post });
  } catch (error) {
    console.error("Error fetching post details:", error);
    res.status(404).send("Konten tidak ditemukan");
  }
});

// == API Endpoint untuk Auto-suggest Tag ==
app.get("/api/tagsuggest", async (req, res) => {
  const searchTerm = req.query.term;
  if (!searchTerm) {
    return res.json([]);
  }

  try {
    // Panggil API Danbooru untuk mencari tag
    // search[order]=count -> Mengurutkan berdasarkan jumlah post (terbanyak dulu)
    const response = await axios.get(
      `https://danbooru.donmai.us/tags.json?search[name_matches]=${searchTerm}*&search[order]=count&limit=10`
    );
    res.json(response.data);
  } catch (error) {
    console.error("Tag suggestion error:", error);
    res.json([]);
  }
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`Server CytusGallery berjalan di http://localhost:${PORT}`);
});
