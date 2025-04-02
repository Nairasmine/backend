const express = require('express');
const profileController = require('../controllers/profileController');
const authenticateToken = require('../middleware/authenticateToken');
const upload = require('../middleware/upload'); // Multer middleware configured with memory storage

const router = express.Router();

/**
 * GET /api/profile
 * Retrieves the current user's profile including download history.
 */
router.get('/', authenticateToken, profileController.getProfile);

/**
 * PUT /api/profile
 * Updates the current user's profile.
 * If a file is uploaded on "profilePic", the profile picture will be updated.
 */
router.put('/', authenticateToken, upload.single('profilePic'), profileController.updateProfile);

/**
 * GET /api/profile/history
 * Retrieves the user's download and upload history, along with performance metrics.
 */
router.get('/history', authenticateToken, profileController.getHistory);

module.exports = router;
