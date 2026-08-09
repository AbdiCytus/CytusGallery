// =====================================================
// CytusGallery - Entry Point
// =====================================================
const express = require("express");
const rateLimit = require("express-rate-limit");
const path = require("path");
const axios = require("axios");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const multer = require("multer");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const { checkUser, requireAuth } = require("./middlewares/authMiddleware");
const prisma = require("./lib/prisma");

// =====================================================
// Setup Server
// =====================================================
const app = express();
const PORT = process.env.PORT || 3000;

// Rate Limiter
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  validate: { ip: false, xForwardedForHeader: false },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).render("error", {
      message: "Terlalu banyak request dari IP ini. Sistem mendeteksi aktivitas yang tidak wajar. Silakan coba lagi setelah 1 menit.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Trust Proxy (Vercel/Nginx)
app.set("trust proxy", 1);

// Template Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static Files — dengan Cache-Control eksplisit per tipe file
app.use(express.static(path.join(__dirname, "public"), {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (/\.(js|css)$/.test(filePath)) {
      // JS & CSS: cache 1 jam, revalidasi dengan ETag
      // → Saat deploy update, ETag berubah → browser fetch versi baru
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    } else if (/\.(png|jpg|jpeg|gif|svg|ico|webp)$/.test(filePath)) {
      // Gambar/ikon statis milik kita: cache 1 hari
      res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
    } else if (/\.(woff2?|ttf|eot|otf)$/.test(filePath)) {
      // Font: cache 1 minggu (sangat jarang berubah)
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    } else {
      // File lain (json, txt, dll): cache 1 jam
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    }
  }
}));

// Core Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(checkUser);

app.use((req, res, next) => {
  res.locals.tags = req.query.tags || "";
  // no-store hanya berlaku untuk halaman dinamis (HTML server-rendered).
  // Static assets sudah ditangani oleh express.static di atas middleware ini.
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// Auth Routes
app.use(authRoutes);

// Bot / User-Agent Filter
app.use((req, res, next) => {
  const userAgent = req.headers["user-agent"] || "";
  const blockedAgents = ["python-requests", "curl", "wget", "scrapy", "postman"];
  const isBot = blockedAgents.some((bot) => userAgent.toLowerCase().includes(bot));
  if (isBot || userAgent.trim() === "") {
    return res.status(403).send("Akses ditolak. Bot/Scraper terdeteksi.");
  }
  next();
});

// Rate Limiter
app.use(limiter);

// =====================================================
// Static Asset Routes
// =====================================================
app.get("/arona_doro.png", (req, res) => {
  const logoPath = path.join(__dirname, "public", "arona_doro.png");
  fs.readFile(logoPath, (err, data) => {
    if (err) {
      console.error("Error reading logo file:", err);
      return res.status(404).send("Logo tidak ditemukan");
    }
    res.contentType("image/png");
    res.send(data);
  });
});

// =====================================================
// Avatar Upload Route
// =====================================================
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.post("/api/profil/upload", requireAuth, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Tidak ada file yang diunggah" });
  
  const base64Str = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  
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

// =====================================================
// Feature Routes (Modular)
// =====================================================
app.use('/', require('./routes/analitik'));
app.use('/', require('./routes/profile'));
app.use('/', require('./routes/notifications'));

// =====================================================
// Page Routes
// =====================================================
const { root, search, detail } = require('./controllers/homeController');

app.get("/", root);
app.get("/search", search);
app.get("/posts/:id", detail);

app.get("/tentang", (req, res) => res.render("tentang", { hideSearchbar: true }));
app.get("/bantuan", (req, res) => res.render("bantuan", { hideSearchbar: true }));

// =====================================================
// Background Workers & Cache Warm-Up
// =====================================================
const { runNotificationWorker } = require('./workers/notificationWorker');
const { getCachedDanbooru, getTotalPosts, getSliderTags, basePostsURL } = require('./utils/danbooruUtils');
const { initRedis } = require('./lib/redis');

runNotificationWorker();
setInterval(runNotificationWorker, 30 * 60 * 1000); // [S2] setiap 30 menit

async function warmUpCache() {
  try {
    console.log("[Cache] Starting initial cache warm-up...");
    await Promise.all([
      getCachedDanbooru(basePostsURL, { tags: '-rating:e -rating:q', page: 1, limit: 25 }, 8000),
      getCachedDanbooru(basePostsURL, { tags: '', page: 1, limit: 25 }, 8000),
      getTotalPosts(25),
      getSliderTags(3),
      getSliderTags(4)
    ]);
    console.log("[Cache] Warm-up complete. Initial page load will be instant.");
  } catch (err) {
    console.error("[Cache] Warm-up failed:", err.message);
  }
}
warmUpCache();
setInterval(warmUpCache, 8 * 60 * 1000);

// =====================================================
// Run Server
// =====================================================
initRedis().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server CytusGallery berjalan di http://[0.0.0.0]:${PORT}`);
  });
});

module.exports = app;
