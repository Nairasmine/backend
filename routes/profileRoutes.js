const express = require('express');
const profileController = require('../controllers/profileController');
const pdfController = require('../controllers/pdfController');
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

/**
 * GET /api/profile/upload-permission
 * Retrieves the upload fee permission status for the current user.
 */
router.get('/upload-permission', authenticateToken, profileController.getUploadPermission);

/**
 * GET /api/profile/purchased
 * Retrieves the purchased PDFs for the current user.
 * (Handled by a separate controller: pdfController)
 */
router.get('/purchased', authenticateToken, pdfController.getPurchasedPdfs);

module.exports = router;
