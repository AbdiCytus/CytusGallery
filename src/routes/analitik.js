const express = require('express');
const router = express.Router();
const axios = require('axios').create({
  headers: { 'User-Agent': 'CytusGallery/1.0 (by Abdi)' }
});
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middlewares/authMiddleware');
const { getCacheData, setCacheData, CACHE_TTL } = require('../utils/danbooruUtils');

const ALLOWED_CATEGORIES = [1, 3, 4];
const CAT_LABELS = { 1: 'Artist', 3: 'Copyright', 4: 'Character' };

router.get("/analitik", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const getGlobalTags = async () => {
      const cacheKey = 'analitik_globalTags';
      const cached = await getCacheData(cacheKey);
      if (cached) return cached;
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
        await setCacheData(cacheKey, globalTags, CACHE_TTL);
      } catch(e) {}
      return globalTags;
    };

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
      const cached = await getCacheData(cacheKey);
      if (cached) return cached;
      
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
        await setCacheData(cacheKey, trendingTags, CACHE_TTL);
      } catch(e) {}
      return trendingTags;
    };

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
          const cached = await getCacheData(cacheKey);
          if (cached) {
            topCollectionTags = cached;
          } else {
            const names = topRaw.map(t => t[0]).join(',');
            const resp = await axios.get('https://danbooru.donmai.us/tags.json', { params: { 'search[name_comma]': names, 'limit': 50 }, timeout: 5000 });
            if (resp.data && Array.isArray(resp.data)) {
              const catLookup = {};
              resp.data.forEach(t => { catLookup[t.name] = t.category; });
              topCollectionTags = topRaw.filter(([name]) => ALLOWED_CATEGORIES.includes(catLookup[name]))
                .slice(0, 3).map(([name, count]) => ({ name, count, category: catLookup[name], categoryLabel: CAT_LABELS[catLookup[name]] }));
              await setCacheData(cacheKey, topCollectionTags, CACHE_TTL);
            }
          }
        } catch(e) {}
      }
      return { topCollectionTags, totalSaves: allSaves.length };
    };

    const getUserDetails = async () => {
      let lastClear = parseInt(req.cookies[`lastNotifClear_${req.user.id}`] || '0', 10);
      if (isNaN(lastClear)) lastClear = 0;
      const [allFollowedTagsCount, unreadCount] = await Promise.all([
        prisma.followedTag.count({ where: { userId } }),
        prisma.notification.count({ where: { userId, isRead: false, createdAt: { gt: new Date(lastClear) } } })
      ]);
      return { totalFollowed: allFollowedTagsCount, unreadCount };
    };

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

module.exports = router;
