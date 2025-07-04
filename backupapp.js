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

const baseTagURL = "https://danbooru.donmai.us/tags.json";
const basePostsURL = "https://danbooru.donmai.us/posts.json";
const baseCountsPostsURL = "https://danbooru.donmai.us/counts/posts.json";

async function getTopPostsThisMonth(limit, filter) {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, "0");
    const startOfMonth = `${year}-${month}-01`;

    const query = `order:score date:>=${startOfMonth}`;
    const response = await axios.get(basePostsURL, {
      params: {
        tags: query,
        limit: limit,
      },
    });

    return response.data;
  } catch (error) {
    console.error("Gagal mengambil data Danbooru:", error);
    return [];
  }
}

async function getSliderTags(category) {
  const tagsResponse = await axios.get(baseTagURL, {
    params: {
      "search[category]": category,
      "search[order]": "count",
      limit: 100,
    },
  });
  const pool = tagsResponse.data;
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 15);
}

async function getTotalPosts(limit) {
  const getCounts = await axios.get(baseCountsPostsURL);
  const totalPosts = getCounts.data.counts.posts;
  const totalPages = Math.ceil(totalPosts / limit);
  return { totalPosts, totalPages };
}

// Route untuk halaman utama
app.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const isLazyLoadEnabled = req.query.lazyload === "true";

    const postsResponse = await axios.get(
      `${basePostsURL}?page=${page}&limit=${limit}`
    );
    const posts = postsResponse.data;

    let totalPosts;
    let totalPages;
    let sliderPosts = [];
    let popularTags = [];
    let popularCharacters = [];

    totalPosts = (await getTotalPosts(limit)).totalPosts;
    totalPages = (await getTotalPosts(limit)).totalPages;
    popularTags = await getSliderTags(3);
    popularCharacters = await getSliderTags(4);

    if (page === 1) sliderPosts = await getTopPostsThisMonth(15).then(posts);

    res.render("index", {
      posts: posts,
      sliderPosts: sliderPosts,
      popularTags: popularTags,
      popularCharacters: popularCharacters,
      currentPage: page,
      tagsForPagination: "",
      totalPages: totalPages,
      limit: limit,
      isLazyLoadEnabled: isLazyLoadEnabled,
    });
  } catch (error) {
    console.error("Error fetching homepage data:", error);
    res.status(500).send("Gagal mengambil data dari Danbooru API");
  }
});

// Route untuk search
app.get("/search", async (req, res) => {
  const userTags = (req.query.tags || "").trim();
  const filterQuery = (req.query.query || "").trim();
  const allTags = `${userTags} ${filterQuery}`;

  if (!allTags) return res.redirect("/");

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const isLazyLoadEnabled = req.query.lazyload === "true";

    let totalPosts;
    const countResponse = await axios.get(
      `https://danbooru.donmai.us/counts/posts.json?tags=${allTags}`
    );

    if (countResponse.data.counts.posts === null) {
      if (userQueryTags) {
        const fallbackResponse = await axios.get(
          `https://danbooru.donmai.us/counts/posts.json?tags=${userTags}`
        );
        totalPosts = fallbackResponse.data.counts.posts;
      } else {
        const totalSiteResponse = await axios.get(
          `https://danbooru.donmai.us/counts/posts.json`
        );
        totalPosts = totalSiteResponse.data.counts.posts;
      }
    } else {
      totalPosts = countResponse.data.counts.posts;
    }

    const totalPages = Math.ceil(totalPosts / limit);

    const postsResponse = await axios.get(
      `https://danbooru.donmai.us/posts.json?tags=${allTags}&page=${page}&limit=${limit}`
    );
    const posts = postsResponse.data;

    let sliderPosts = [];
    let popularTags = [];
    let popularCharacters = [];

    if (page === 1) {
      const sliderApiTags = `${allTags} order:score`;
      try {
        const sliderResponse = await axios.get(
          `https://danbooru.donmai.us/posts.json?tags=${sliderApiTags}&limit=15`
        );
        sliderPosts = sliderResponse.data;
      } catch (sliderError) {
        sliderPosts = [];
      }
    }

    if (!userTags) {
      popularTags = await getSliderTags(3);
      popularCharacters = await getSliderTags(4);
    }

    res.render("search", {
      posts: posts,
      sliderPosts: sliderPosts,
      popularTags: popularTags,
      popularCharacters: popularCharacters,
      currentPage: page,
      totalPages: totalPages,
      tagsForPagination: allTags,
      userTags: userTags,
      limit: limit,
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

// Rute untuk halaman Tentang
app.get("/tentang", (req, res) => {
  res.render("tentang"); // Akan merender file tentang.ejs
});

// Rute untuk halaman Bantuan
app.get("/bantuan", (req, res) => {
  res.render("bantuan"); // Akan merender file bantuan.ejs
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`Server CytusGallery berjalan di http://localhost:${PORT}`);
});
