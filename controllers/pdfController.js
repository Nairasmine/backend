const pdfModel = require('../models/pdfModel');
const multer = require('multer');

// Use memory storage so that files are kept in memory.
const storage = multer.memoryStorage();

// File filter: only allow files for the "pdf" and "cover_photo" fields.
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'pdf' || file.fieldname === 'cover_photo') {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  }
};

const upload = multer({ storage, fileFilter });

const pdfController = {
  // Middleware: Process multiple file fields: one for "pdf" and one optional for "cover_photo"
  uploadFile: upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'cover_photo', maxCount: 1 }
  ]),

  // Upload a new PDF.
  async uploadPdf(req, res) {
    const { title, description, visibility, tags } = req.body;
    const userId = req.user && req.user.id;
    if (!req.files || !req.files.pdf || req.files.pdf.length === 0) {
      return res.status(400).json({ message: 'No PDF file uploaded.' });
    }
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: user not found.' });
    }
    const pdfFile = req.files.pdf[0];
    const coverPhoto = (req.files.cover_photo && req.files.cover_photo.length > 0)
      ? req.files.cover_photo[0].buffer
      : null;
    try {
      await pdfModel.createPdf({
        title,
        description,
        userId,
        file_name: pdfFile.originalname,
        file_size: pdfFile.size,
        mime_type: pdfFile.mimetype,
        cover_photo: coverPhoto,
        pdf_data: pdfFile.buffer,
        visibility,
        tags
      });
      res.status(201).json({ message: 'PDF uploaded successfully.' });
    } catch (error) {
      console.error('Error uploading PDF:', error);
      res.status(500).json({ message: 'Error uploading PDF.' });
    }
  },

  // Get all PDFs.
  async getAllPdfs(req, res) {
    try {
      const pdfs = await pdfModel.getAllPdfs();
      const pdfsWithProfile = pdfs.map(pdf => {
        if (pdf.profilePic) {
          pdf.profilePicBase64 = pdf.profilePic.toString('base64');
        } else {
          pdf.profilePicBase64 = null;
        }
        delete pdf.profilePic;
        return pdf;
      });
      res.status(200).json(pdfsWithProfile);
    } catch (error) {
      console.error('Error fetching PDFs:', error);
      res.status(500).json({ message: 'Error fetching PDFs.' });
    }
  },

  // Update PDF metadata.
  async updatePdf(req, res) {
    const { id } = req.params;
    const { title, description } = req.body;
    try {
      await pdfModel.updatePdf(id, title, description);
      res.status(200).json({ message: 'PDF updated successfully.' });
    } catch (error) {
      console.error('Error updating PDF:', error);
      res.status(500).json({ message: 'Error updating PDF.' });
    }
  },

  // Delete a PDF.
  async deletePdf(req, res) {
    const { id } = req.params;
    try {
      await pdfModel.deletePdf(id);
      res.status(200).json({ message: 'PDF deleted successfully.' });
    } catch (error) {
      console.error('Error deleting PDF:', error);
      res.status(500).json({ message: 'Error deleting PDF.' });
    }
  },

  // Get detailed information for a PDF.
  async getPdfDetails(req, res) {
    const { id } = req.params;
    try {
      const pdfs = await pdfModel.getPdfDetails(id);
      if (!pdfs || pdfs.length === 0) {
        return res.status(404).json({ message: 'PDF not found.' });
      }
      const pdf = pdfs[0];
      if (pdf.profilePic) {
        pdf.profilePicBase64 = pdf.profilePic.toString('base64');
      } else {
        pdf.profilePicBase64 = null;
      }
      delete pdf.profilePic;
      pdf.rating_percentage = (pdf.average_rating / 5) * 100;
      res.status(200).json(pdf);
    } catch (error) {
      console.error('Error retrieving PDF details:', error);
      res.status(500).json({ message: 'Error retrieving PDF details.' });
    }
  },

  // Return just the cover photo.
  async getCoverPhoto(req, res) {
    const { id } = req.params;
    try {
      const results = await pdfModel.getCoverPhoto(id);
      if (!results || results.length === 0 || !results[0].cover_photo) {
        return res.status(404).json({ message: 'Cover photo not found.' });
      }
      const photoData = results[0].cover_photo;
      const coverBuffer = Buffer.isBuffer(photoData)
        ? photoData
        : Buffer.from(photoData);
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': coverBuffer.length,
      });
      res.end(coverBuffer);
    } catch (error) {
      console.error('Error retrieving cover photo:', error);
      res.status(500).json({ message: 'Error retrieving cover photo.' });
    }
  },

  // Get comments for a PDF.
  async getComments(req, res) {
    const { id } = req.params;
    try {
      const comments = await pdfModel.getComments(id);
      res.status(200).json(comments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      res.status(500).json({ message: 'Error fetching comments.' });
    }
  },

  // Add a comment to a PDF.
  async commentOnPdf(req, res) {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: user not found.' });
    }
    try {
      await pdfModel.addComment(id, userId, comment);
      res.status(201).json({ message: 'Comment added successfully.' });
    } catch (error) {
      console.error('Error adding comment:', error);
      res.status(500).json({ message: 'Error adding comment.' });
    }
  },

  // Search PDFs.
  async searchPdfs(req, res) {
    const { q } = req.query;
    try {
      const rows = await pdfModel.searchPdfs(q);
      const rowsWithProfile = rows.map(row => {
        if (row.profilePic) {
          row.profilePicBase64 = row.profilePic.toString('base64');
        } else {
          row.profilePicBase64 = null;
        }
        delete row.profilePic;
        return row;
      });
      res.status(200).json(rowsWithProfile);
    } catch (error) {
      console.error('Error searching PDFs:', error);
      res.status(500).json({ message: 'Error searching PDFs.' });
    }
  },

  // Record download history.
  async recordHistory(req, res) {
    const { pdfId } = req.body;
    const userId = req.user && req.user.id;
    if (!pdfId) {
      return res.status(400).json({ message: 'PDF ID is required.' });
    }
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: user not found.' });
    }
    try {
      console.log(`Recording download for PDF ID ${pdfId} by user ${userId}.`);
      await pdfModel.recordHistory(pdfId, userId, req);
      res.status(200).json({ message: 'Download history recorded successfully.' });
    } catch (error) {
      console.error('Error recording download history:', error);
      res.status(500).json({ message: 'Error recording download history.' });
    }
  },

  // Download a PDF.
  async downloadPdf(req, res) {
    const { id } = req.params;
    try {
      const results = await pdfModel.downloadPdf(id);
      if (!results || results.length === 0) {
        return res.status(404).json({ message: 'PDF not found.' });
      }
      const pdf = results[0];
      res.setHeader('Content-Disposition', `attachment; filename="${pdf.file_name}"`);
      res.setHeader('Content-Type', pdf.mime_type);
      res.send(pdf.pdf_data);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      res.status(500).json({ message: 'Error downloading PDF.' });
    }
  },

  // Rate a PDF.
  async ratePdf(req, res) {
    const { id } = req.params;
    const { rating } = req.body;
    const currentUserId = req.user && req.user.id;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized: user not found.' });
    }
    try {
      await pdfModel.ratePdf(id, currentUserId, rating);
      res.status(200).json({ message: 'Rating submitted successfully.' });
    } catch (error) {
      console.error('Error submitting rating:', error);
      res.status(500).json({ message: 'Error submitting rating.' });
    }
  },

  // -------------------- Bookmark Endpoints --------------------

  // Add a bookmark.
  async bookmarkPdf(req, res) {
    const { id } = req.params;
    const userId = req.user && req.user.id;
    if (!userId || !id) {
      return res.status(400).json({ message: 'PDF ID and authenticated user required.' });
    }
    try {
      const result = await pdfModel.bookmarkPdf(userId, id);
      if (result.affectedRows === 0) {
        return res.status(200).json({ message: 'Bookmark already exists.' });
      }
      res.status(201).json({ message: 'Bookmark added successfully.' });
    } catch (error) {
      console.error('Error adding bookmark:', error);
      res.status(500).json({ message: 'Error adding bookmark.' });
    }
  },

  // Remove a bookmark.
  async removeBookmark(req, res) {
    const { id } = req.params;
    const userId = req.user && req.user.id;
    if (!userId || !id) {
      return res.status(400).json({ message: 'PDF ID and authenticated user required.' });
    }
    try {
      const result = await pdfModel.removeBookmark(userId, id);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Bookmark not found.' });
      }
      res.status(200).json({ message: 'Bookmark removed successfully.' });
    } catch (error) {
      console.error('Error removing bookmark:', error);
      res.status(500).json({ message: 'Error removing bookmark.' });
    }
  },

  // Get all bookmarks for the current user.
  async getBookmarks(req, res) {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: user not found.' });
    }
    try {
      const bookmarks = await pdfModel.getBookmarks(userId);
      res.status(200).json(bookmarks);
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
      res.status(500).json({ message: 'Error fetching bookmarks.' });
    }
  }
};

module.exports = pdfController;
