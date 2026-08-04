const express = require('express');
const router = express.Router();
const axios = require('axios');
const prisma = require('../lib/prisma');
const { requireAuth, userCache } = require('../middlewares/authMiddleware');
const { deleteCacheData, getCachedDanbooru } = require('../utils/danbooruUtils');

// =====================================================
// Halaman Profil
// =====================================================
router.get("/profil", requireAuth, async (req, res) => {
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

// =====================================================
// API: Ambil Koleksi
// =====================================================
router.get("/api/profil/saves", requireAuth, async (req, res) => {
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

// =====================================================
// API: Hapus Akun
// =====================================================
router.delete("/api/profil/delete", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    await prisma.savedContent.deleteMany({ where: { userId } });
    await prisma.followedTag.deleteMany({ where: { userId } });
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    
    res.clearCookie('token');
    res.json({ success: true, message: "Akun berhasil dihapus" });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: "Gagal menghapus akun." });
  }
});

// =====================================================
// API: Batch Delete Koleksi
// =====================================================
router.post("/api/collections/batch-delete", requireAuth, async (req, res) => {
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

// =====================================================
// API: Ambil URL untuk Batch Download (Client-side ZIP)
// =====================================================
router.post("/api/collections/batch-download-urls", requireAuth, async (req, res) => {
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
      return res.status(404).json({ error: "Tidak ada konten yang valid." });
    }

    const urls = saves.map(s => {
      const ext = s.extension || (s.fileUrl ? s.fileUrl.split('.').pop().split('?')[0] : 'jpg');
      return {
        postId: s.postId,
        url: s.fileUrl || s.imageUrl,
        filename: `CytusGallery_${s.postId}.${ext}`
      };
    }).filter(u => u.url);

    res.json({ urls });
  } catch (error) {
    console.error('Batch get URLs error:', error);
    res.status(500).json({ error: "Gagal memproses daftar unduhan." });
  }
});

// =====================================================
// API: Batch Download (Server-side ZIP — fallback)
// =====================================================
router.post("/api/collections/batch-download", requireAuth, async (req, res) => {
  const axiosInstance = axios.create({
    headers: { 'User-Agent': 'CytusGallery/1.0 (by Abdi)' }
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
    
    const archiverModule = await import('archiver');
    const archiver = archiverModule.default || archiverModule;
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', function(err) {
      console.error("Archiver error:", err);
    });
    archive.pipe(res);
    
    const chunks = [];
    for (let i = 0; i < saves.length; i += 3) {
      chunks.push(saves.slice(i, i + 3));
    }
    
    for (const chunk of chunks) {
      await Promise.all(chunk.map(async (save) => {
        if (!save.fileUrl) return;
        try {
          const response = await axiosInstance({
            method: 'GET',
            url: save.fileUrl,
            responseType: 'arraybuffer',
            timeout: 20000
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

// =====================================================
// API: Simpan / Hapus konten dari koleksi
// =====================================================
router.post("/api/save/:id", requireAuth, async (req, res) => {
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
      await deleteCacheData(`userAppData_${userId}`);
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
      await deleteCacheData(`userAppData_${userId}`);
      res.json({ saved: true, message: "Berhasil disimpan ke koleksi." });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal menyimpan konten." });
  }
});


module.exports = router;
