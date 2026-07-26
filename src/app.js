//Import Modul
const express = require("express");
const rateLimit = require("express-rate-limit");
const path = require("path");
const axios = require("axios");
const ejs = require("ejs");
const fs = require("fs");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const authRoutes = require("./routes/auth");
const { checkUser, requireAuth } = require("./middlewares/authMiddleware");

//Setup Server
const app = express();
const PORT = process.env.PORT || 3000;

// Setup Rate Limiter
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).render("error", {
      message:
        "Terlalu banyak request dari IP ini. Sistem mendeteksi aktivitas yang tidak wajar. Silakan coba lagi setelah 1 menit.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

//Setup Trust Proxy
app.set("trust proxy", 1);

// Setup Template Engine EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Setup folder public untuk file statis (CSS, JS, gambar)
app.use(express.static(path.join(__dirname, "public")));

//Setup Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(checkUser);

app.use((req, res, next) => {
  res.locals.tags = req.query.tags || "";
  next();
});

// Setup Auth Routes
app.use(authRoutes);

//Middleware untuk file logo (Netlify)
app.get("/arona_doro.png", (req, res) => {
  // Gunakan __dirname agar path-nya relatif terhadap lokasi file app.js
  const logoPath = path.join(__dirname, "public", "arona_doro.png");

  // Baca file logo sebagai biner buffer
  fs.readFile(logoPath, (err, data) => {
    if (err) {
      console.error("Error reading logo file:", err);
      return res.status(404).send("Logo tidak ditemukan");
    }
    res.contentType("image/png");
    res.send(data);
  });
});

app.get("/profil", requireAuth, async (req, res) => {
  const prisma = require('./lib/prisma');
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { saves: true }
    });
    res.render("profil", { hideSearchbar: true, userProfile: user });
  } catch (error) {
    console.error(error);
    res.status(500).render("error", { message: "Gagal memuat profil." });
  }
});

app.post("/api/save/:id", requireAuth, async (req, res) => {
  const prisma = require('./lib/prisma');
  try {
    const postId = req.params.id;
    const userId = req.user.id;
    
    const existingSave = await prisma.savedContent.findUnique({
      where: { userId_postId: { userId, postId } }
    });
    
    if (existingSave) {
      await prisma.savedContent.delete({
        where: { id: existingSave.id }
      });
      res.json({ saved: false, message: "Berhasil dihapus dari koleksi." });
    } else {
      await prisma.savedContent.create({
        data: { userId, postId }
      });
      res.json({ saved: true, message: "Berhasil disimpan ke koleksi." });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal menyimpan konten." });
  }
});

//Setup Middleware untuk memblokir User-Agent yang mencurigakan (bot/scraper) & Rate Limiter
app.use((req, res, next) => {
  const userAgent = req.headers["user-agent"] || "";
  const blockedAgents = [
    "python-requests",
    "curl",
    "wget",
    "scrapy",
    "postman",
  ];

  const isBot = blockedAgents.some((bot) =>
    userAgent.toLowerCase().includes(bot),
  );

  if (isBot || userAgent.trim() === "") {
    return res.status(403).send("Akses ditolak. Bot/Scraper terdeteksi.");
  }
  next();
});

// Terapkan rate limiter ke semua route
app.use(limiter);

app.use((req, res, next) => {
  res.locals.tags = req.query.tags || "";
  if (req.method === "GET")
    res.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
  next();
});

//Base API URL
const baseTagURL = "https://danbooru.donmai.us/tags.json";
const basePostsURL = "https://danbooru.donmai.us/posts.json";
const baseCountsPostsURL = "https://danbooru.donmai.us/counts/posts.json";

// 1. Function Handler

async function getTopPostsThisMonth(limit, filter = "") {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, "0");
    const startOfMonth = `${year}-${month}-01`;

    const query = `order:score date:>=${startOfMonth} ${filter}`.trim();
    const params = { tags: query, limit: limit };
    const response = await axios.get(basePostsURL, { params: params });

    return response.data;
  } catch (error) {
    if (error.response && (error.response.status === 422 || error.response.status === 500)) {
      try {
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, "0");
        const startOfMonth = `${year}-${month}-01`;
        
        const fallbackQuery = `date:>=${startOfMonth} ${filter}`.trim();
        const fallbackResponse = await axios.get(basePostsURL, { params: { tags: fallbackQuery, limit: 100 } });
        let sorted = fallbackResponse.data.sort((a, b) => b.score - a.score);
        return sorted.slice(0, limit);
      } catch (fallbackErr) {
        return [];
      }
    }
    console.error("Gagal mengambil data Danbooru:", error.message);
    return [];
  }
}

