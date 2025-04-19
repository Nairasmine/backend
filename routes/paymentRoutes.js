const express = require('express');
const asyncHandler = require('express-async-handler');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authenticate = require('../middleware/authenticateToken'); // Ensure this middleware is implemented

// POST /api/payment/verify – Verify payment and record purchase.
router.post(
  '/verify',
  authenticate,
  asyncHandler(paymentController.verifyPayment)
);

// GET /api/payment/purchases – Retrieve all purchased PDFs for the authenticated user.
router.get(
  '/purchases',
  authenticate,
  asyncHandler(paymentController.getPurchasedPdfs)
);

// GET /api/payment/:pdfId/purchase-status – Check if the current user purchased the PDF.
router.get(
  '/:pdfId/purchase-status',
  authenticate,
  asyncHandler(paymentController.getPurchaseStatus)
);

// GET /api/payment/receipts/:transactionId/pdf – Download the receipt as a PDF.
router.get(
  '/receipts/:transactionId/pdf',
  authenticate,
  asyncHandler(paymentController.downloadReceiptPdf)
);

// GET /api/payment/receipts/:transactionId/image – Download the receipt as an image.
router.get(
  '/receipts/:transactionId/image',
  authenticate,
  asyncHandler(paymentController.downloadReceiptImage)
);

module.exports = router;
