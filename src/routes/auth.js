const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('../lib/prisma');
const axios = require('axios');

const router = express.Router();
router.use(passport.initialize());

const JWT_SECRET = process.env.JWT_SECRET || 'cytus_gallery_secret_key';

const baseUrl = process.env.BASE_URL || process.env.URL || 'http://localhost:3000';

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'placeholder',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder',
    callbackURL: `${baseUrl}/api/auth/callback/google`
  },
  async function(accessToken, refreshToken, profile, cb) {
    try {
      let user = await prisma.user.findUnique({ where: { googleId: profile.id } });
      if (!user) {
        user = await prisma.user.findUnique({ where: { email: profile.emails[0].value } });
        if (user) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { googleId: profile.id, avatarUrl: profile.photos && profile.photos[0] ? profile.photos[0].value : null }
          });
        } else {
          user = await prisma.user.create({
            data: {
              email: profile.emails[0].value,
              name: profile.displayName,
              googleId: profile.id,
              avatarUrl: profile.photos && profile.photos[0] ? profile.photos[0].value : null
            }
          });
        }
      }
      return cb(null, user);
    } catch (err) {
      return cb(err, null);
    }
  }
));
// Tampilkan halaman Register
router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('register', { error: null });
});

// Proses Register
router.post('/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.render('register', { error: 'Email sudah terdaftar.' });
    }
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
      },
    });
    
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.redirect('/');
  } catch (error) {
    console.error('Register error:', error);
    if (error && error.message && error.message.includes('planLimitReached')) {
      return res.status(503).render('error', { message: 'Batas Limit Server (Database) telah tercapai. Pendaftaran pengguna baru sementara dinonaktifkan.' });
    }
    res.render('register', { error: 'Terjadi kesalahan pada server.' });
  }
});

// Tampilkan halaman Login
router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('login', { error: null });
});

// Proses Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || !user.passwordHash) {
      return res.render('login', { error: 'Kredensial tidak valid.' });
    }
    
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.render('login', { error: 'Kredensial tidak valid.' });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.redirect('/');
  } catch (error) {
    console.error('Login error:', error);
    if (error && error.message && error.message.includes('planLimitReached')) {
      return res.status(503).render('error', { message: 'Batas Limit Server (Database) telah tercapai. Layanan login sementara dinonaktifkan.' });
    }
    res.render('login', { error: 'Terjadi kesalahan pada server.' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.clearCookie('cytusGalleryActiveTab');
  res.redirect('/');
});

// Switch Account
router.get('/switch-account', (req, res) => {
  res.clearCookie('token');
  res.clearCookie('cytusGalleryActiveTab');
  res.redirect('/login');
});

// Google OAuth Routes
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get('/api/auth/callback/google', 
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  function(req, res) {
    // Cegah cookie terlalu besar jika avatar di database adalah Base64 (efek dari Orbit Station)
    const safeAvatar = req.user.avatarUrl && req.user.avatarUrl.startsWith('data:') ? null : req.user.avatarUrl;
    
    const token = jwt.sign({ id: req.user.id, email: req.user.email, name: req.user.name, avatarUrl: safeAvatar }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.redirect('/');
  }
);

// Orbit Station OAuth Routes
router.get('/auth/orbit', (req, res) => {
  const redirectUri = encodeURIComponent(`${baseUrl}/api/auth/callback/orbit`);
  const orbitUrl = process.env.ORBIT_URL || 'https://orbitstation.vercel.app';
  const clientId = process.env.ORBIT_CLIENT_ID;
  if (!clientId) {
    console.error("Orbit Station Client ID is missing.");
    return res.redirect('/login');
  }
  const url = `${orbitUrl}/api/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=profile%20email`;
  res.redirect(url);
});

router.get('/api/auth/callback/orbit', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/login');
  
  const orbitUrl = process.env.ORBIT_URL || 'https://orbitstation.vercel.app';
  const clientId = process.env.ORBIT_CLIENT_ID;
  const clientSecret = process.env.ORBIT_CLIENT_SECRET;
  const redirectUri = `${baseUrl}/api/auth/callback/orbit`;
  
  try {
    const tokenParams = new URLSearchParams();
    tokenParams.append('grant_type', 'authorization_code');
    tokenParams.append('code', code);
    tokenParams.append('client_id', clientId);
    tokenParams.append('client_secret', clientSecret);
    tokenParams.append('redirect_uri', redirectUri);
    
    const tokenRes = await axios.post(`${orbitUrl}/api/oauth/token`, tokenParams.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const accessToken = tokenRes.data.access_token;
    
    const userRes = await axios.get(`${orbitUrl}/api/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const profile = userRes.data;
    
    // Fallback: Prisma doesn't have findUnique for orbitId since it's not marked @unique, use findFirst
    let user = await prisma.user.findFirst({ where: { orbitId: profile.sub } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { email: profile.email } });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { orbitId: profile.sub, ...(user.avatarUrl ? {} : { avatarUrl: profile.picture }) }
        });
      } else {
        user = await prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            orbitId: profile.sub,
            avatarUrl: profile.picture
          }
        });
      }
    }
    
    // Cegah cookie terlalu besar jika avatar dari Orbit adalah Base64
    const safeAvatar = user.avatarUrl && user.avatarUrl.startsWith('data:') ? null : user.avatarUrl;
    
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, avatarUrl: safeAvatar }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.redirect('/');
  } catch (error) {
    console.error('Orbit OAuth Error:', error.response?.data || error.message);
    res.redirect('/login');
  }
});

module.exports = router;
