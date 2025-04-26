// routes/bookmarkRoutes.js
const express = require('express');
const router = express.Router();
const bookmarkController = require('../controllers/bookmarkController');
const authenticateToken = require('../middleware/authenticateToken');

// GET /api/bookmarks/all - fetch all bookmark data for the authenticated user.
router.get('/all', authenticateToken, bookmarkController.getAllBookmarks);

// POST /api/bookmarks - add a new bookmark (requires a request body with necessary PDF data).
router.post('/', authenticateToken, bookmarkController.addBookmark);

// DELETE /api/bookmarks/:pdfId - remove a bookmark for a given PDF.
router.delete('/:pdfId', authenticateToken, bookmarkController.removeBookmark);

module.exports = router;
