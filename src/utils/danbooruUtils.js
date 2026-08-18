const axios = require('axios');
const prisma = require('../lib/prisma');
const { getRedisClient, isConnected } = require('../lib/redis');

//Base API URL
const baseTagURL = "https://danbooru.donmai.us/tags.json";
const basePostsURL = "https://danbooru.donmai.us/posts.json";
const baseCountsPostsURL = "https://danbooru.donmai.us/counts/posts.json";

const inMemoryCache = {}; // Fallback cache
const CACHE_TTL = 10 * 60 * 1000; // 10 menit
const USER_APP_DATA_TTL = 30 * 1000; // 30 seconds

async function getCacheData(key) {
  // L1 Check (In-Memory)
  const cached = inMemoryCache[key];
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  
  // L2 Check (Redis)
  if (isConnected()) {
    try {
      const data = await getRedisClient().get(key);
      if (data) {
        const parsedData = JSON.parse(data);
        // Save to L1 for future instant access
        inMemoryCache[key] = { timestamp: Date.now(), data: parsedData, ttl: CACHE_TTL };
        return parsedData;
      }
    } catch (err) {
      console.error("Redis GET error:", err.message);
    }
  }
  
  return null;
}

async function setCacheData(key, data, ttlMs = CACHE_TTL) {
  // Always save to L1 (In-Memory) as fallback and to reduce Redis requests
  inMemoryCache[key] = { timestamp: Date.now(), data, ttl: ttlMs };
  
  if (isConnected()) {
    try {
      await getRedisClient().setEx(key, Math.max(1, Math.ceil(ttlMs / 1000)), JSON.stringify(data));
    } catch (err) {
      console.error("Redis SET error:", err.message);
    }
  }
}

async function deleteCacheData(key) {
  if (isConnected()) {
    try {
      await getRedisClient().del(key);
    } catch (err) {
      console.error("Redis DEL error:", err);
    }
  }
  delete inMemoryCache[key];
}

const inFlightRequests = {};
async function getCachedDanbooru(url, params = {}, timeout = 8000) {
  const cacheKey = `danbooru_${url}_${JSON.stringify(params)}`;
  
  const cachedData = await getCacheData(cacheKey);
  if (cachedData) {
    return { data: cachedData };
  }
  
  if (inFlightRequests[cacheKey]) {
    return inFlightRequests[cacheKey];
  }
  
  const reqPromise = (async () => {
    try {
      const response = await axios.get(url, { params: params, timeout: timeout });
      let finalData = response.data;
      if (Array.isArray(finalData)) {
         finalData = finalData.filter(p => !p.is_banned && !p.is_deleted && !p.is_pending && p.large_file_url);
      }
      await setCacheData(cacheKey, finalData, CACHE_TTL);
      return { data: finalData };
    } catch (err) {
      if (err.response && (err.response.status === 422 || err.response.status === 500)) {
         throw err;
      }
      return { data: [] }; // Return fallback for other errors
    }
  })();
  
  inFlightRequests[cacheKey] = reqPromise;
  
  try {
    const result = await reqPromise;
    return result;
  } finally {
    delete inFlightRequests[cacheKey];
  }
}

async function getTopPostsThisMonth(limit, filter = "") {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, "0");
    const startOfMonth = `${year}-${month}-01`;

    const query = `order:score date:>=${startOfMonth} ${filter}`.trim();
    const params = { tags: query, limit: limit };
    const response = await getCachedDanbooru(basePostsURL, params, 8000);

    return response.data;
  } catch (error) {
    if (error.response && (error.response.status === 422 || error.response.status === 500)) {
      try {
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, "0");
        const startOfMonth = `${year}-${month}-01`;
        
        const fallbackQuery = `date:>=${startOfMonth} ${filter}`.trim();
        const fallbackResponse = await getCachedDanbooru(basePostsURL, { tags: fallbackQuery, limit: 200 }, 8000);
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
    const response = await getCachedDanbooru(basePostsURL, params, 8000);
    return response.data;
  } catch (err) {
    if (err.response && (err.response.status === 422 || err.response.status === 500)) {
      try {
        const fallbackQuery = `${tags} ${filter}`.trim();
        const fallbackResponse = await getCachedDanbooru(basePostsURL, { tags: fallbackQuery, limit: 200 }, 8000);
        let sorted = fallbackResponse.data.sort((a, b) => b.score - a.score);
        return sorted.slice(0, limit);
      } catch (fallbackErr) {
        return [];
      }
    }
    return [];
  }
}

