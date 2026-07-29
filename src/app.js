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
  // Fix Netlify Cache Issue for Auth & dynamic content
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
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

const multer = require('multer');
const os = require('os');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.post("/api/profil/upload", requireAuth, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Tidak ada file yang diunggah" });
  
  const base64Str = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  const prisma = require('./lib/prisma');
  
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl: base64Str }
    });
    res.json({ message: "Berhasil memperbarui foto profil", avatarUrl: base64Str });
  } catch(e) {
    console.error("Avatar upload error:", e);
    res.status(500).json({ error: "Gagal menyimpan foto profil" });
  }
});

app.get("/test-search", async (req, res) => {
  const prisma = require('./lib/prisma');
  try {
    const search = req.query.search || '';
    const rating = req.query.rating || '';
    
    let whereClause = { userId: "6087237b-e6b3-49fe-b290-93af95568a07" }; // Using user ID from crash log
    if (search) {
      const searchTags = search.trim().split(/\s+/).filter(t => t.length > 0);
      if (searchTags.length > 0) {
        whereClause.AND = searchTags.map(tag => ({
          tags: { contains: tag }
        }));
      }
    }
    if (rating) whereClause.rating = rating;

    const saves = await prisma.savedContent.findMany({
      where: whereClause,
      orderBy: { savedAt: 'desc' },
      take: 25
    });
    res.json(saves);
  } catch (error) {
    res.status(500).send(error.stack || error.message);
  }
});

app.get("/profil", requireAuth, async (req, res) => {
  const prisma = require('./lib/prisma');
  try {
    const search = req.query.search || '';
    const rating = req.query.rating || '';
    
    let whereClause = { userId: req.user.id };
    if (search) {
      const searchTags = search.trim().split(/\s+/).filter(t => t.length > 0);
      if (searchTags.length > 0) {
        whereClause.AND = searchTags.map(tag => ({
          tags: { contains: tag }
        }));
      }
    }
    if (rating) whereClause.rating = rating;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { followedTags: true }
    });
    const saves = await prisma.savedContent.findMany({
      where: whereClause,
      orderBy: { savedAt: 'desc' },
      take: 25
    });
    user.saves = saves;
    
    const totalSaves = await prisma.savedContent.count({ where: whereClause });
    res.render("profil", { hideSearchbar: true, userProfile: user, totalSaves, currentSearch: search, currentRating: rating });
  } catch (error) {
    console.error(error);
    if (error && error.message && error.message.includes('planLimitReached')) {
      return res.status(503).render("error", { message: "Batas Limit Server (Database) telah tercapai. Layanan profil sementara tidak tersedia." });
    }
    res.status(500).render("error", { message: "Gagal memuat profil." });
  }
});

app.get("/api/profil/saves", requireAuth, async (req, res) => {
  const prisma = require('./lib/prisma');
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const rating = req.query.rating || '';
    
    let whereClause = { userId: req.user.id };
    if (search) {
      const searchTags = search.trim().split(/\s+/).filter(t => t.length > 0);
      if (searchTags.length > 0) {
        whereClause.AND = searchTags.map(tag => ({
          tags: { contains: tag }
        }));
      }
    }
    if (rating) whereClause.rating = rating;
    
    const take = 25;
    const skip = (page - 1) * take;
    const saves = await prisma.savedContent.findMany({
      where: whereClause,
      orderBy: { savedAt: 'desc' },
      take,
      skip
    });
    res.json(saves);
  } catch (error) {
    res.status(500).json({ error: "Gagal memuat" });
  }
});

