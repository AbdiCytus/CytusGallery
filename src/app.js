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
    const limit = parseInt(req.query.limit) || 25;
    const isLazyLoadEnabled = req.query.lazyload === "true";

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

    let sliderPosts = [];
    let popularTags = [];
    let popularCharacters = [];

    // Hanya ambil data slider jika di halaman pertama
    if (page === 1) {
      const sliderResponse = await axios.get(
        `https://danbooru.donmai.us/posts.json?order:score&limit=15`
      );
      sliderPosts = sliderResponse.data;
      // Ambil dan acak data tag
      const tagsResponse = await axios.get(
        `https://danbooru.donmai.us/tags.json?search[category]=3&search[order]=count&limit=100`
      );
      let tagsPool = tagsResponse.data;
      for (let i = tagsPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tagsPool[i], tagsPool[j]] = [tagsPool[j], tagsPool[i]];
      }
      popularTags = tagsPool.slice(0, 15);

      const charTagsResponse = await axios.get(
        `https://danbooru.donmai.us/tags.json?search[category]=4&search[order]=count&limit=100`
      );
      let charTagsPool = charTagsResponse.data;
      for (let i = charTagsPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [charTagsPool[i], charTagsPool[j]] = [charTagsPool[j], charTagsPool[i]];
      }
      popularCharacters = charTagsPool.slice(0, 15);
    }

    res.render("index", {
      posts: posts,
      sliderPosts: sliderPosts,
      popularTags: popularTags,
      popularCharacters: popularCharacters,
      currentPage: page,
      totalPages: totalPages,
      limit: limit,
      tags: "", // Tag kosong untuk halaman utama
      userTags: "",
      isLazyLoadEnabled: isLazyLoadEnabled,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Gagal mengambil data dari Danbooru API");
  }
});

app.get("/search", async (req, res) => {
  const allTags = req.query.tags || "";
  if (!allTags) return res.redirect("/");

  // Memisahkan tag filter dari tag yang diketik pengguna
  const userTags = allTags
    .split(" ")
    .filter(
      (tag) =>
        !tag.startsWith("rating:") &&
        !tag.startsWith("-rating:") &&
        !tag.startsWith("filetype:")
    )
    .join(" ");

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const isLazyLoadEnabled = req.query.lazyload === "true";

    // Ambil total post yang akurat menggunakan semua tag filter
    let countResponse = await axios.get(
      `https://danbooru.donmai.us/counts/posts.json?tags=${allTags}`
    );

    if (countResponse.data.counts.posts == null) {
      countResponse = await axios.get(
        `https://danbooru.donmai.us/counts/posts.json?${allTags}`
      );
    }
    const totalPosts = countResponse.data.counts.posts;
    const totalPages = Math.ceil(totalPosts / limit);

    let postsResponse = await axios.get(
      `https://danbooru.donmai.us/posts.json?tags=${allTags}&page=${page}&limit=${limit}`
    );
    const posts = postsResponse.data;

    // --- TAMBAHKAN LOGIKA SLIDER DI SINI ---
    let sliderPosts = [];
    let popularTags = [];
    let popularCharacters = [];

    if (page === 1) {
      const sliderApiTags = `order:score ${allTags}`;
      const sliderResponse = await axios.get(
        `https://danbooru.donmai.us/posts.json?tags=${sliderApiTags}&limit=15`
      );
      sliderPosts = sliderResponse.data;
      // Ambil dan acak data tag
      const tagsResponse = await axios.get(
        `https://danbooru.donmai.us/tags.json?search[category]=3&search[order]=count&limit=100`
      );
      let tagsPool = tagsResponse.data;
      for (let i = tagsPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tagsPool[i], tagsPool[j]] = [tagsPool[j], tagsPool[i]];
      }
      popularTags = tagsPool.slice(0, 15);
      const charTagsResponse = await axios.get(
        `https://danbooru.donmai.us/tags.json?search[category]=4&search[order]=count&limit=100`
      );
      let charTagsPool = charTagsResponse.data;
      for (let i = charTagsPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [charTagsPool[i], charTagsPool[j]] = [charTagsPool[j], charTagsPool[i]];
      }
      popularCharacters = charTagsPool.slice(0, 15);
    }

    res.render("search", {
      posts: posts,
      sliderPosts: sliderPosts,
      popularTags: popularTags,
      popularCharacters: popularCharacters,
      currentPage: page,
      totalPages: totalPages,
      limit: limit,
      tags: allTags,
      userTags: userTags,
      isLazyLoadEnabled: isLazyLoadEnabled,
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
