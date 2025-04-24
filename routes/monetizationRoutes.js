// routes/monetizationRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authenticateToken');
const monetizationController = require('../controllers/monetizationController');

// GET endpoint to fetch monetization details.
router.get('/details', authMiddleware, monetizationController.getMonetizationDetails);

// POST endpoint to withdraw earnings.
router.post('/withdraw', authMiddleware, monetizationController.withdrawEarnings);

module.exports = router;
