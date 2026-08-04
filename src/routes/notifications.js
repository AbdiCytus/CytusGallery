const express = require('express');
const router = express.Router();
const axios = require('axios');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middlewares/authMiddleware');
const { deleteCacheData, getCachedDanbooru, baseTagURL } = require('../utils/danbooruUtils');

// =====================================================
// API: Follow / Unfollow Tag
// =====================================================
router.post("/api/follow", requireAuth, async (req, res) => {
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
      await deleteCacheData(`userAppData_${userId}`);
      res.json({ followed: false, message: "Berhasil unfollow tag." });
    } else {
      const currentCount = await prisma.followedTag.count({ where: { userId } });
      if (currentCount >= 40) {
        return res.status(400).json({ error: "Gagal: Anda telah mencapai batas maksimal 40 tag. Silakan unfollow beberapa tag terlebih dahulu." });
      }
      
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
      await deleteCacheData(`userAppData_${userId}`);
      res.json({ followed: true, message: "Berhasil follow tag." });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal memproses follow/unfollow." });
  }
});

// =====================================================
// API: Sinkronisasi Notifikasi
// =====================================================
router.get("/api/notifications/sync", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    let lastClear = parseInt(req.cookies[`lastNotifClear_${userId}`] || '0', 10);
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
    
    res.json({ unreadCount: unread, notifications: latestNotifications, synced: 0 });
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Gagal memuat notifikasi." });
    }
  }
});

// =====================================================
// API: Tandai semua notifikasi sebagai dibaca (via cookie)
// =====================================================
router.post("/api/notifications/read", requireAuth, async (req, res) => {
  try {
    res.cookie(`lastNotifClear_${req.user.id}`, Date.now(), { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Gagal update status." });
  }
});

// =====================================================
// Halaman Notifikasi
// =====================================================
router.get("/notifikasi", requireAuth, async (req, res) => {
  try {
    const allDates = await prisma.notification.findMany({
      where: { userId: req.user.id },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    
    const datesSet = new Set();
    allDates.forEach(n => {
       const dateStr = new Date(n.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
       datesSet.add(dateStr);
    });
    const dateChips = Array.from(datesSet);
    
    let notifications = [];
    if (dateChips.length > 0) {
       const selectedDate = dateChips[0];
       // find first 100 items of that date
       // Because it's hard to query by formatted string in prisma, we fetch a chunk and filter, OR we can use createdAt limits
       // Simpler: fetch 1000, filter by date, take 100
       const chunk = await prisma.notification.findMany({
          where: { userId: req.user.id },
          orderBy: { createdAt: 'desc' },
          take: 1000
       });
       notifications = chunk.filter(n => new Date(n.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' }) === selectedDate).slice(0, 100);
    }
    
    res.render("notifications", { notifications, dateChips, hideSearchbar: true });
  } catch (error) {
    console.error(error);
    if (error && error.message && error.message.includes('planLimitReached')) {
      return res.status(503).render("error", { message: "Batas Limit Server (Database) telah tercapai. Halaman notifikasi sementara tidak tersedia." });
    }
    res.status(500).render("error", { message: "Gagal memuat notifikasi." });
  }
});

// =====================================================
// API: Hapus Notifikasi
// =====================================================
router.post("/api/notifications/delete", requireAuth, async (req, res) => {
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

// =====================================================
// API: Ambil Notifikasi Berdasarkan Tanggal
// =====================================================
router.get("/api/notifications/by-date", requireAuth, async (req, res) => {
  try {
    const { date, skip = 0, take = 100 } = req.query;
    if (!date) return res.status(400).json({ error: "Date is required" });
    
    const limit = parseInt(take);
    const offset = parseInt(skip);
    
    // Convert date string 'YYYY-MM-DD' to Start and End of that day in Asia/Makassar
    // Simplest way is to fetch enough and filter in memory, but that's bad for offset.
    // Let's create proper Date objects for query:
    const startDate = new Date(`${date}T00:00:00.000+08:00`);
    const endDate = new Date(`${date}T23:59:59.999+08:00`);
    
    const notifications = await prisma.notification.findMany({
      where: { 
        userId: req.user.id,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
    
    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal memuat notifikasi." });
  }
});

// =====================================================
// API: Tandai notifikasi tertentu sebagai dibaca
// =====================================================
router.post("/api/notifications/mark-read", requireAuth, async (req, res) => {
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

// =====================================================
// API: Auto-suggest Tag
// =====================================================
router.get("/api/tagsuggest", async (req, res) => {
  const searchTerm = req.query.term;
  if (!searchTerm) return res.json([]);

  try {
    const suggestParams = {
      "search[name_matches]": `${searchTerm}*`,
      "search[order]": "count",
      limit: 10,
    };

    const response = await getCachedDanbooru(baseTagURL, suggestParams);
    const postExist = response.data.filter((tag) => tag.post_count > 0);

    res.json(postExist);
  } catch (error) {
    console.error("Tag suggestion error:", error);
    res.json([]);
  }
});

module.exports = router;
