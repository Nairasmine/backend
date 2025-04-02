const express = require('express');
const pdfController = require('../controllers/pdfController');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

/**
 * Helper function that ensures a callback function is valid.
 * If the provided callback is undefined, it returns a placeholder function
 * that responds with a 501 status. This prevents the app from crashing.
 */
function safeCallback(callback) {
  if (typeof callback !== 'function') {
    return (req, res) => {
      res.status(501).json({ error: 'This functionality is not implemented yet.' });
    };
  }
  return callback;
}

/* -------------------------------------------------------------------------
   Static Routes - Must be declared before dynamic routes
-------------------------------------------------------------------------*/

/**
 * GET /api/pdf/all
 * Retrieve metadata for all active PDFs.
 */
router.get('/all', authenticateToken, safeCallback(pdfController.getAllPdfs));

/**
 * GET /api/pdf/search
 * Search PDFs by title or description.
 */
router.get('/search', authenticateToken, safeCallback(pdfController.searchPdfs));

/**
 * GET /api/pdf/download/:id
 * Download a specified PDF by id.
 */
router.get('/download/:id', authenticateToken, safeCallback(pdfController.downloadPdf));

/**
 * POST /api/pdf/upload
 * Upload a new PDF (and an optional cover photo) using Multer middleware.
 */
router.post(
  '/upload',
  authenticateToken,
  safeCallback(pdfController.uploadFile),
  safeCallback(pdfController.uploadPdf)
);

/**
 * POST /api/pdf/history
 * Record download history for a PDF.
 */
router.post('/history', authenticateToken, safeCallback(pdfController.recordHistory));

/* -------------------------------------------------------------------------
   Bookmark Routes - Place these before other dynamic routes to avoid conflicts
-------------------------------------------------------------------------*/

/**
 * POST /api/pdf/:id/bookmark
 * Add a bookmark for a specified PDF.
 */
router.post('/:id/bookmark', authenticateToken, safeCallback(pdfController.bookmarkPdf));

/**
 * DELETE /api/pdf/:id/bookmark
 * Remove a bookmark for a specified PDF.
 */
router.delete('/:id/bookmark', authenticateToken, safeCallback(pdfController.removeBookmark));

/**
 * GET /api/pdf/bookmarks
 * Retrieve all bookmarks for the authenticated user.
 */
router.get('/bookmarks', authenticateToken, safeCallback(pdfController.getBookmarks));

/* -------------------------------------------------------------------------
   Dynamic Routes - Declare after static routes to avoid conflicts
-------------------------------------------------------------------------*/

/**
 * PUT /api/pdf/:id
 * Update metadata (title & description) for a specified PDF.
 */
router.put('/:id', authenticateToken, safeCallback(pdfController.updatePdf));

/**
 * DELETE /api/pdf/:id
 * Delete a specified PDF.
 */
router.delete('/:id', authenticateToken, safeCallback(pdfController.deletePdf));

/**
 * GET /api/pdf/:id/comments
 * Retrieve all comments associated with a given PDF.
 */
router.get('/:id/comments', authenticateToken, safeCallback(pdfController.getComments));

/**
 * POST /api/pdf/:id/rate
 * Submit a rating for a specified PDF.
 */
router.post('/:id/rate', authenticateToken, safeCallback(pdfController.ratePdf));

/**
 * POST /api/pdf/:id/comment
 * Add a comment for a specified PDF.
 */
router.post('/:id/comment', authenticateToken, safeCallback(pdfController.commentOnPdf));

/**
 * GET /api/pdf/:id/cover
 * Fetch the cover photo for a specified PDF.
 */
router.get('/:id/cover', authenticateToken, safeCallback(pdfController.getCoverPhoto));

/**
 * GET /api/pdf/:id/uploader
 * Retrieve the uploader's profile picture and username for a specified PDF.
 */
router.get('/:id/uploader', authenticateToken, safeCallback(pdfController.getUploaderInfo));

/**
 * GET /api/pdf/:id
 * Retrieve full details for a specified PDF.
 */
router.get('/:id', authenticateToken, safeCallback(pdfController.getPdfDetails));

module.exports = router;
