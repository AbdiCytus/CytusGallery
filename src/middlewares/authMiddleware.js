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

const checkUser = async (req, res, next) => {
  const token = req.cookies.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cytus_gallery_secret_key');
      const prisma = require('../lib/prisma');
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (user) {
        req.user = user;
        res.locals.user = user;
        res.locals.isBypass = (process.env.BYPASSEXPLICITCONTENTACCOUNT && user.email === process.env.BYPASSEXPLICITCONTENTACCOUNT) || false;
        try {
          res.locals.unreadCount = await prisma.notification.count({ where: { userId: user.id, isRead: false } });
        } catch (e) {
          res.locals.unreadCount = 0;
        }
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