app.delete("/api/profil/delete", requireAuth, async (req, res) => {
  const prisma = require('./lib/prisma');
  try {
    const userId = req.user.id;
    // Hapus relasi
    await prisma.savedContent.deleteMany({ where: { userId } });
    await prisma.followedTag.deleteMany({ where: { userId } });
    await prisma.notification.deleteMany({ where: { userId } });
    // Hapus user
    await prisma.user.delete({ where: { id: userId } });
    
    res.clearCookie('token');
    res.json({ success: true, message: "Akun berhasil dihapus" });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: "Gagal menghapus akun." });
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
      let imageUrl = null, fileUrl = null, extension = null, rating = null, score = null, size = null, uploadedAt = null, source = null, tags = null;
      try {
        const dRes = await axios.get(`https://danbooru.donmai.us/posts/${postId}.json`);
        const post = dRes.data;
        imageUrl = post.media_asset?.variants?.find(v => v.type === '360x360')?.url || post.preview_file_url || null;
        fileUrl = post.file_url || post.large_file_url || null;
        extension = post.file_ext || null;
        rating = post.rating || null;
        score = post.score || null;
        size = post.file_size || null;
        uploadedAt = post.created_at ? new Date(post.created_at) : null;
        source = post.source || null;
        tags = post.tag_string || null;
      } catch (e) {
        console.error("Failed to fetch post details for saving", e.message);
      }
      await prisma.savedContent.create({
        data: { userId, postId, imageUrl, fileUrl, extension, rating, score, size, uploadedAt, source, tags }
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

// Removed redundant middleware that caused caching bugs

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

  return {
    totalPosts,
    totalPages: Math.ceil(totalPosts / limit)
  };
}

async function getFollowedContents(userId, filterQuery, page, limit, isBypass) {
  const prisma = require('./lib/prisma');
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { followedTags: true }
  });

  if (!user || user.followedTags.length === 0) {
    return { posts: [], totalPages: 0, totalPosts: 0, hasFollowedTags: false };
  }

  let baseTags = filterQuery || "";
  if (!isBypass) {
    baseTags += " -rating:e -rating:q";
  }

  // Danbooru max limit is 200. To support deep pagination, we fetch multiple pages if needed.
  const postsNeeded = page * limit;
  const chunkLimit = 200;
  const chunksNeeded = Math.ceil((postsNeeded + limit) / chunkLimit); // Fetch enough for next page
  
  // Cap at 15 chunks (3000 posts deep per tag)
  const maxChunks = 15; 
  const fetchChunks = Math.min(chunksNeeded, maxChunks);

  const requestFns = [];
  user.followedTags.forEach(tag => {
    for (let c = 1; c <= fetchChunks; c++) {
      requestFns.push(() => 
        axios.get(basePostsURL, {
          params: {
            tags: `${tag.tagName} ${baseTags}`.trim(),
            page: c,
            limit: chunkLimit
          }
        }).catch(e => ({ data: [] }))
      );
    }
  });

  const results = [];
  const batchSize = 5;
  for (let i = 0; i < requestFns.length; i += batchSize) {
    const batch = requestFns.slice(i, i + batchSize).map(fn => fn());
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
  }
  
  let allPosts = [];
  let hasMore = false;
  results.forEach(res => {
    if (res.data && Array.isArray(res.data)) {
      allPosts = allPosts.concat(res.data);
      if (res.data.length >= chunkLimit) {
        hasMore = true;
      }
    }
  });

  const uniquePosts = [];
  const seenIds = new Set();
  for (const p of allPosts) {
    if (p && p.id && !seenIds.has(p.id) && p.large_file_url) {
      seenIds.add(p.id);
      uniquePosts.push(p);
    }
  }

  // Sort by ID descending (newest first)
  uniquePosts.sort((a, b) => b.id - a.id);

  const startIndex = (page - 1) * limit;
  const paginatedPosts = uniquePosts.slice(startIndex, startIndex + limit);

  const maxPages = Math.floor((maxChunks * chunkLimit) / limit);
  let totalPages = Math.ceil(uniquePosts.length / limit);
  
  if (hasMore) {
    totalPages = maxPages;
  } else {
    totalPages = Math.min(totalPages, maxPages);
  }

  return { 
    posts: paginatedPosts, 
    totalPages: totalPages, 
    totalPosts: uniquePosts.length,
    hasFollowedTags: true 
  };
}

//2. Functional Routes

