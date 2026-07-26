const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('../lib/prisma');

const router = express.Router();
router.use(passport.initialize());

const JWT_SECRET = process.env.JWT_SECRET || 'cytus_gallery_secret_key';

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'placeholder',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder',
    callbackURL: "http://localhost:3000/api/auth/callback/google"
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
    res.render('login', { error: 'Terjadi kesalahan pada server.' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

// Google OAuth Routes
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get('/api/auth/callback/google', 
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  function(req, res) {
    const token = jwt.sign({ id: req.user.id, email: req.user.email, name: req.user.name, avatarUrl: req.user.avatarUrl }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.redirect('/');
  }
);

module.exports = router;
