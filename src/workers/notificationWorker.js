/**
 * Background Worker: Notification Sync (Optimized)
 *
 * Optimasi yang diterapkan:
 * [S1] Eliminasi findFirst manual — DB unique constraint + createMany skipDuplicates
 * [S2] Interval 30 menit — diatur di app.js
 * [S3] Tag rotation — hanya proses BATCH_SIZE tag per siklus (paling lama dicek duluan)
 * [+]  Tag grouping — fetch Danbooru sekali per tag unik, distribusikan ke semua user
 */

const axios = require('axios');
const prisma = require('../lib/prisma');

let isWorkerRunning = false;

// [S3] Jumlah tag yang diproses per siklus.
// Dengan 200 total tag dan batch 100, rotasi penuh selesai dalam 2 siklus (1 jam).
const BATCH_SIZE = 100;

const runNotificationWorker = async () => {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  try {
    // [S3] Ambil hanya BATCH_SIZE tag, diurutkan dari yang paling lama dicek
    const tagsToCheck = await prisma.followedTag.findMany({
      orderBy: { updatedAt: 'asc' },
      take: BATCH_SIZE,
      include: { user: true }
    });

    if (!tagsToCheck || tagsToCheck.length === 0) return;

    const bypassEmail = process.env.BYPASSEXPLICITCONTENTACCOUNT;

    // [+] Kelompokkan per (tagName + ratingFilter) untuk hindari duplikasi fetch Danbooru.
    // Bypass user dan non-bypass user dikelompokkan terpisah karena filter rating berbeda.
    const tagGroups = new Map();
    for (const tag of tagsToCheck) {
      const isBypass = bypassEmail && tag.user?.email === bypassEmail;
      const ratingFilter = isBypass ? '' : '+rating:s,g';
      const groupKey = `${tag.tagName}|||${ratingFilter}`;

      if (!tagGroups.has(groupKey)) {
        tagGroups.set(groupKey, { tagName: tag.tagName, ratingFilter, userTags: [] });
      }
      tagGroups.get(groupKey).userTags.push(tag);
    }

    const notificationsToCreate = [];
    const tagsWithNewPosts = []; // { id, lastPostId }
    const tagsToRotate = [];

    for (const group of tagGroups.values()) {
      try {
        const query = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(group.tagName)}${group.ratingFilter}&limit=200`;
        const dRes = await axios.get(query, { timeout: 10000 });
        const posts = dRes.data;

        if (!posts || posts.length === 0) {
          group.userTags.forEach(t => tagsToRotate.push(t.id));
          continue;
        }

        const toTitleCase = (str) => str.replace(/\b\w/g, c => c.toUpperCase());
        const tagNameFormatted = toTitleCase(group.tagName.replace(/_/g, ' '));

        // Distribusikan hasil fetch ke setiap user yang follow tag ini
        for (const userTag of group.userTags) {
          let tagTypeName = "General";
          if (userTag.tagType === 1) tagTypeName = "Artist";
          if (userTag.tagType === 3) tagTypeName = "Copyright";
          if (userTag.tagType === 4) tagTypeName = "Character";

          let maxPostId = userTag.lastPostId || 0;
          let foundNewPosts = false;

          for (const post of posts) {
            if (post.id > maxPostId) maxPostId = post.id;

            if (userTag.lastPostId && post.id > userTag.lastPostId) {
              foundNewPosts = true;
              const previewUrl =
                post.media_asset?.variants?.find(v => v.type === '360x360')?.url ||
                post.preview_file_url ||
                null;

              // [S1] Kumpulkan semua notifikasi — DB yang akan menolak duplikat via @@unique
              notificationsToCreate.push({
                userId: userTag.userId,
                title: 'Konten Baru',
                message: `**${tagNameFormatted}** baru dari **${tagTypeName}** yang Anda ikuti`,
                link: `/posts/${post.id}`,
                imageUrl: previewUrl,
                extension: post.file_ext,
                rating: post.rating,
                createdAt: post.created_at ? new Date(post.created_at) : new Date()
              });
            }
          }

          if (foundNewPosts) {
            tagsWithNewPosts.push({ id: userTag.id, lastPostId: maxPostId });
          } else {
            tagsToRotate.push(userTag.id);
          }
        }
      } catch (err) {
        group.userTags.forEach(t => tagsToRotate.push(t.id));
      }
    }

    // [S1] Satu batch insert untuk semua notifikasi baru dari semua user & semua tag.
    // skipDuplicates mengandalkan @@unique([userId, link]) di schema.
    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate,
        skipDuplicates: true
      });
    }

    // Update lastPostId untuk tag yang punya post baru (paralel)
    if (tagsWithNewPosts.length > 0) {
      await Promise.all(
        tagsWithNewPosts.map(t =>
          prisma.followedTag.update({
            where: { id: t.id },
            data: { lastPostId: t.lastPostId, updatedAt: new Date() }
          })
        )
      );
    }

    // Batch update untuk tag yang tidak ada post baru (satu query)
    if (tagsToRotate.length > 0) {
      await prisma.followedTag.updateMany({
        where: { id: { in: tagsToRotate } },
        data: { updatedAt: new Date() }
      });
    }

    // Cleanup notif lama — hanya berjalan sekali per hari (jam 3 pagi)
    const now = new Date();
    if (now.getHours() === 3 && now.getMinutes() < 30) {
      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);
      await prisma.notification.deleteMany({
        where: { createdAt: { lt: oneYearAgo } }
      });
      console.log('[Worker] Cleanup notifikasi lama selesai.');
    }

  } catch (error) {
    console.error('[Worker] Background sync error:', error.message);
  } finally {
    isWorkerRunning = false;
  }
};

module.exports = { runNotificationWorker };
