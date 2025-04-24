// src/routes/withdrawalRoutes.js

const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');
const authMiddleware = require('../middleware/authenticateToken');

// For a user to submit a withdrawal request.
router.post('/', authMiddleware, withdrawalController.createWithdrawal);

// For admin: list withdrawal requests (optionally filtered by status, e.g., /?status=pending).
// If a "userId" query parameter is provided, the endpoint returns the user's earnings details.
router.get('/', authMiddleware, withdrawalController.listWithdrawals);

// For admin: update a withdrawal request's status (to mark it as "paid" or "declined").
router.patch('/:id', authMiddleware, withdrawalController.updateWithdrawalStatus);

module.exports = router;
