const express = require('express');
const pdfController = require('../controllers/pdfController');
const authenticateToken = require('../middleware/authenticateToken');

const router = express.Router();

/* -------------------------------------------------------------------------
   Static Routes - Must be declared before dynamic routes
-------------------------------------------------------------------------*/

/**
 * GET /api/pdf/all
 * Retrieve metadata for all active PDFs.
 */
router.get('/all', authenticateToken, pdfController.getAllPdfs);

/**
 * GET /api/pdf/search
 * Search PDFs by title or description.
 */
router.get('/search', authenticateToken, pdfController.searchPdfs);

/**
 * GET /api/pdf/download/:id
 * Download a specified PDF by id.
 */
router.get('/download/:id', authenticateToken, pdfController.downloadPdf);

/**
 * POST /api/pdf/upload
 * Upload a new PDF (and an optional cover photo) using Multer middleware.
 */
router.post(
  '/upload',
  authenticateToken,
  pdfController.uploadFile,
  pdfController.uploadPdf
);

/**
 * POST /api/pdf/history
 * Record download history for a PDF.
 */
router.post('/history', authenticateToken, pdfController.recordHistory);

/* -------------------------------------------------------------------------
   Dynamic Routes - Declare after static routes to avoid conflicts
-------------------------------------------------------------------------*/

/**
 * PUT /api/pdf/:id
 * Update metadata (title & description) for a specified PDF.
 */
router.put('/:id', authenticateToken, pdfController.updatePdf);

/**
 * DELETE /api/pdf/:id
 * Delete a specified PDF.
 */
router.delete('/:id', authenticateToken, pdfController.deletePdf);

/**
 * GET /api/pdf/:id/comments
 * Retrieve all comments associated with a given PDF.
 */
router.get('/:id/comments', authenticateToken, pdfController.getComments);

/**
 * POST /api/pdf/:id/rate
 * Submit a rating for a specified PDF.
 */
router.post('/:id/rate', authenticateToken, pdfController.ratePdf);

/**
 * POST /api/pdf/:id/comment
 * Add a comment for a specified PDF.
 */
router.post('/:id/comment', authenticateToken, pdfController.commentOnPdf);

/**
 * GET /api/pdf/:id/cover
 * Fetch the cover photo for a specified PDF.
 */
router.get('/:id/cover', authenticateToken, pdfController.getCoverPhoto);

/**
 * GET /api/pdf/:id/uploader
 * Retrieve the uploader's profile picture and username for a specified PDF.
 */
router.get('/:id/uploader', authenticateToken, pdfController.getUploaderInfo);

/**
 * GET /api/pdf/:id
 * Retrieve full details for a specified PDF.
 */
router.get('/:id', authenticateToken, pdfController.getPdfDetails);

module.exports = router;
