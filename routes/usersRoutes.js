const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticateToken = require('../middleware/authenticateToken');

// Ensure that getProfileByUsername exists on the userController object.
router.get('/:username', authenticateToken, userController.getProfileByUsername);

module.exports = router;
