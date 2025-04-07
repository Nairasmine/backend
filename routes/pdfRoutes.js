const express = require('express');
const pdfController = require('../controllers/pdfController');
const authenticateToken = require('../middleware/authenticateToken');
const wrapAsync = require('../utils/wrapAsync'); // Ensure you have this utility
const { param, body, query, validationResult } = require('express-validator');

const router = express.Router();

/* -------------------------------------------------------------------------
   Middleware for Validation Errors
-------------------------------------------------------------------------*/
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map((validation) => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  };
};

/* -------------------------------------------------------------------------
   Static Routes
-------------------------------------------------------------------------*/

/**
 * GET /api/pdf/all
 * Retrieve metadata for all active PDFs.
 */
router.get('/all', authenticateToken, wrapAsync(pdfController.getAllPdfs));

/**
 * GET /api/pdf/search
 * Search PDFs by title, description, and optional paid/free status.
 */
router.get(
  '/search',
  authenticateToken,
  validate([
    query('title').optional().isString(),
    query('description').optional().isString(),
    query('isPaid').optional().isBoolean(),
  ]),
  wrapAsync(pdfController.searchPdfs)
);

/**
 * GET /api/pdf/download/:id
 * Download a specified PDF by id.
 */
router.get(
  '/download/:id',
  authenticateToken,
  validate([param('id').isInt().withMessage('PDF ID must be an integer')]),
  wrapAsync(pdfController.downloadPdf)
);

/**
 * POST /api/pdf/upload
 * Upload a new PDF (and an optional cover photo).
 */
router.post(
  '/upload',
  authenticateToken,
  wrapAsync(pdfController.uploadFile), // Handles file upload with Multer
  wrapAsync(pdfController.uploadPdf)
);

/**
 * POST /api/pdf/history
 * Record download history for a PDF.
 */
router.post('/history', authenticateToken, wrapAsync(pdfController.recordHistory));

/**
 * GET /api/pdf/purchases
 * Retrieve all purchased PDFs for the authenticated user.
 */
router.get('/purchases', authenticateToken, wrapAsync(pdfController.getPurchasedPdfs));

/* -------------------------------------------------------------------------
   Purchase Routes
-------------------------------------------------------------------------*/

/**
 * POST /api/pdf/:id/purchase
 * Initiate purchase for a specified PDF.
 */
router.post(
  '/:id/purchase',
  authenticateToken,
  validate([param('id').isInt().withMessage('PDF ID must be an integer')]),
  wrapAsync(pdfController.purchasePdf)
);

/**
 * POST /api/pdf/verify-payment
 * Verify payment completion and grant access.
 */
router.post(
  '/verify-payment',
  authenticateToken,
  validate([body('reference').isString().withMessage('Payment reference is required')]),
  wrapAsync(pdfController.verifyPayment)
);

/**
 * GET /api/pdf/:id/check-purchase
 * Check if the user has purchased a specified PDF.
 */
router.get(
  '/:id/check-purchase',
  authenticateToken,
  validate([param('id').isInt().withMessage('PDF ID must be an integer')]),
  wrapAsync(pdfController.checkPurchase)
);

/* -------------------------------------------------------------------------
   Bookmark Routes
-------------------------------------------------------------------------*/

/**
 * POST /api/pdf/:id/bookmark
 * Add a bookmark for a specified PDF.
 */
router.post(
  '/:id/bookmark',
  authenticateToken,
  validate([param('id').isInt().withMessage('PDF ID must be an integer')]),
  wrapAsync(pdfController.bookmarkPdf)
);

/**
 * DELETE /api/pdf/:id/bookmark
 * Remove a bookmark for a specified PDF.
 */
router.delete(
  '/:id/bookmark',
  authenticateToken,
  validate([param('id').isInt().withMessage('PDF ID must be an integer')]),
  wrapAsync(pdfController.removeBookmark)
);

/**
 * GET /api/pdf/bookmarks
 * Retrieve all bookmarks for the authenticated user.
 */
router.get('/bookmarks', authenticateToken, wrapAsync(pdfController.getBookmarks));

/* -------------------------------------------------------------------------
   Dynamic Routes
-------------------------------------------------------------------------*/

/**
 * PUT /api/pdf/:id
 * Update metadata (title, description, isPaid, and price) for a specified PDF.
 */
router.put(
  '/:id',
  authenticateToken,
  validate([
    param('id').isInt().withMessage('PDF ID must be an integer'),
    body('title').optional().isString(),
    body('description').optional().isString(),
    body('isPaid').optional().isBoolean(),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  ]),
  wrapAsync(pdfController.updatePdf)
);

/**
 * DELETE /api/pdf/:id
 * Delete a specified PDF.
 */
router.delete(
  '/:id',
  authenticateToken,
  validate([param('id').isInt().withMessage('PDF ID must be an integer')]),
  wrapAsync(pdfController.deletePdf)
);

/**
 * GET /api/pdf/:id/comments
 * Retrieve all comments associated with a given PDF.
 */
router.get(
  '/:id/comments',
  authenticateToken,
  validate([param('id').isInt().withMessage('PDF ID must be an integer')]),
  wrapAsync(pdfController.getComments)
);

/**
 * POST /api/pdf/:id/rate
 * Submit a rating for a specified PDF.
 */
router.post(
  '/:id/rate',
  authenticateToken,
  validate([
    param('id').isInt().withMessage('PDF ID must be an integer'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  ]),
  wrapAsync(pdfController.ratePdf)
);

/**
 * POST /api/pdf/:id/comment
 * Add a comment for a specified PDF.
 */
router.post(
  '/:id/comment',
  authenticateToken,
  validate([
    param('id').isInt().withMessage('PDF ID must be an integer'),
    body('comment').isString().withMessage('Comment cannot be empty'),
  ]),
  wrapAsync(pdfController.commentOnPdf)
);

/**
 * GET /api/pdf/:id/cover
 * Fetch the cover photo for a specified PDF.
 */
router.get(
  '/:id/cover',
  authenticateToken,
  validate([param('id').isInt().withMessage('PDF ID must be an integer')]),
  wrapAsync(pdfController.getCoverPhoto)
);

/**
 * GET /api/pdf/:id/uploader
 * Retrieve the uploader's profile picture and username for a specified PDF.
 */
router.get(
  '/:id/uploader',
  authenticateToken,
  validate([param('id').isInt().withMessage('PDF ID must be an integer')]),
  wrapAsync(pdfController.getUploaderInfo)
);

/**
 * GET /api/pdf/:id
 * Retrieve full details for a specified PDF.
 */
router.get(
  '/:id',
  authenticateToken,
  validate([param('id').isInt().withMessage('PDF ID must be an integer')]),
  wrapAsync(pdfController.getPdfDetails)
);

module.exports = router;