const root = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const isLazyLoadEnabled = req.query.lazyload === "true";

    const tab = req.query.tab || "contents";
    let posts = [];
    let totalPosts = 0;
    let totalPages = 0;
    let hasFollowedTags = false;

    if (res.locals.user) {
      try {
        const prisma = require('./lib/prisma');
        const followedCount = await prisma.followedTag.count({ where: { userId: res.locals.user.id } });
        hasFollowedTags = followedCount > 0;
      } catch (e) {
        hasFollowedTags = false;
      }
    }

    if (tab === "followed" && res.locals.user) {
      const result = await getFollowedContents(res.locals.user.id, "", page, limit, res.locals.isBypass);
      posts = result.posts;
      totalPosts = result.totalPosts;
      totalPages = result.totalPages;
      hasFollowedTags = result.hasFollowedTags;
    } else {
      let baseTags = "";
      if (!res.locals.isBypass) {
        baseTags = "-rating:e -rating:q";
      }
      const contentsParams = { tags: baseTags, page: page, limit: limit };
      const contents = await axios.get(basePostsURL, { params: contentsParams });
      posts = contents.data;
      totalPosts = (await getTotalPosts(limit)).totalPosts;
      totalPages = (await getTotalPosts(limit)).totalPages;
    }

    let sliderPosts = [];
    let popularTags = [];
    let popularCharacters = [];

    popularTags = await getSliderTags(3);
    popularCharacters = await getSliderTags(4);

    let savedPostIds = new Set();
    if (res.locals.user) {
      const prisma = require('./lib/prisma');
      const saves = await prisma.savedContent.findMany({
        where: { userId: res.locals.user.id },
        select: { postId: true }
      });
      savedPostIds = new Set(saves.map(s => s.postId));
    }

    res.render("index", {
      posts: posts,
      savedPostIds: savedPostIds,
      sliderPosts: sliderPosts,
      popularTags: popularTags,
      popularCharacters: popularCharacters,
      currentPage: page,
      tagsForPagination: "",
      totalPages: totalPages,
      totalPosts: totalPosts,
      limit: limit,
      isLazyLoadEnabled: isLazyLoadEnabled,
      currentTab: tab,
      hasFollowedTags: hasFollowedTags
    });
  } catch (error) {
    console.error("Error fetching homepage data:", error);
    if (error && error.message && error.message.includes('planLimitReached')) {
      return res.status(503).render("error", { message: "Batas Limit Server (Database) telah tercapai. Layanan ini sementara tidak tersedia." });
    }
    res.status(500).render("error", {
      message: "Gagal mengambil data dari Danbooru API",
    });
  }
};

