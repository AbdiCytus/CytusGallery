const axios = require('axios');
const prisma = require('../lib/prisma');
const {
  getCachedDanbooru,
  getTopPostsThisMonth,
  getTopPosts,
  getUserAppData,
  getSliderTags,
  getTotalPosts,
  getTotalPostsWithParams,
  getCachedPosts,
  getFollowedContents
} = require('../utils/danbooruUtils');

const root = async (req, res) => {
  const allowedKeys = ['page', 'limit', 'tab', 'lazyload', 'followedTags'];
  Object.keys(req.query).forEach(key => {
    if (!allowedKeys.includes(key)) {
      delete req.query[key];
    }
  });
  
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const isLazyLoadEnabled = req.query.lazyload === "true";

    let tab = req.query.tab || req.cookies?.cytusGalleryActiveTab || "contents";
    if (!res.locals.user && (tab === 'collection' || tab === 'followed')) {
        tab = 'contents';
    }
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
      const skip = (page - 1) * limit;
      let whereClause = { userId: res.locals.user.id };
      const filterQuery = req.query.query || "";
      
      let allowedRatings = [];
      const ratingMatch = filterQuery.match(/rating:([gsqe,]+)/);
      if (ratingMatch) {
          allowedRatings = ratingMatch[1].split(',').filter(r => ['g','s','q','e'].includes(r));
      }
      
      let blockedRatings = [];
      if (filterQuery.includes('-rating:e')) blockedRatings.push('e');
      if (filterQuery.includes('-rating:q')) blockedRatings.push('q');
      if (filterQuery.includes('-rating:s')) blockedRatings.push('s');
      if (!res.locals.isBypass) { 
         if (!blockedRatings.includes('e')) blockedRatings.push('e'); 
         if (!blockedRatings.includes('q')) blockedRatings.push('q'); 
      }
      
      if (allowedRatings.length > 0) {
          whereClause.rating = { in: allowedRatings };
      } else if (blockedRatings.length > 0) {
          whereClause.rating = { notIn: blockedRatings };
      }

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
            const dRes = await getCachedDanbooru(`https://danbooru.donmai.us/posts.json`, { tags: `id:${postIds.join(',')}`, limit: 200 });
            const fetched = dRes.data;
            fetched.forEach(p => { fetchedPosts[p.id.toString()] = p; });
         } catch (e) {
            console.error("Failed to fetch saves from Danbooru", e.message);
         }
      }
      
      posts = saves.map(s => {
        const danbooruP = fetchedPosts[s.postId.toString()];
        if (danbooruP) return danbooruP;
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
      let followedTagsFilter = null;
      if (req.query.followedTags !== undefined) {
        followedTagsFilter = req.query.followedTags ? req.query.followedTags.split(',') : [];
      }
      const result = await getFollowedContents(res.locals.user.id, "", page, limit, res.locals.isBypass, followedTagsFilter);
      posts = result.posts;
      totalPosts = result.totalPosts;
      totalPages = result.totalPages;
      hasFollowedTags = result.hasFollowedTags;

      // Pre-fetch halaman berikutnya di background agar navigasi next terasa instan
      if (page < result.totalPages) {
        setImmediate(() => {
          getFollowedContents(res.locals.user.id, "", page + 1, limit, res.locals.isBypass, followedTagsFilter)
            .catch(() => {});
        });
      }
    } else {
      let baseTags = "";
      if (!res.locals.isBypass) {
        baseTags = "rating:g,s";
      }
      const contentsParams = { tags: baseTags, page: page, limit: limit };
      
      const [contents, stats] = await Promise.all([
        getCachedPosts(contentsParams),
        getTotalPosts(limit)
      ]);
      
      posts = contents.data || [];
      totalPosts = stats.totalPosts;
      totalPages = stats.totalPages;

      // Pre-fetch halaman berikutnya di background
      if (posts.length > 0 && page < totalPages) {
        setImmediate(() => {
          getCachedPosts({ tags: baseTags, page: page + 1, limit: limit }).catch(() => {});
        });
      }
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
      currentTab: tab,
      followedTagsQuery: req.query.followedTags,
      hasFollowedTags: hasFollowedTags
    });
  } catch (error) {
    console.error("Error fetching homepage data:", error);
    if (error && error.message && error.message.includes('planLimitReached')) {
      return res.status(503).render("error", { message: "Batas Limit Server (Database) telah tercapai. Layanan ini sementara tidak tersedia." });
    }
    res.status(500).render("error", { message: "Gagal mengambil data dari Danbooru API" });
  }
};