async function getTopPosts(tags, filter = "", limit) {
  try {
    const query = `${tags} ${filter} order:score`.trim();
    const params = { tags: query, limit: limit };
    const response = await axios.get(basePostsURL, { params: params });
    return response.data;
  } catch (err) {
    if (err.response && (err.response.status === 422 || err.response.status === 500)) {
      try {
        const fallbackQuery = `${tags} ${filter}`.trim();
        const fallbackResponse = await axios.get(basePostsURL, { params: { tags: fallbackQuery, limit: 100 } });
        let sorted = fallbackResponse.data.sort((a, b) => b.score - a.score);
        return sorted.slice(0, limit);
      } catch (fallbackErr) {
        return [];
      }
    }
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
  const getCounts = await axios.get(baseCountsPostsURL, {
    params: {
      tags: `${tags} ${query}`,
    },
  });
  if (getCounts.data.counts.posts === null) {
    if (tags)
      fallbackResponse = await axios.get(baseCountsPostsURL, {
        params: { tags: tags },
      });
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
    res.status(500).render("error", {
      message: "Gagal mengambil data dari Danbooru API",
    });
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
    res.status(500).render("error", {
      message:
        "Gagal mengambil data. Kemungkinan server sedang sibuk, atau menggunakan lebih dari 2 tag sekaligus, atau telah mencapai batas halaman (>1000).",
    });
  }
};

const detail = async (req, res) => {
  try {
    const postId = req.params.id;
    const response = await axios.get(
      `https://danbooru.donmai.us/posts/${postId}.json`,
    );
    const post = response.data;
    
    // Check if the post is Explicit or Questionable
    if (post.rating === 'e' || post.rating === 'q') {
      return res.status(404).render("error", {
        message: "Konten tidak ditemukan. Konten mungkin dihapus atau disembunyikan karena rating."
      });
    }

    let isSaved = false;
    let followedTags = [];
    if (req.user) {
      const prisma = require('./lib/prisma');
      const saved = await prisma.savedContent.findUnique({
        where: { userId_postId: { userId: req.user.id, postId: postId } }
      });
      if (saved) isSaved = true;

      const follows = await prisma.followedTag.findMany({
        where: { userId: req.user.id }
      });
      followedTags = follows.map(f => f.tagName);
    }

    res.render("detail", { post: post, isSaved: isSaved, followedTags: followedTags });
  } catch (error) {
    console.error("Error fetching post details:", error);
    res.status(404).render("error", {
        message: "Konten tidak ditemukan."
    });
  }
};

app.post("/api/follow", requireAuth, async (req, res) => {
  const prisma = require('./lib/prisma');
  try {
    const { tagName, tagType } = req.body;
    const userId = req.user.id;
    
    const existing = await prisma.followedTag.findUnique({
      where: { userId_tagName: { userId, tagName } }
    });
    
    if (existing) {
      await prisma.followedTag.delete({
        where: { id: existing.id }
      });
      res.json({ followed: false, message: "Berhasil unfollow tag." });
    } else {
      // Get the latest post ID for this tag to start tracking
      let lastPostId = null;
      try {
        const dRes = await axios.get(`https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tagName)}&limit=1`);
        if (dRes.data && dRes.data.length > 0) {
          lastPostId = dRes.data[0].id;
        }
      } catch (e) {
        console.error("Failed to fetch latest post ID for tag", tagName);
      }

      await prisma.followedTag.create({
        data: { userId, tagName, tagType: parseInt(tagType), lastPostId }
      });
      res.json({ followed: true, message: "Berhasil follow tag." });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal memproses follow/unfollow." });
  }
});

app.get("/api/notifications/sync", requireAuth, async (req, res) => {
  const prisma = require('./lib/prisma');
  try {
    const userId = req.user.id;
    const ratingParam = req.query.rating || 'not_e';
    const follows = await prisma.followedTag.findMany({ where: { userId } });
    
    let newNotificationsCount = 0;
    
    // Process top 5 oldest checked tags to avoid rate limits
    const tagsToCheck = follows.sort((a, b) => a.updatedAt - b.updatedAt).slice(0, 5);
    
    let ratingFilter = '';
    if (ratingParam === 'g') {
       ratingFilter = '+rating:g';
    } else if (ratingParam === 'not_e') {
       ratingFilter = '+rating:s,g';
    } else {
       ratingFilter = '+-rating:e+-rating:q';
    }

    for (const tag of tagsToCheck) {
      try {
        const query = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tag.tagName)}${ratingFilter}&limit=1`;
        const dRes = await axios.get(query);
        const posts = dRes.data;
        
        if (posts && posts.length > 0) {
          const latestPost = posts[0];
          if (tag.lastPostId && latestPost.id > tag.lastPostId) {
            const previewUrl = latestPost.media_asset?.variants?.find(v => v.type === '360x360')?.url || latestPost.preview_file_url || null;
            // New post found!
            await prisma.notification.create({
              data: {
                userId,
                title: "Update Tag Baru",
                message: `Ada konten baru untuk tag yang Anda ikuti: ${tag.tagName.replace(/_/g, ' ')}`,
                link: `/posts/${latestPost.id}`,
                imageUrl: previewUrl,
                extension: latestPost.file_ext,
                rating: latestPost.rating
              }
            });
            newNotificationsCount++;
          }
          // Update lastPostId and updatedAt
          await prisma.followedTag.update({
            where: { id: tag.id },
            data: { lastPostId: latestPost.id, updatedAt: new Date() }
          });
        }
      } catch (err) {
        console.error("Sync error for tag", tag.tagName, err.message);
      }
    }
    
    const unread = await prisma.notification.count({ where: { userId, isRead: false } });
    const latestNotifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    res.json({ unreadCount: unread, notifications: latestNotifications, synced: newNotificationsCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal sinkronisasi notifikasi." });
  }
});

app.post("/api/notifications/read", requireAuth, async (req, res) => {
  const prisma = require('./lib/prisma');
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Gagal update status." });
  }
});

//3. Routes

// Route untuk halaman utama
app.get("/", root);
// Route untuk search
app.get("/search", search);
// Route untuk detail
app.get("/posts/:id", detail);
// Route Notifikasi
app.get("/notifikasi", requireAuth, async (req, res) => {
  const prisma = require('./lib/prisma');
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50 // limit to last 50
    });
    
    // Mark as read when page is visited
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true }
    });

    res.render("notifications", { notifications: notifications });
  } catch (error) {
    console.error(error);
    res.status(500).render("error", { message: "Gagal memuat notifikasi." });
  }
});

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
app.get("/tentang", (req, res) => res.render("tentang", { hideSearchbar: true }));

// Route untuk bantuan
app.get("/bantuan", (req, res) => {
  res.render("bantuan", { hideSearchbar: true });
});

//Run Server
app.listen(PORT, () => {
  console.log(`Server CytusGallery berjalan di http://[IP_ADDRESS]:${PORT}`);
});

module.exports = app;