const search = async (req, res) => {
  const allowedKeys = ['tags', 'page', 'limit', 'tab', 'query', 'lazyload'];
  const currentKeys = Object.keys(req.query);
  const hasInvalidKeys = currentKeys.some(key => !allowedKeys.includes(key));
  
  if (hasInvalidKeys) {
    const validParams = new URLSearchParams();
    allowedKeys.forEach(k => {
      if (req.query[k]) validParams.set(k, req.query[k]);
    });
    const qs = validParams.toString();
    return res.redirect(`/search${qs ? '?' + qs : ''}`);
  }

  const userTags = (req.query.tags || "").trim();
  const filterQuery = (req.query.query || "").trim();
  const allTags = `${userTags} ${filterQuery}`;

  if (!allTags) return res.redirect("/");

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const isLazyLoadEnabled = req.query.lazyload === "true";

    const tab = req.query.tab || "contents";
    let posts = [];
    let totalPages = 0;
    let totalPosts = 0;
    let hasFollowedTags = false;
    let sliderPosts = [];
    let popularTags = [];
    let popularCharacters = [];

    if (res.locals.user) {
      try {
        const prisma = require('./lib/prisma');
        const followedCount = await prisma.followedTag.count({ where: { userId: res.locals.user.id } });
        hasFollowedTags = followedCount > 0;
      } catch (e) {
        hasFollowedTags = false;
      }
    }

    if (!userTags && tab === "followed" && res.locals.user) {
      const result = await getFollowedContents(res.locals.user.id, filterQuery, page, limit, res.locals.isBypass);
      posts = result.posts;
      totalPosts = result.totalPosts;
      totalPages = result.totalPages;
      hasFollowedTags = result.hasFollowedTags;
    } else {
      const contentsParams = { tags: allTags, page: page, limit: limit };
      const contents = await axios.get(basePostsURL, { params: contentsParams });
      posts = contents.data;
      const stats = await getTotalPostsWithParams(userTags, filterQuery, limit);
      totalPages = stats.totalPages;
      totalPosts = stats.totalPosts;
    }

    let smartSearchTags = [];
    let invalidTag = null;
    let actualUserTags = userTags;
    let allTagsFinal = allTags;

    if (posts.length === 0 && userTags) {
      try {
        const tagSuggestRes = await axios.get("https://danbooru.donmai.us/tags.json", {
          params: {
            "search[name_matches]": `*${userTags}*`,
            "search[order]": "count",
            "limit": 6
          }
        });
        
        const suggestions = tagSuggestRes.data;
        // Danbooru sometimes returns empty or unrelated tags, filter by count > 0 if needed
        if (suggestions && suggestions.length > 0) {
          invalidTag = userTags;
          smartSearchTags = suggestions;
          actualUserTags = suggestions[0].name;
          allTagsFinal = `${actualUserTags} ${filterQuery}`;
          
          const newParams = { tags: allTagsFinal, page: page, limit: limit };
          const newContents = await axios.get(basePostsURL, { params: newParams });
          posts = newContents.data;
          
          const newStats = await getTotalPostsWithParams(actualUserTags, filterQuery, limit);
          totalPages = newStats.totalPages;
          totalPosts = newStats.totalPosts;
        }
      } catch (err) {
         console.error("Smart Search Error:", err.message);
      }
    }

    if (page === 1) {
      actualUserTags
        ? (sliderPosts = await getTopPosts(actualUserTags, filterQuery, 15))
        : (sliderPosts = await getTopPostsThisMonth(15, filterQuery));
    }

    if (!userTags) {
      popularTags = await getSliderTags(3);
      popularCharacters = await getSliderTags(4);
    }

    let savedPostIds = new Set();
    if (res.locals.user) {
      const prisma = require('./lib/prisma');
      const saves = await prisma.savedContent.findMany({
        where: { userId: res.locals.user.id },
        select: { postId: true }
      });
      savedPostIds = new Set(saves.map(s => s.postId));
    }

    res.render("search", {
      posts: posts,
      savedPostIds: savedPostIds,
      sliderPosts: sliderPosts,
      popularTags: popularTags,
      popularCharacters: popularCharacters,
      currentPage: page,
      totalPages: totalPages,
      totalPosts: totalPosts,
      tagsForPagination: actualUserTags,
      userTags: actualUserTags,
      originalUserTags: userTags,
      invalidTag: invalidTag,
      smartSearchTags: smartSearchTags,
      limit: limit,
      isLazyLoadEnabled: isLazyLoadEnabled,
      currentTab: tab,
      hasFollowedTags: hasFollowedTags,
      filterQuery: filterQuery
    });
  } catch (error) {
    console.error("Error fetching search data:", error);
    if (error && error.message && error.message.includes('planLimitReached')) {
      return res.status(503).render("error", { message: "Batas Limit Server (Database) telah tercapai. Layanan ini sementara tidak tersedia." });
    }
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
    if ((post.rating === 'e' || post.rating === 'q') && !res.locals.isBypass) {
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
    if (error && error.message && error.message.includes('planLimitReached')) {
      return res.status(503).render("error", { message: "Batas Limit Server (Database) telah tercapai. Layanan ini sementara tidak tersedia." });
    }
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
    
    // Ambil data notifikasi terkini dari database secepat mungkin
    const unread = await prisma.notification.count({ where: { userId, isRead: false } });
    const latestNotifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    // Langsung kembalikan response agar UI memuat dengan cepat
    res.json({ unreadCount: unread, notifications: latestNotifications, synced: 0 });

    // Jalankan proses sinkronisasi dengan Danbooru API di background
    // Telah dipindahkan seutuhnya ke Global Background Worker untuk menghindari lonjakan operasi Database.
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Gagal memuat notifikasi." });
    }
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
      orderBy: { createdAt: 'desc' }
    });
    
    // Notifications are marked as read client-side via IntersectionObserver

    res.render("notifications", { notifications: notifications, hideSearchbar: true });
  } catch (error) {
    console.error(error);
    if (error && error.message && error.message.includes('planLimitReached')) {
      return res.status(503).render("error", { message: "Batas Limit Server (Database) telah tercapai. Halaman notifikasi sementara tidak tersedia." });
    }
    res.status(500).render("error", { message: "Gagal memuat notifikasi." });
  }
});