/**
 * Ambil konten populer menggunakan endpoint resmi Danbooru.
 * Menggantikan workaround order:score yang sering error 422.
 * @param {'day'|'week'|'month'} scale - Rentang waktu popularitas
 * @param {string} filter - Filter tambahan (misal: 'rating:g,s')
 * @param {number} limit - Jumlah konten yang diinginkan
 */
async function getPopularPosts(scale = 'month', filter = '', limit = 15) {
  const cacheKey = `popularPosts_${scale}_${filter}_${limit}`;
  const cachedData = await getCacheData(cacheKey);
  if (cachedData) return cachedData;

  try {
    const response = await getCachedDanbooru(
      'https://danbooru.donmai.us/explore/posts/popular.json',
      { scale },
      8000
    );
    let posts = response.data || [];

    // Terapkan filter rating secara manual karena explore endpoint
    // tidak mendukung tag-based filtering langsung
    if (filter) {
      const ratingMatch = filter.match(/rating:([gsqe,]+)/);
      if (ratingMatch) {
        const allowedRatings = ratingMatch[1].split(',');
        posts = posts.filter(p => allowedRatings.includes(p.rating));
      }
    }

    const result = posts.slice(0, limit);
    await setCacheData(cacheKey, result, CACHE_TTL);
    return result;
  } catch (error) {
    console.error(`[getPopularPosts] Gagal fetch explore endpoint (scale=${scale}), fallback ke getTopPostsThisMonth:`, error.message);
    return getTopPostsThisMonth(limit, filter);
  }
}

