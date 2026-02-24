const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Username and password required.' });

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid credentials.' });

    if (!user.active)
      return res.status(403).json({ message: 'Account is deactivated.' });

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, username: user.username, role: user.role },
    });
  } catch (err) { next(err); }
});

// POST /api/auth/register (owner only in production)
router.post('/register', async (req, res, next) => {
  try {
    const { name, username, password, role } = req.body;
    if (!name || !username || !password)
      return res.status(400).json({ message: 'Name, username and password required.' });

    const exists = await User.findOne({ username: username.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'Username already exists.' });

    const user = await User.create({ name, username, password, role: role || 'staff' });
    res.status(201).json({ message: 'User created.', id: user._id });
  } catch (err) { next(err); }
});

// GET /api/auth/me
const authMiddleware = require('../middleware/auth');
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(user);
  } catch (err) { next(err); }
});

// PUT /api/auth/change-password
router.put('/change-password', authMiddleware, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!(await user.comparePassword(currentPassword)))
      return res.status(401).json({ message: 'Current password is incorrect.' });
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated.' });
  } catch (err) { next(err); }
});

module.exports = router;
