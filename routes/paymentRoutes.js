const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// POST /api/payment/verify – Verify payment and record purchase.
router.post('/verify', paymentController.verifyPayment);

// GET /api/payment/:pdfId/purchase-status – Check if the current user purchased the PDF.
router.get('/:pdfId/purchase-status', paymentController.getPurchaseStatus);

module.exports = router;
