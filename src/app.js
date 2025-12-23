//Import Modul
const express = require("express");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

//Setup Server
const app = express();
const PORT = process.env.PORT || 3000;

// Setup Template Engine EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Setup folder public untuk file statis (CSS, JS, gambar)
app.use(express.static(path.join(__dirname, "public")));

//Setup Middleware
app.use((req, res, next) => {
  res.locals.tags = req.query.tags || "";
  next();
});

//Base API URL
const baseTagURL = "https://danbooru.donmai.us/tags.json";
const basePostsURL = "https://danbooru.donmai.us/posts.json";
const baseCountsPostsURL = "https://danbooru.donmai.us/counts/posts.json";

// 1. Function Handler

async function getTopPostsThisMonth(limit, filter) {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, "0");
    const startOfMonth = `${year}-${month}-01`;

    const query = `order:score date:>=${startOfMonth} ${filter}`;
    const params = { tags: query, limit: limit };
    const response = await axios.get(basePostsURL, { params: params });

    return response.data;
  } catch (error) {
    console.error("Gagal mengambil data Danbooru:", error);
    return [];
  }
}

async function getTopPosts(tags, filter, limit) {
  try {
    const query = `${tags} ${filter} order:score`;
    const params = { tags: query, limit: limit };
    const response = await axios.get(basePostsURL, { params: params });
    return response.data;
  } catch (err) {
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

async function getTotalPostsWithParams(tags, query, limit) {
  let totalPosts;
  let fallbackResponse;
  const getCounts = await axios.get(
    `${baseCountsPostsURL}?tags=${tags} ${query}`
  );
  if (getCounts.data.counts.posts === null) {
    if (tags)
      fallbackResponse = await axios.get(`${baseCountsPostsURL}?tags=${tags}`);
    else fallbackResponse = await axios.get(baseCountsPostsURL);
    totalPosts = fallbackResponse.data.counts.posts;
  } else {
    totalPosts = getCounts.data.counts.posts;
  }

  return Math.ceil(totalPosts / limit);
}

//2. Functional Routes

const root = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const isLazyLoadEnabled = req.query.lazyload === "true";

    const contentsParams = { page: page, limit: limit };
    const contents = await axios.get(basePostsURL, { params: contentsParams });
    const posts = contents.data;

    let totalPosts;
    let totalPages;
    let sliderPosts = [];
    let popularTags = [];
    let popularCharacters = [];

    totalPosts = (await getTotalPosts(limit)).totalPosts;
    totalPages = (await getTotalPosts(limit)).totalPages;
    popularTags = await getSliderTags(3);
    popularCharacters = await getSliderTags(4);

    if (page === 1) sliderPosts = await getTopPostsThisMonth(15);

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
};

const search = async (req, res) => {
  const userTags = (req.query.tags || "").trim();
  const filterQuery = (req.query.query || "").trim();
  const allTags = `${userTags} ${filterQuery}`;

  if (!allTags) return res.redirect("/");

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const isLazyLoadEnabled = req.query.lazyload === "true";

    let posts;
    let totalPages;
    let sliderPosts = [];
    let popularTags = [];
    let popularCharacters = [];

    const contentsParams = { tags: allTags, page: page, limit: limit };
    const contents = await axios.get(basePostsURL, { params: contentsParams });

    posts = contents.data;
    totalPages = await getTotalPostsWithParams(userTags, filterQuery, limit);

    if (page === 1) {
      userTags
        ? (sliderPosts = await getTopPosts(userTags, filterQuery, 15))
        : (sliderPosts = await getTopPostsThisMonth(15, filterQuery));
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
};

const detail = async (req, res) => {
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
};

//3. Routes

// Route untuk halaman utama
app.get("/", root);
// Route untuk search
app.get("/search", search);
// Route untuk detail
app.get("/posts/:id", detail);

// API Endpoint untuk Auto-suggest Tag
app.get("/api/tagsuggest", async (req, res) => {
  const searchTerm = req.query.term;
  if (!searchTerm) return res.json([]);

  try {
    // Panggil API Danbooru untuk mencari tag
    // search[order]=count -> Mengurutkan berdasarkan jumlah post (terbanyak dulu)
    const suggestParams = {
      "search[name_matches]": `${searchTerm}*`,
      "search[order]": "count",
      limit: 10,
    };

    const response = await axios.get(baseTagURL, { params: suggestParams });
    const postExist = response.data.filter((tag) => tag.post_count > 0);

    res.json(postExist);
  } catch (error) {
    console.error("Tag suggestion error:", error);
    res.json([]);
  }
});

// Route untuk tentang
app.get("/tentang", (req, res) => res.render("tentang"));

// Route untuk bantuan
app.get("/bantuan", (req, res) => {
  res.render("bantuan");
});

//Run Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server CytusGallery berjalan di http://0.0.0.0:${PORT}`);
});
