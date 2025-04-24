const express = require('express');
const router = express.Router();
const { verifyUploadFeePayment, getUploadFeeStatus } = require('../controllers/uploadPermissionController');
const authenticateToken = require('../middleware/authenticateToken');

// All routes in this file require a valid JWT token.
router.post('/verify', authenticateToken, verifyUploadFeePayment);
router.get('/status', authenticateToken, getUploadFeeStatus);

module.exports = router;
