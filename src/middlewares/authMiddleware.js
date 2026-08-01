const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.redirect('/login');
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cytus_gallery_secret_key');
    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie('token');
    return res.redirect('/login');
  }
};

const userCache = new Map();
const USER_CACHE_TTL = 30 * 1000; // 30 detik

const checkUser = async (req, res, next) => {
  const token = req.cookies.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cytus_gallery_secret_key');
      
      const lastClear = parseInt(req.cookies.lastNotifClear || '0', 10);
      const cacheKey = `${decoded.id}_${lastClear}`;
      const cached = userCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < USER_CACHE_TTL) {
        req.user = cached.user;
        res.locals.user = cached.user;
        res.locals.isBypass = cached.isBypass;
        res.locals.unreadCount = cached.unreadCount;
        return next();
      }

      const prisma = require('../lib/prisma');
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (user) {
        req.user = user;
        res.locals.user = user;
        res.locals.isBypass = (process.env.BYPASSEXPLICITCONTENTACCOUNT && user.email === process.env.BYPASSEXPLICITCONTENTACCOUNT) || false;
        try {
          res.locals.unreadCount = await prisma.notification.count({ 
            where: { 
              userId: user.id, 
              isRead: false,
              createdAt: { gt: new Date(lastClear) }
            } 
          });
        } catch (e) {
          res.locals.unreadCount = 0;
        }
        
        userCache.set(cacheKey, {
          timestamp: Date.now(),
          user: user,
          isBypass: res.locals.isBypass,
          unreadCount: res.locals.unreadCount
        });
      } else {
        req.user = null;
        res.locals.user = null;
      }
    } catch (err) {
      req.user = null;
      res.locals.user = null;
    }
  } else {
    req.user = null;
    res.locals.user = null;
  }
  next();
};

module.exports = { requireAuth, checkUser };
