// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersadminController');
const authMiddleware = require('../middleware/authenticateToken'); // If you require authentication

// GET /api/users – Retrieves the user list with statistics.
router.get('/', authMiddleware, usersController.getUserList);

module.exports = router;
