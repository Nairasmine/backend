const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middleware/authenticateToken');

// Route to get the profile of the currently authenticated user.
router.get('/current-user', authenticateToken, userController.getCurrentUser);

// Route to get a public user profile by username.
router.get('/:username', authenticateToken, userController.getProfileByUsername);

module.exports = router;
