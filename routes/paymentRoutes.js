// routes/payment.js
const express = require('express');
const asyncHandler = require('express-async-handler');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authenticate = require('../middleware/authenticateToken'); // Ensure this middleware is implemented

/**
 * POST /api/payment/verify
 * Verifies a payment (non-Paystack) and records the purchase.
 */
router.post(
  '/verify',
  authenticate,
  asyncHandler(paymentController.verifyPayment)
);

/**
 * POST /api/payment/paystack/initialize
 * Initializes a Paystack payment.
 */
router.post(
  '/paystack/initialize',
  asyncHandler(paymentController.initializePaystack)
);

/**
 * GET /api/payment/paystack/verify/:reference
 * Verifies a Paystack payment using its reference.
 */
router.get(
  '/paystack/verify/:reference',
  authenticate,
  asyncHandler(paymentController.verifyPaystackPayment)
);

/**
 * GET /api/payment/purchases
 * Retrieves all purchased PDFs for the authenticated user.
 */
router.get(
  '/purchases',
  authenticate,
  asyncHandler(paymentController.getPurchasedPdfs)
);

/**
 * GET /api/payment/receipts/:transactionId/pdf
 * Downloads the receipt as a PDF.
 */
router.get(
  '/receipts/:transactionId/pdf',
  authenticate,
  asyncHandler(paymentController.downloadReceiptPdf)
);

/**
 * GET /api/payment/receipts/:transactionId/image
 * Downloads the receipt as an image.
 */
router.get(
  '/receipts/:transactionId/image',
  authenticate,
  asyncHandler(paymentController.downloadReceiptImage)
);

/**
 * POST /api/payment/:pdfId/purchase
 * Processes a PDF purchase.
 */
router.post(
  '/:pdfId/purchase',
  authenticate,
  asyncHandler(paymentController.purchasePdf)
);

/**
 * GET /api/payment/:pdfId/purchase-status
 * Checks if the current authenticated user has purchased the PDF.
 */
router.get(
  '/:pdfId/purchase-status',
  authenticate,
  asyncHandler(paymentController.getPurchaseStatus)
);

/**
 * POST /api/payment/record
 * Records (or updates) a payment purchase (e.g. for upload fee payments).
 */
router.post(
  '/record',
  authenticate,
  asyncHandler(paymentController.recordPurchase)
);

module.exports = router;
