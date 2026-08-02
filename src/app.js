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
  validate: { ip: false, xForwardedForHeader: false },
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

app.get("/analitik", requireAuth, async (req, res) => {
  const prisma = require('./lib/prisma');
  const axios = require('axios').create({
    headers: { 'User-Agent': 'CytusGallery/1.0 (by Abdi)' }
  });
  // Danbooru: 1=artist, 3=copyright, 4=character
  const ALLOWED_CATEGORIES = [1, 3, 4];
  const CAT_LABELS = { 1: 'Artist', 3: 'Copyright', 4: 'Character' };
  
  try {
    const userId = req.user.id;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Promise 1: Global Tags (Cached)
    const getGlobalTags = async () => {
      const cacheKey = 'analitik_globalTags';
      if (apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < CACHE_TTL) return apiCache[cacheKey].data;
      const globalTags = { copyright: [], character: [], artist: [] };
      const catMap = { 3: 'copyright', 4: 'character', 1: 'artist' };
      try {
        await Promise.all(ALLOWED_CATEGORIES.map(async (cat) => {
          const resp = await axios.get('https://danbooru.donmai.us/tags.json', {
            params: { 'search[category]': cat, 'search[order]': 'count', 'search[is_deprecated]': false, 'limit': 10 },
            timeout: 5000
          });
          if (resp.data && Array.isArray(resp.data)) globalTags[catMap[cat]] = resp.data.map(t => ({ name: t.name, count: t.post_count, category: t.category }));
        }));
        apiCache[cacheKey] = { timestamp: Date.now(), data: globalTags };
      } catch(e) {}
      return globalTags;
    };

    // Promise 2: Trending Tags (Cached, diparalelkan)
    const getTrendingTags = async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().split('T')[0];
      const lastWeek = new Date(yesterday);
      lastWeek.setDate(yesterday.getDate() - 7);
      const wStr = lastWeek.toISOString().split('T')[0];
      
      const lastMonth = new Date(yesterday);
      lastMonth.setDate(yesterday.getDate() - 30);
      const mStr = lastMonth.toISOString().split('T')[0];
      
      const lastQuarter = new Date(yesterday);
      lastQuarter.setDate(yesterday.getDate() - 90);
      const qStr = lastQuarter.toISOString().split('T')[0];

      const cacheKey = 'analitik_trendingTags_' + yStr;
      if (apiCache[cacheKey]) return apiCache[cacheKey].data;
      
      const trendingTags = { 
        day: { copyright: [], character: [], artist: [] }, 
        week: { copyright: [], character: [], artist: [] },
        month: { copyright: [], character: [], artist: [] }, 
        quarter: { copyright: [], character: [], artist: [] } 
      };

      const periods = [
        { key: 'day', ageFilter: `date:${yStr} order:score` },
        { key: 'week', ageFilter: `date:${wStr}..${yStr} order:score` },
        { key: 'month', ageFilter: `date:${mStr}..${yStr} order:score` },
        { key: 'quarter', ageFilter: `date:${qStr}..${yStr} order:score` }
      ];
      try {
        await Promise.all(periods.map(async (period) => {
          try {
            const resp = await axios.get('https://danbooru.donmai.us/posts.json', {
              params: { tags: period.ageFilter, limit: 200, only: 'tag_string_copyright,tag_string_character,tag_string_artist,score' },
              timeout: 12000
            });
            if (resp.data && Array.isArray(resp.data)) {
              const counts = { copyright: {}, character: {}, artist: {} };
              const scores = { copyright: {}, character: {}, artist: {} };
              resp.data.forEach(post => {
                const s = post.score || 0;
                if (post.tag_string_copyright) post.tag_string_copyright.split(' ').forEach(t => { if (t) { counts.copyright[t] = (counts.copyright[t] || 0) + 1; scores.copyright[t] = (scores.copyright[t] || 0) + s; } });
                if (post.tag_string_character) post.tag_string_character.split(' ').forEach(t => { if (t) { counts.character[t] = (counts.character[t] || 0) + 1; scores.character[t] = (scores.character[t] || 0) + s; } });
                if (post.tag_string_artist) post.tag_string_artist.split(' ').forEach(t => { if (t) { counts.artist[t] = (counts.artist[t] || 0) + 1; scores.artist[t] = (scores.artist[t] || 0) + s; } });
              });
              const allNames = new Set();
              ['copyright', 'character', 'artist'].forEach(cat => {
                Object.entries(counts[cat]).sort((a,b) => b[1]-a[1]).slice(0, 10).forEach(([name]) => allNames.add(name));
              });
              const postCounts = {};
              if (allNames.size > 0) {
                try {
                  const lookupResp = await axios.get('https://danbooru.donmai.us/tags.json', {
                    params: { 'search[name_comma]': [...allNames].join(','), 'limit': 30 },
                    timeout: 5000
                  });
                  if (lookupResp.data) lookupResp.data.forEach(t => { postCounts[t.name] = t.post_count; });
                } catch(e) {}
              }
              ['copyright', 'character', 'artist'].forEach(cat => {
                trendingTags[period.key][cat] = Object.entries(counts[cat])
                  .sort((a,b) => b[1]-a[1]).slice(0, 10)
                  .map(([name, hits]) => ({ name, hits, totalPosts: postCounts[name] || 0, score: scores[cat][name] || 0 }));
              });
            }
          } catch(e) {}
        }));
        apiCache[cacheKey] = { timestamp: Date.now(), data: trendingTags };
      } catch(e) {}
      return trendingTags;
    };

    // Promise 3: Followed Stats
    const getFollowedStats = async () => {
      const [followedTags, notifications] = await Promise.all([
        prisma.followedTag.findMany({ where: { userId, tagType: { in: ALLOWED_CATEGORIES } } }),
        prisma.notification.findMany({ where: { userId, createdAt: { gte: oneYearAgo } } })
      ]);
      const followedTagNames = followedTags.map(t => t.tagName);
      const followedTagTypes = {};
      const formattedToOriginal = {};
      const toTitleCase = (str) => str.replace(/\b\w/g, char => char.toUpperCase());
      followedTags.forEach(t => { 
        followedTagTypes[t.tagName] = t.tagType; 
        formattedToOriginal[toTitleCase(t.tagName.replace(/_/g, ' '))] = t.tagName;
      });
      const followedStats = { day: {}, month: {}, year: {} };
      if (followedTagNames.length > 0) {
        notifications.forEach(notif => {
          const match = notif.message.match(/\*\*([^*]+)\*\* baru dari/);
          if (match) {
            const originalTag = formattedToOriginal[match[1]];
            if (originalTag) {
              followedStats.year[originalTag] = (followedStats.year[originalTag] || 0) + 1;
              if (new Date(notif.createdAt) >= oneMonthAgo) followedStats.month[originalTag] = (followedStats.month[originalTag] || 0) + 1;
              if (new Date(notif.createdAt) >= oneDayAgo) followedStats.day[originalTag] = (followedStats.day[originalTag] || 0) + 1;
            }
          }
        });
      }
      return { followedStats, followedTagNames, followedTagTypes };
    };

    // Promise 4: Collection Stats
    const getCollectionStats = async () => {
      const [allSaves, myTags] = await Promise.all([
        prisma.savedContent.findMany({ where: { userId }, select: { tags: true } }),
        prisma.followedTag.findMany({ where: { userId }, select: { tagName: true } })
      ]);
      const myTagNames = myTags.map(t => t.tagName);
      
      const tagCounts = {};
      allSaves.forEach(save => {
        if (save.tags) {
          save.tags.split(' ').forEach(tag => { 
            const t = tag.trim();
            if (t && myTagNames.includes(t)) {
              tagCounts[t] = (tagCounts[t] || 0) + 1; 
            }
          });
        }
      });
      const topRaw = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 50);
      let topCollectionTags = [];
      if (topRaw.length > 0) {
        try {
          const cacheKey = 'analitik_collectionTags_v2_' + userId;
          if (apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < CACHE_TTL) {
            topCollectionTags = apiCache[cacheKey].data;
          } else {
            const names = topRaw.map(t => t[0]).join(',');
            const resp = await axios.get('https://danbooru.donmai.us/tags.json', { params: { 'search[name_comma]': names, 'limit': 50 }, timeout: 5000 });
            if (resp.data && Array.isArray(resp.data)) {
              const catLookup = {};
              resp.data.forEach(t => { catLookup[t.name] = t.category; });
              topCollectionTags = topRaw.filter(([name]) => ALLOWED_CATEGORIES.includes(catLookup[name]))
                .slice(0, 3).map(([name, count]) => ({ name, count, category: catLookup[name], categoryLabel: CAT_LABELS[catLookup[name]] }));
              apiCache[cacheKey] = { timestamp: Date.now(), data: topCollectionTags };
            }
          }
        } catch(e) {}
      }
      return { topCollectionTags, totalSaves: allSaves.length };
    };

    // Promise 5: Other user details
    const getUserDetails = async () => {
      let lastClear = parseInt(req.cookies.lastNotifClear || '0', 10);
      if (isNaN(lastClear)) lastClear = 0;
      const [allFollowedTagsCount, unreadCount] = await Promise.all([
        prisma.followedTag.count({ where: { userId } }),
        prisma.notification.count({ where: { userId, isRead: false, createdAt: { gt: new Date(lastClear) } } })
      ]);
      return { totalFollowed: allFollowedTagsCount, unreadCount };
    };

    // EXECUTE ALL IN PARALLEL
    const [globalTags, trendingTags, followedActivity, collectionData, userDetails] = await Promise.all([
      getGlobalTags(),
      getTrendingTags(),
      getFollowedStats(),
      getCollectionStats(),
      getUserDetails()
    ]);

    res.render("analitik", { 
      user: req.user,
      hideSearchbar: true,
      globalTags,
      trendingTags,
      followedStats: followedActivity.followedStats,
      followedTagNames: followedActivity.followedTagNames,
      followedTagTypes: followedActivity.followedTagTypes,
      topCollectionTags: collectionData.topCollectionTags,
      totalSaves: collectionData.totalSaves,
      totalFollowed: userDetails.totalFollowed,
      CAT_LABELS,
      unreadCount: userDetails.unreadCount
    });

  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading analytics");
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

app.post("/api/collections/batch-delete", requireAuth, async (req, res) => {
  const prisma = require('./lib/prisma');
  try {
    const { postIds } = req.body;
    const userId = req.user.id;
    if (!postIds || !Array.isArray(postIds)) {
      return res.status(400).json({ error: "Invalid postIds" });
    }
    
    await prisma.savedContent.deleteMany({
      where: {
        userId: userId,
        postId: { in: postIds.map(String) }
      }
    });
    
    res.json({ success: true, message: "Berhasil menghapus batch koleksi" });
  } catch (error) {
    console.error('Batch delete error:', error);
    res.status(500).json({ error: "Gagal menghapus batch koleksi." });
  }
});

app.post("/api/collections/batch-download", requireAuth, async (req, res) => {
  const prisma = require('./lib/prisma');
  const { ZipArchive } = require('archiver');
  const axios = require('axios').create({
    headers: {
      'User-Agent': 'CytusGallery/1.0 (by Abdi)'
    }
  });
  
  try {
    const { postIds } = req.body;
    const userId = req.user.id;
    if (!postIds || !Array.isArray(postIds)) {
      return res.status(400).json({ error: "Invalid postIds" });
    }
    
    const saves = await prisma.savedContent.findMany({
      where: {
        userId: userId,
        postId: { in: postIds.map(String) }
      }
    });
    
    if (saves.length === 0) {
      return res.status(404).json({ error: "Tidak ada konten yang valid untuk diunduh." });
    }

    const estimatedSize = saves.reduce((sum, s) => sum + (s.size || 0), 0);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=CytusGallery_Batch_${Date.now()}.zip`);
    if (estimatedSize > 0) {
      res.setHeader('X-Estimated-Size', String(estimatedSize));
      res.setHeader('Access-Control-Expose-Headers', 'X-Estimated-Size');
    }
    
    const archive = new ZipArchive({
      zlib: { level: 9 }
    });
    
    archive.on('error', function(err) {
      console.error("Archiver error:", err);
    });
    
    archive.pipe(res);
    
    const chunkArray = (arr, size) => arr.length > 0 ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)] : [];
    const chunks = chunkArray(saves, 5); // 5 concurrent downloads max
    
    for (const chunk of chunks) {
      await Promise.all(chunk.map(async (save) => {
        if (!save.fileUrl) return;
        try {
          const response = await axios({
            method: 'GET',
            url: save.fileUrl,
            responseType: 'arraybuffer',
            timeout: 15000
          });
          const ext = save.extension || save.fileUrl.split('.').pop().split('?')[0] || 'jpg';
          archive.append(Buffer.from(response.data), { name: `CytusGallery_${save.postId}.${ext}` });
        } catch(err) {
          console.error(`Failed to download ${save.fileUrl}`, err.message);
        }
      }));
    }
    
    await archive.finalize();
  } catch (error) {
    console.error('Batch download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Gagal memproses batch download." });
    }
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
      delete apiCache[`userAppData_${userId}`];
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
      delete apiCache[`userAppData_${userId}`];
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
    const response = await axios.get(basePostsURL, { params: params, timeout: 8000 });

    return response.data;
  } catch (error) {
    if (error.response && (error.response.status === 422 || error.response.status === 500)) {
      try {
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, "0");
        const startOfMonth = `${year}-${month}-01`;
        
        const fallbackQuery = `date:>=${startOfMonth} ${filter}`.trim();
        const fallbackResponse = await axios.get(basePostsURL, { params: { tags: fallbackQuery, limit: 100 }, timeout: 8000 });
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
    const response = await axios.get(basePostsURL, { params: params, timeout: 8000 });
    return response.data;
  } catch (err) {
    if (err.response && (err.response.status === 422 || err.response.status === 500)) {
      try {
        const fallbackQuery = `${tags} ${filter}`.trim();
        const fallbackResponse = await axios.get(basePostsURL, { params: { tags: fallbackQuery, limit: 100 }, timeout: 8000 });
        let sorted = fallbackResponse.data.sort((a, b) => b.score - a.score);
        return sorted.slice(0, limit);
      } catch (fallbackErr) {
        return [];
      }
    }
    return [];
  }
}

const apiCache = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 menit
const USER_APP_DATA_TTL = 30 * 1000; // 30 seconds

async function getUserAppData(userId) {
  const cacheKey = `userAppData_${userId}`;
  if (apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < USER_APP_DATA_TTL) {
    return apiCache[cacheKey].data;
  }
  let hasFollowedTags = false;
  let followedTags = [];
  let savedPostIds = new Set();
  const prisma = require('./lib/prisma');
  try {
    const follows = await prisma.followedTag.findMany({ where: { userId }, select: { tagName: true, tagType: true } });
    hasFollowedTags = follows.length > 0;
    follows.sort((a, b) => {
      const aMatch = a.tagName.match(/\(([^)]+)\)$/);
      const bMatch = b.tagName.match(/\(([^)]+)\)$/);
      const aCopyright = aMatch ? aMatch[1] : "";
      const bCopyright = bMatch ? bMatch[1] : "";
      if (aCopyright !== bCopyright) {
        if (aCopyright === "") return -1;
        if (bCopyright === "") return 1;
        return aCopyright.localeCompare(bCopyright);
      }
      return a.tagName.localeCompare(b.tagName);
    });
    followedTags = follows.map(f => f.tagName);
    
    const saves = await prisma.savedContent.findMany({
      where: { userId },
      select: { postId: true }
    });
    savedPostIds = new Set(saves.map(s => s.postId));
  } catch(e) {
    console.error("getUserAppData Prisma error:", e.message);
  }
  const result = { hasFollowedTags, followedTags, savedPostIds };
  apiCache[cacheKey] = { timestamp: Date.now(), data: result };
  return result;
}

async function getSliderTags(category) {
  const cacheKey = `sliderTags_${category}`;
  if (apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < CACHE_TTL) {
    return apiCache[cacheKey].data;
  }

  const tagsResponse = await axios.get(baseTagURL, {
    params: {
      "search[category]": category,
      "search[order]": "count",
      limit: 100,
    },
    timeout: 8000
  }).catch(e => ({ data: [] }));
  const pool = tagsResponse.data || [];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const result = pool.slice(0, 15);
  apiCache[cacheKey] = { timestamp: Date.now(), data: result };
  return result;
}

async function getTotalPosts(limit) {
  const cacheKey = `totalPosts_${limit}`;
  if (apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < CACHE_TTL) {
    return apiCache[cacheKey].data;
  }
  
  const getCounts = await axios.get(baseCountsPostsURL, { timeout: 8000 }).catch(e => ({ data: { counts: { posts: 100 } } }));
  const totalPosts = getCounts.data?.counts?.posts || 100;
  const totalPages = Math.ceil(totalPosts / limit);
  const result = { totalPosts, totalPages };
  apiCache[cacheKey] = { timestamp: Date.now(), data: result };
  return result;
}

async function getTotalPostsWithParams(tags, query, limit) {
  const cacheKey = `totalPostsParams_${tags}_${query}_${limit}`;
  if (apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < CACHE_TTL) {
    return apiCache[cacheKey].data;
  }

  let totalPosts;
  let fallbackResponse;
  const getCounts = await axios.get(baseCountsPostsURL, {
    params: {
      tags: `${tags} ${query}`,
    },
    timeout: 8000
  }).catch(() => ({ data: { counts: { posts: null } } }));
  
  if (getCounts.data?.counts?.posts == null) {
    if (tags)
      fallbackResponse = await axios.get(baseCountsPostsURL, {
        params: { tags: tags },
        timeout: 8000
      }).catch(() => ({ data: { counts: { posts: 100 } } }));
    else fallbackResponse = await axios.get(baseCountsPostsURL, { timeout: 8000 }).catch(() => ({ data: { counts: { posts: 100 } } }));
    totalPosts = fallbackResponse.data?.counts?.posts || 100;
  } else {
    totalPosts = getCounts.data.counts.posts;
  }

  const result = {
    totalPosts,
    totalPages: Math.ceil(totalPosts / limit)
  };
  apiCache[cacheKey] = { timestamp: Date.now(), data: result };
  return result;
}

async function getCachedPosts(params) {
  const cacheKey = `posts_${params.tags || ''}_${params.page}_${params.limit}`;
  if (apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < CACHE_TTL) {
    return apiCache[cacheKey].data;
  }
  const response = await axios.get(basePostsURL, { params: params, timeout: 8000 }).catch(e => ({ data: [] }));
  apiCache[cacheKey] = { timestamp: Date.now(), data: response };
  return response;
}

async function getFollowedContents(userId, filterQuery, page, limit, isBypass, followedTagsFilter = null) {
  const filterKey = followedTagsFilter ? followedTagsFilter.join(',') : 'all';
  const cacheKey = `followedContents_${userId}_${filterQuery}_${page}_${limit}_${isBypass}_${filterKey}`;
  if (apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < CACHE_TTL) {
    return apiCache[cacheKey].data;
  }

  const prisma = require('./lib/prisma');
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { followedTags: true }
  });

  if (!user || user.followedTags.length === 0) {
    return { posts: [], totalPages: 0, totalPosts: 0, hasFollowedTags: false };
  }

  let tagsToProcess = user.followedTags;
  if (followedTagsFilter && followedTagsFilter.length > 0) {
    tagsToProcess = user.followedTags.filter(t => followedTagsFilter.includes(t.tagName));
  }
  
  if (tagsToProcess.length === 0) {
    return { posts: [], totalPages: 0, totalPosts: 0, hasFollowedTags: true };
  }

  let baseTags = filterQuery || "";
  let manualRatingFilter = false;
  if (!isBypass) {
    // Danbooru limits queries to 2 tags for free API.
    // Appending "-rating:e -rating:q" (2 tags) to a query that already has a tagName and a date filter
    // results in 4 tags, causing a 422 Unprocessable Entity error and dropping all content.
    // We now filter safety explicitly in JavaScript to preserve API allowances.
    manualRatingFilter = true;
  }

  // Danbooru max limit is 200. To support deep pagination, we fetch multiple pages if needed.
  const postsNeeded = page * limit;
  const chunkLimit = 200;
  const chunksNeeded = Math.ceil((postsNeeded + limit) / chunkLimit); // Fetch enough for next page
  
  // Cap at 50 chunks (10,000 posts deep per tag, Danbooru free API limit)
  const maxChunks = 50; 
  const fetchChunks = Math.min(chunksNeeded, maxChunks);

  const results = new Array(tagsToProcess.length * fetchChunks);
  const networkTasks = [];
  
  let i = 0;
  tagsToProcess.forEach(tag => {
    for (let c = 1; c <= fetchChunks; c++) {
      const idx = i++;
      const tName = `${tag.tagName} ${baseTags}`.trim();
      const chunkCacheKey = `danbooruChunk_${tName}_${c}_${chunkLimit}`;
      
      if (apiCache[chunkCacheKey] && Date.now() - apiCache[chunkCacheKey].timestamp < CACHE_TTL) {
         results[idx] = apiCache[chunkCacheKey].data;
      } else {
         networkTasks.push(async () => {
           const res = await axios.get(basePostsURL, { 
             params: { tags: tName, page: c, limit: chunkLimit }, 
             timeout: 6000 
           }).catch(e => ({ data: [] }));
           const data = res.data || [];
           apiCache[chunkCacheKey] = { timestamp: Date.now(), data };
           results[idx] = data;
         });
      }
    }
  });

  const batchSize = 10;
  for (let b = 0; b < networkTasks.length; b += batchSize) {
    const batch = networkTasks.slice(b, b + batchSize);
    await Promise.all(batch.map(fn => fn()));
  }
  
  let allPosts = [];
  let hasMore = false;
  
  // results is a flat array: [tag1_c1, tag1_c2, tag2_c1, tag2_c2, ...]
  // We check if the LAST chunk of ANY tag has >= chunkLimit items
  for (let i = 0; i < tagsToProcess.length; i++) {
    const tagChunks = results.slice(i * fetchChunks, (i + 1) * fetchChunks);
    tagChunks.forEach(chunkData => {
      if (Array.isArray(chunkData)) {
        allPosts = allPosts.concat(chunkData);
      }
    });
    
    // Check the last fetched chunk for this tag
    const lastChunkData = tagChunks[tagChunks.length - 1];
    if (Array.isArray(lastChunkData) && lastChunkData.length >= chunkLimit) {
      hasMore = true;
    }
  }

  const uniquePosts = [];
  const seenIds = new Set();
  for (const p of allPosts) {
    if (p && p.id && !seenIds.has(p.id) && p.large_file_url) {
      if (manualRatingFilter) {
        if (p.rating === 'e' || p.rating === 'q') continue;
      }
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

  const finalResult = { 
    posts: paginatedPosts, 
    totalPages: totalPages, 
    totalPosts: uniquePosts.length,
    hasFollowedTags: true 
  };
  apiCache[cacheKey] = { timestamp: Date.now(), data: finalResult };
  return finalResult;
}

//2. Functional Routes

const root = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const isLazyLoadEnabled = req.query.lazyload === "true";

    const tab = req.query.tab || req.cookies?.cytusGalleryActiveTab || "contents";
    let posts = [];
    let totalPosts = 0;
    let totalPages = 0;
    let hasFollowedTags = false;
    let savedPostIds = new Set();

    if (res.locals.user) {
      const appData = await getUserAppData(res.locals.user.id);
      hasFollowedTags = appData.hasFollowedTags;
      savedPostIds = appData.savedPostIds;
    }

    const sliderTagsPromise = Promise.all([
      getSliderTags(3),
      getSliderTags(4)
    ]);

    if (tab === "collection" && res.locals.user) {
      const prisma = require('./lib/prisma');
        const skip = (page - 1) * limit;
        const saves = await prisma.savedContent.findMany({
          where: { userId: res.locals.user.id },
          orderBy: { savedAt: 'desc' },
          take: limit,
          skip
        });
        const totalSaves = await prisma.savedContent.count({ where: { userId: res.locals.user.id } });
        
        const postIds = saves.map(s => s.postId);
        let fetchedPosts = {};
        if (postIds.length > 0) {
           try {
              const dRes = await axios.get(`https://danbooru.donmai.us/posts.json?tags=id:${postIds.join(',')}&limit=200`);
              const fetched = dRes.data;
              fetched.forEach(p => { fetchedPosts[p.id.toString()] = p; });
           } catch (e) {
              console.error("Failed to fetch saves from Danbooru", e.message);
           }
        }
        
        posts = saves.map(s => {
          const danbooruP = fetchedPosts[s.postId.toString()];
          if (danbooruP) {
             return danbooruP;
          }
          return {
            id: parseInt(s.postId, 10) || s.postId,
            large_file_url: s.fileUrl || s.imageUrl,
            preview_file_url: s.imageUrl,
            file_ext: s.extension || 'jpg',
            rating: s.rating || 's',
            tag_string_artist: 'Unknown',
            tag_string_character: 'Saved Content',
            tag_string_copyright: 'Offline Data',
            media_asset: null
          };
        });
        totalPosts = totalSaves;
      totalPages = Math.ceil(totalSaves / limit);
    } else if (tab === "followed" && res.locals.user) {
      let followedTagsFilter = null; if (req.query.followedTags !== undefined) { followedTagsFilter = req.query.followedTags ? req.query.followedTags.split(',') : []; }
      const result = await getFollowedContents(res.locals.user.id, "", page, limit, res.locals.isBypass, followedTagsFilter);
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
      
      const [contents, stats] = await Promise.all([
        getCachedPosts(contentsParams),
        getTotalPosts(limit)
      ]);
      
      posts = contents.data || [];
      totalPosts = stats.totalPosts;
      totalPages = stats.totalPages;
    }

    let sliderPosts = [];
    const [popularTags, popularCharacters] = await sliderTagsPromise;

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
      currentTab: tab, followedTagsQuery: req.query.followedTags,
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
  const allowedKeys = ['tags', 'page', 'limit', 'tab', 'query', 'lazyload', 'followedTags'];
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

    const tab = req.query.tab || req.cookies?.cytusGalleryActiveTab || "contents";
    let posts = [];
    let totalPages = 0;
    let totalPosts = 0;
    let hasFollowedTags = false;
    let followedTagsList = [];
    let savedPostIds = new Set();
    let sliderPosts = [];
    let popularTags = [];
    let popularCharacters = [];

    const sliderTagsPromise = !userTags ? Promise.all([getSliderTags(3), getSliderTags(4)]) : Promise.resolve([[], []]);

    if (res.locals.user) {
      const appData = await getUserAppData(res.locals.user.id);
      hasFollowedTags = appData.hasFollowedTags;
      followedTagsList = appData.followedTags || [];
      savedPostIds = appData.savedPostIds;
    }

    if (tab === "collection" && res.locals.user) {
      const prisma = require('./lib/prisma');
      let whereClause = { userId: res.locals.user.id };
      let andConditions = [];
      
      const searchTerms = userTags.trim().split(/\s+/).filter(t => t.length > 0);
      if (searchTerms.length > 0) {
         searchTerms.forEach(tag => {
            andConditions.push({ tags: { contains: tag } });
         });
      }
      
      const filterTerms = filterQuery.trim().split(/\s+/).filter(t => t.length > 0);
      let ratingNotIn = [];
      let ratingIn = [];
      let extensionIn = [];
      
      filterTerms.forEach(t => {
         if (t.startsWith("-rating:")) {
            ratingNotIn.push(t.split(":")[1]);
         } else if (t.startsWith("rating:")) {
            ratingIn = ratingIn.concat(t.split(":")[1].split(","));
         } else if (t.startsWith("filetype:")) {
            extensionIn = extensionIn.concat(t.split(":")[1].split(","));
         }
      });
      
      if (ratingNotIn.length > 0) andConditions.push({ rating: { notIn: ratingNotIn } });
      if (ratingIn.length > 0) andConditions.push({ rating: { in: ratingIn } });
      if (extensionIn.length > 0) andConditions.push({ extension: { in: extensionIn } });
      
      if (andConditions.length > 0) {
         whereClause.AND = andConditions;
      }
      
      const skip = (page - 1) * limit;
      const saves = await prisma.savedContent.findMany({
        where: whereClause,
        orderBy: { savedAt: 'desc' },
        take: limit,
        skip
      });
      const totalSaves = await prisma.savedContent.count({ where: whereClause });
      
      const postIds = saves.map(s => s.postId);
      let fetchedPosts = {};
      if (postIds.length > 0) {
         try {
            const dRes = await axios.get(`https://danbooru.donmai.us/posts.json?tags=id:${postIds.join(',')}&limit=200`);
            const fetched = dRes.data;
            fetched.forEach(p => { fetchedPosts[p.id.toString()] = p; });
         } catch (e) {
            console.error("Failed to fetch saves from Danbooru", e.message);
         }
      }
      
      posts = saves.map(s => {
        const danbooruP = fetchedPosts[s.postId.toString()];
        if (danbooruP) {
           return danbooruP;
        }
        return {
          id: parseInt(s.postId, 10) || s.postId,
          large_file_url: s.fileUrl || s.imageUrl,
          preview_file_url: s.imageUrl,
          file_ext: s.extension || 'jpg',
          rating: s.rating || 's',
          tag_string_artist: 'Unknown',
          tag_string_character: 'Saved Content',
          tag_string_copyright: 'Offline Data',
          media_asset: null
        };
      });
      totalPosts = totalSaves;
      totalPages = Math.ceil(totalSaves / limit);
    } else if (!userTags && tab === "followed" && res.locals.user) {
      let followedTagsFilter = null; if (req.query.followedTags !== undefined) { followedTagsFilter = req.query.followedTags ? req.query.followedTags.split(',') : []; }
      const result = await getFollowedContents(res.locals.user.id, filterQuery, page, limit, res.locals.isBypass, followedTagsFilter);
      posts = result.posts;
      totalPosts = result.totalPosts;
      totalPages = result.totalPages;
      hasFollowedTags = result.hasFollowedTags;
    } else {
      const contentsParams = { tags: allTags, page: page, limit: limit };
      const [contents, stats] = await Promise.all([
        getCachedPosts(contentsParams),
        getTotalPostsWithParams(userTags, filterQuery, limit)
      ]);
      posts = contents.data || [];
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
          },
          timeout: 5000
        }).catch(e => ({ data: [] }));
        
        const suggestions = tagSuggestRes.data || [];
        if (suggestions && suggestions.length > 0) {
          invalidTag = userTags;
          smartSearchTags = suggestions;
          actualUserTags = suggestions[0].name;
          allTagsFinal = `${actualUserTags} ${filterQuery}`;
          
          const newParams = { tags: allTagsFinal, page: page, limit: limit };
          const [newContents, newStats] = await Promise.all([
            getCachedPosts(newParams),
            getTotalPostsWithParams(actualUserTags, filterQuery, limit)
          ]);
          posts = newContents.data || [];
          totalPages = newStats.totalPages;
          totalPosts = newStats.totalPosts;
        }
      } catch (err) {
         console.error("Smart Search Error:", err.message);
      }
    }

    if (page === 1) {
      const sliderFilter = tab === "followed" ? filterQuery.replace(/date:[^\s]+/g, '').trim() : filterQuery;
      actualUserTags
        ? (sliderPosts = await getTopPosts(actualUserTags, sliderFilter, 15))
        : (sliderPosts = await getTopPostsThisMonth(15, sliderFilter));
    }

    if (!userTags) {
      const [pt, pc] = await sliderTagsPromise;
      popularTags = pt;
      popularCharacters = pc;
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
      currentTab: tab, followedTagsQuery: req.query.followedTags,
      hasFollowedTags: hasFollowedTags,
      followedTagsList: followedTagsList,
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
      follows.sort((a, b) => { const aCopy = a.tagType === 3 ? 0 : 1; const bCopy = b.tagType === 3 ? 0 : 1; if (aCopy !== bCopy) return aCopy - bCopy; return a.tagName.localeCompare(b.tagName); }); followedTags = follows.map(f => f.tagName);
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
      delete apiCache[`userAppData_${userId}`];
      res.json({ followed: false, message: "Berhasil unfollow tag." });
    } else {
      // Check maximum tags limit
      const currentCount = await prisma.followedTag.count({ where: { userId } });
      if (currentCount >= 40) {
        return res.status(400).json({ error: "Gagal: Anda telah mencapai batas maksimal 40 tag. Silakan unfollow beberapa tag terlebih dahulu." });
      }
      
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
      delete apiCache[`userAppData_${userId}`];
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
    let lastClear = parseInt(req.cookies.lastNotifClear || '0', 10);
    if (isNaN(lastClear)) lastClear = 0;
    
    const unread = await prisma.notification.count({ 
      where: { 
        userId, 
        isRead: false,
        createdAt: { gt: new Date(lastClear) }
      } 
    });
    
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
  try {
    // Gunakan cookie untuk menghilangkan badge notifikasi tanpa menghilangkan efek border biru di halaman notifikasi
    res.cookie('lastNotifClear', Date.now(), { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true }); // 30 hari
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
let isWorkerRunning = false;
const runNotificationWorker = async () => {
  if (isWorkerRunning) return;
  isWorkerRunning = true;
  const prisma = require('./lib/prisma');
  const axios = require('axios');
  try {
    const tagsToCheck = await prisma.followedTag.findMany({
      orderBy: { updatedAt: 'asc' },
      include: { user: true }
    });
    if (!tagsToCheck || tagsToCheck.length === 0) return;

    const tagsToRotate = [];

    for (const tag of tagsToCheck) {
      try {
        // Gunakan rating Safe & Sensitive (not_e) sebagai standar untuk pengecekan background
        let ratingFilter = '+rating:s,g';
        // Bypass untuk user dengan akses explicit
        if (process.env.BYPASSEXPLICITCONTENTACCOUNT && tag.user && tag.user.email === process.env.BYPASSEXPLICITCONTENTACCOUNT) {
          ratingFilter = '';
        }
        
        const query = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tag.tagName)}${ratingFilter}&limit=200`;
        const dRes = await axios.get(query, { timeout: 10000 });
        const posts = dRes.data;
        
        let foundNewPosts = false;
        
        if (posts && posts.length > 0) {
          let maxPostId = tag.lastPostId || 0;
          
          for (const post of posts) {
            if (tag.lastPostId && post.id > tag.lastPostId) {
              foundNewPosts = true;
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
          
          if (foundNewPosts) {
            // Update timestamp & lastPostId for tags with new posts
            await prisma.followedTag.update({
              where: { id: tag.id },
              data: { lastPostId: maxPostId, updatedAt: new Date() }
            });
          } else {
            tagsToRotate.push(tag.id);
          }
        } else {
          // Rotasi jika tidak ada post sama sekali
          tagsToRotate.push(tag.id);
        }
      } catch (err) {
        // Rotasi jika error
        tagsToRotate.push(tag.id);
      }
    }
    
    // Lakukan batch update untuk semua tag yang tidak memiliki post baru (menghemat kuota DB)
    if (tagsToRotate.length > 0) {
      await prisma.followedTag.updateMany({
        where: { id: { in: tagsToRotate } },
        data: { updatedAt: new Date() }
      });
    }
  } catch (error) {
    console.error("Background sync error:", error.message);
  } finally {
    isWorkerRunning = false;
  }
};

runNotificationWorker();
setInterval(runNotificationWorker, 5 * 60 * 1000); // Berjalan setiap 5 menit

//Run Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server CytusGallery berjalan di http://[0.0.0.0]:${PORT}`);
});

module.exports = app;
