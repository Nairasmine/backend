// routes/bookmarkRoutes.js
const express = require('express');
const router = express.Router();
const bookmarkController = require('../controllers/bookmarkController');
const authenticateToken = require('../middleware/authenticateToken'); // Optional, if you require auth

// GET /api/bookmarks/all - fetch all bookmark data.
router.get('/all', authenticateToken, bookmarkController.getAllBookmarks);

module.exports = router;