app.post("/api/notifications/delete", requireAuth, async (req, res) => {
  const prisma = require('./lib/prisma');
  try {
    const { action, id, date } = req.body;
    
    if (action === 'all') {
      await prisma.notification.deleteMany({
        where: { userId: req.user.id }
      });
    } else if (action === 'day' && id) {
      const ids = id.split(',');
      await prisma.notification.deleteMany({
        where: {
          userId: req.user.id,
          id: { in: ids }
        }
      });
    } else if (action === 'single' && id) {
      await prisma.notification.delete({
        where: { id: id }
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Gagal menghapus notifikasi." });
  }
});

app.post("/api/notifications/mark-read", requireAuth, async (req, res) => {
  const prisma = require('./lib/prisma');
  try {
    const { ids } = req.body;
    if (ids && ids.length > 0) {
      await prisma.notification.updateMany({
        where: {
          id: { in: ids },
          userId: req.user.id
        },
        data: { isRead: true }
      });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal update status notifikasi" });
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

// Background Worker for Notifications
setInterval(async () => {
  const prisma = require('./lib/prisma');
  const axios = require('axios');
  try {
    const tagsToCheck = await prisma.followedTag.findMany({
      orderBy: { updatedAt: 'asc' },
      take: 50,
      include: { user: true }
    });
    if (!tagsToCheck || tagsToCheck.length === 0) return;

    for (const tag of tagsToCheck) {
      try {
        // Gunakan rating Safe & Sensitive (not_e) sebagai standar untuk pengecekan background
        let ratingFilter = '+rating:s,g';
        // Bypass untuk user dengan akses explicit
        if (process.env.BYPASSEXPLICITCONTENTACCOUNT && tag.user && tag.user.email === process.env.BYPASSEXPLICITCONTENTACCOUNT) {
          ratingFilter = '';
        }
        
        const query = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tag.tagName)}${ratingFilter}&limit=100`;
        const dRes = await axios.get(query);
        const posts = dRes.data;
        
        if (posts && posts.length > 0) {
          let maxPostId = tag.lastPostId || 0;
          
          for (const post of posts) {
            if (tag.lastPostId && post.id > tag.lastPostId) {
              const previewUrl = post.media_asset?.variants?.find(v => v.type === '360x360')?.url || post.preview_file_url || null;
              let tagTypeName = "General";
              if (tag.tagType === 1) tagTypeName = "Artist";
              if (tag.tagType === 3) tagTypeName = "Copyright";
              if (tag.tagType === 4) tagTypeName = "Character";
              
              const toTitleCase = (str) => str.replace(/\b\w/g, char => char.toUpperCase());
              const tagNameFormatted = toTitleCase(tag.tagName.replace(/_/g, ' '));

              // Check duplicate
              const existingNotif = await prisma.notification.findFirst({
                where: { userId: tag.userId, link: `/posts/${post.id}` }
              });

              if (!existingNotif) {
                await prisma.notification.create({
                  data: {
                    userId: tag.userId,
                    title: 'Konten Baru',
                    message: `**${tagNameFormatted}** baru dari **${tagTypeName}** yang Anda ikuti`,
                    link: `/posts/${post.id}`,
                    imageUrl: previewUrl,
                    extension: post.file_ext,
                    rating: post.rating,
                    createdAt: post.created_at ? new Date(post.created_at) : new Date()
                  }
                });
              }
            }
            if (post.id > maxPostId) {
              maxPostId = post.id;
            }
          }
          
          // Update timestamp agar berotasi di antrean
          await prisma.followedTag.update({
            where: { id: tag.id },
            data: { lastPostId: maxPostId, updatedAt: new Date() }
          });
        } else {
          // Rotasi jika tidak ada post
          await prisma.followedTag.update({
            where: { id: tag.id },
            data: { updatedAt: new Date() }
          });
        }
      } catch (err) {
        // Rotasi jika error
        await prisma.followedTag.update({
          where: { id: tag.id },
          data: { updatedAt: new Date() }
        });
      }
    }
  } catch (error) {
    console.error("Background sync error:", error.message);
  }
}, 5 * 60 * 1000); // Berjalan setiap 5 menit

//Run Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server CytusGallery berjalan di http://[0.0.0.0]:${PORT}`);
});

module.exports = app;
