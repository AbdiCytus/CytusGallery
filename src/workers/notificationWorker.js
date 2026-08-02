/**
 * Background Worker: Notification Sync
 * Mengecek tag yang diikuti pengguna secara berkala dan membuat notifikasi
 * jika ada postingan baru di Danbooru.
 */

const axios = require('axios');
const prisma = require('../lib/prisma');

let isWorkerRunning = false;

const runNotificationWorker = async () => {
  if (isWorkerRunning) return;
  isWorkerRunning = true;
  
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
            await prisma.followedTag.update({
              where: { id: tag.id },
              data: { lastPostId: maxPostId, updatedAt: new Date() }
            });
          } else {
            tagsToRotate.push(tag.id);
          }
        } else {
          tagsToRotate.push(tag.id);
        }
      } catch (err) {
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

module.exports = { runNotificationWorker };