async function getUserAppData(userId) {
  const cacheKey = `userAppData_${userId}`;
  const cachedData = await getCacheData(cacheKey);
  if (cachedData) {
    if (cachedData.savedPostIds && Array.isArray(cachedData.savedPostIds)) {
      cachedData.savedPostIds = new Set(cachedData.savedPostIds);
    }
    return cachedData;
  }
  
  let hasFollowedTags = false;
  let followedTags = [];
  let follows = [];
  let savedPostIds = new Set();
  try {
    follows = await prisma.followedTag.findMany({ where: { userId }, select: { tagName: true, tagType: true } });
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
  const resultToCache = { hasFollowedTags, followedTags, followedTagsDetailed: follows, savedPostIds: Array.from(savedPostIds) };
  await setCacheData(cacheKey, resultToCache, USER_APP_DATA_TTL);
  return { hasFollowedTags, followedTags, followedTagsDetailed: follows, savedPostIds };
}

async function getSliderTags(category) {
  const cacheKey = `sliderTags_${category}`;
  const cachedData = await getCacheData(cacheKey);
  if (cachedData) return cachedData;

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
  await setCacheData(cacheKey, result, CACHE_TTL);
  return result;
}

async function getTotalPosts(limit) {
  const cacheKey = `totalPosts_${limit}`;
  const cachedData = await getCacheData(cacheKey);
  if (cachedData) return cachedData;
  
  const getCounts = await axios.get(baseCountsPostsURL, { timeout: 8000 }).catch(e => ({ data: { counts: { posts: 100 } } }));
  const totalPosts = getCounts.data?.counts?.posts || 100;
  const totalPages = Math.ceil(totalPosts / limit);
  const result = { totalPosts, totalPages };
  await setCacheData(cacheKey, result, CACHE_TTL);
  return result;
}

async function getTotalPostsWithParams(tags, query, limit) {
  const combinedTags = `${tags || ''} ${query || ''}`.trim();
  if (!combinedTags) {
    return getTotalPosts(limit);
  }

  const cacheKey = `totalPostsParams_${combinedTags}_${limit}`;
  const cachedData = await getCacheData(cacheKey);
  if (cachedData) return cachedData;

  let totalPosts;
  let fallbackResponse;
  const getCounts = await axios.get(baseCountsPostsURL, {
    params: {
      tags: combinedTags,
    },
    timeout: 8000
  }).catch(() => ({ data: { counts: { posts: null } } }));
  
  if (getCounts.data?.counts?.posts == null) {
    if (combinedTags)
      fallbackResponse = await axios.get(baseCountsPostsURL, {
        params: { tags: combinedTags },
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
  await setCacheData(cacheKey, result, CACHE_TTL);
  return result;
}

async function getCachedPosts(params) {
  const cacheKey = `posts_${params.tags || ''}_${params.page}_${params.limit}`;
  const cachedData = await getCacheData(cacheKey);
  if (cachedData) return cachedData;
  
  const response = await getCachedDanbooru(basePostsURL, params, 8000).catch(e => ({ data: [], error: true }));
  
  if (response.error) {
    // Do not cache at all if there was an error (like timeout or rate limit)
  } else if (!response.data || response.data.length === 0) {
    // Cache empty results (not caused by error) briefly
    await setCacheData(cacheKey, response, 10000); 
  } else {
    await setCacheData(cacheKey, response, CACHE_TTL);
  }
  
  return response;
}

async function getFollowedContents(userId, filterQuery, page, limit, isBypass, followedTagsFilter = null) {
  const filterKey = followedTagsFilter ? followedTagsFilter.join(',') : 'all';
  const cacheKey = `followedContents_${userId}_${filterQuery}_${page}_${limit}_${isBypass}_${filterKey}`;
  const cachedData = await getCacheData(cacheKey);
  if (cachedData) return cachedData;

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
    manualRatingFilter = true;
  }

  const postsNeeded = page * limit;
  const chunkLimit = 50;
  const chunksNeeded = Math.ceil((postsNeeded + limit) / chunkLimit);
  
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
      
      networkTasks.push(async () => {
        const cData = await getCacheData(chunkCacheKey);
        if (cData) {
          results[idx] = cData;
        } else {
          const res = await getCachedDanbooru(basePostsURL, { tags: tName, page: c, limit: chunkLimit }, 12000);
          const data = res.data || [];
          results[idx] = data;
          await setCacheData(chunkCacheKey, data, CACHE_TTL);
        }
      });
    }
  });

  const batchSize = 15;
  for (let b = 0; b < networkTasks.length; b += batchSize) {
    const batch = networkTasks.slice(b, b + batchSize);
    await Promise.all(batch.map(fn => fn()));
  }
  
  let allPosts = [];
  let hasMore = false;
  
  for (let i = 0; i < tagsToProcess.length; i++) {
    const tagChunks = results.slice(i * fetchChunks, (i + 1) * fetchChunks);
    tagChunks.forEach(chunkData => {
      if (Array.isArray(chunkData)) {
        allPosts = allPosts.concat(chunkData);
      }
    });
    
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
  await setCacheData(cacheKey, finalResult, CACHE_TTL);
  return finalResult;
}

module.exports = {
  baseTagURL,
  basePostsURL,
  baseCountsPostsURL,
  CACHE_TTL,
  USER_APP_DATA_TTL,
  getCacheData,
  setCacheData,
  deleteCacheData,
  getCachedDanbooru,
  getTopPostsThisMonth,
  getTopPosts,
  getPopularPosts,
  getUserAppData,
  getSliderTags,
  getTotalPosts,
  getTotalPostsWithParams,
  getCachedPosts,
  getFollowedContents
};