const search = async (req, res) => {
  const allowedKeys = ['tags', 'page', 'limit', 'tab', 'query', 'lazyload', 'followedTags'];
  Object.keys(req.query).forEach(key => {
    if (!allowedKeys.includes(key)) {
      delete req.query[key];
    }
  });

  let userTags = (req.query.tags || "").trim();
  let filterQuery = (req.query.query || "").trim();

  // Proteksi URL untuk rating bypass
  if (!res.locals.isBypass) {
     const explicitRegex = /rating:[^\s]*(e|q)[^\s]*/gi;
     userTags = userTags.replace(explicitRegex, '').trim();
     filterQuery = filterQuery.replace(explicitRegex, '').trim();
     
     if (!filterQuery.includes('rating:g') && !filterQuery.includes('rating:s') && !userTags.includes('rating:g') && !userTags.includes('rating:s')) {
         filterQuery += ' rating:g,s';
     }
     filterQuery = filterQuery.trim();
  }

  const allTags = `${userTags} ${filterQuery}`.trim();

  // Block dihapus agar `/search` bisa menangani tags kosong (menampilkan semua).

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const isLazyLoadEnabled = req.query.lazyload === "true";

    let tab = req.query.tab || req.cookies?.cytusGalleryActiveTab || "contents";
    if (!res.locals.user && (tab === 'collection' || tab === 'followed')) {
        tab = 'contents';
    }
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
            const dRes = await getCachedDanbooru(`https://danbooru.donmai.us/posts.json`, { tags: `id:${postIds.join(',')}`, limit: 200 });
            const fetched = dRes.data;
            fetched.forEach(p => { fetchedPosts[p.id.toString()] = p; });
         } catch (e) {
            console.error("Failed to fetch saves from Danbooru", e.message);
         }
      }
      
      posts = saves.map(s => {
        const danbooruP = fetchedPosts[s.postId.toString()];
        if (danbooruP) return danbooruP;
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
      let followedTagsFilter = null;
      if (req.query.followedTags !== undefined) {
        followedTagsFilter = req.query.followedTags ? req.query.followedTags.split(',') : [];
      }
      const result = await getFollowedContents(res.locals.user.id, filterQuery, page, limit, res.locals.isBypass, followedTagsFilter);
      posts = result.posts;
      totalPosts = result.totalPosts;
      totalPages = result.totalPages;
      hasFollowedTags = result.hasFollowedTags;

      // Pre-fetch halaman berikutnya di background agar navigasi next terasa instan
      if (page < result.totalPages) {
        setImmediate(() => {
          getFollowedContents(res.locals.user.id, filterQuery, page + 1, limit, res.locals.isBypass, followedTagsFilter)
            .catch(() => {});
        });
      }
    } else {
      const contentsParams = { tags: allTags, page: page, limit: limit };
      const [contents, stats] = await Promise.all([
        getCachedPosts(contentsParams),
        getTotalPostsWithParams(userTags, filterQuery, limit)
      ]);
      posts = contents.data || [];
      totalPages = stats.totalPages;
      totalPosts = stats.totalPosts;

      // Pre-fetch halaman berikutnya di background
      if (posts.length > 0 && page < totalPages) {
        setImmediate(() => {
          getCachedPosts({ tags: allTags, page: page + 1, limit: limit }).catch(() => {});
        });
      }
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

    let sliderTitle = "Contents of the Month";
    if (page === 1) {
      const sliderFilter = tab === "followed" ? filterQuery.replace(/date:[^\s]+/g, '').trim() : filterQuery;
      if (actualUserTags) {
         const tagsCount = actualUserTags.trim().split(/\s+/).filter(t => t).length;
         sliderTitle = tagsCount >= 2 ? "Best Recent Contents" : "Top Contents";
         sliderPosts = await getTopPosts(actualUserTags, sliderFilter, 15);
      } else {
         sliderPosts = await getTopPostsThisMonth(15, sliderFilter);
      }
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
      sliderTitle: sliderTitle,
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
      followedTagsQuery: req.query.followedTags,
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
      message: "Gagal mengambil data. Kemungkinan server sedang sibuk, atau menggunakan lebih dari 2 tag sekaligus, atau telah mencapai batas halaman (>1000).",
    });
  }
};

const detail = async (req, res) => {
  try {
    const postId = req.params.id;
    const response = await getCachedDanbooru(`https://danbooru.donmai.us/posts/${postId}.json`);
    const post = response.data;
    
    if ((post.rating === 'e' || post.rating === 'q') && !res.locals.isBypass) {
      return res.status(404).render("error", {
        message: "Konten tidak ditemukan. Konten mungkin dihapus atau disembunyikan karena rating."
      });
    }

    let isSaved = false;
    let followedTags = [];
    if (req.user) {
      const saved = await prisma.savedContent.findUnique({
        where: { userId_postId: { userId: req.user.id, postId: postId } }
      });
      if (saved) isSaved = true;

      const follows = await prisma.followedTag.findMany({
        where: { userId: req.user.id }
      });
      follows.sort((a, b) => {
        const aCopy = a.tagType === 3 ? 0 : 1;
        const bCopy = b.tagType === 3 ? 0 : 1;
        if (aCopy !== bCopy) return aCopy - bCopy;
        return a.tagName.localeCompare(b.tagName);
      });
      followedTags = follows.map(f => f.tagName);
    }

    res.render("detail", { post: post, isSaved: isSaved, followedTags: followedTags });
  } catch (error) {
    console.error("Error fetching post details:", error);
    if (error && error.message && error.message.includes('planLimitReached')) {
      return res.status(503).render("error", { message: "Batas Limit Server (Database) telah tercapai. Layanan ini sementara tidak tersedia." });
    }
    res.status(404).render("error", { message: "Konten tidak ditemukan." });
  }
};

module.exports = { root, search, detail };
