// routes/pdfRankingsRoutes.js

const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authenticateToken'); // Adjust the path if needed
const { getTopSellers, getMostSellingBooks } = require('../controllers/pdfRankingsController');

// Protect the Top Sellers endpoint
router.get('/top-sellers', authenticateToken, getTopSellers);

// Protect the Most Selling Books endpoint
router.get('/most-selling-books', authenticateToken, getMostSellingBooks);

module.exports = router;
