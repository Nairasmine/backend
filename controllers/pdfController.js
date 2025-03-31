const { db, helpers } = require('../config/db');

// Use memory storage so that files are kept in memory.
const multer = require('multer');
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

  async uploadPdf(req, res) {
    const { title, description, visibility, tags } = req.body;
    // Retrieve userId from the authenticated token (provided by middleware)
    const userId = req.user && req.user.id;
    
    // Validation: ensure that a PDF file was provided.
    if (!req.files || !req.files.pdf || req.files.pdf.length === 0) {
      return res.status(400).json({ message: 'No PDF file uploaded.' });
    }
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: user not found.' });
    }
    
    // Extract PDF file data and, if available, the cover photo.
    const pdfFile = req.files.pdf[0];
    const coverPhoto = (req.files.cover_photo && req.files.cover_photo.length > 0)
      ? req.files.cover_photo[0].buffer
      : null;
    
    try {
      await db.query(
        `INSERT INTO pdfs 
          (title, description, user_id, file_name, file_size, mime_type, cover_photo, pdf_data, visibility, tags, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          title,
          description,
          userId,
          pdfFile.originalname,
          pdfFile.size,
          pdfFile.mimetype,
          coverPhoto,
          pdfFile.buffer,
          visibility,
          JSON.stringify(tags)  // Ensure tags are stored as a JSON string
        ]
      );
      res.status(201).json({ message: 'PDF uploaded successfully.' });
    } catch (error) {
      console.error('Error uploading PDF:', error);
      res.status(500).json({ message: 'Error uploading PDF.' });
    }
  },

  // Updated: Get all PDFs metadata with the uploader's username and Base64 profile picture.
  async getAllPdfs(req, res) {
    try {
      const [pdfs] = await db.query(
        `SELECT p.id, p.title, p.description, p.user_id, p.file_name, p.file_size, p.mime_type, p.created_at,
                u.username AS user,
                u.profile_pic AS profilePic
         FROM pdfs p
         LEFT JOIN users u ON p.user_id = u.id
         WHERE p.status = 'active'
         ORDER BY p.created_at DESC`
      );
      // Convert the binary profilePic to Base64 for each PDF (if exists).
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

  // Update PDF title and description.
  async updatePdf(req, res) {
    const { id } = req.params;
    const { title, description } = req.body;
    try {
      await db.query(
        `UPDATE pdfs SET title = ?, description = ? WHERE id = ?`,
        [title, description, id]
      );
      res.status(200).json({ message: 'PDF updated successfully.' });
    } catch (error) {
      console.error('Error updating PDF:', error);
      res.status(500).json({ message: 'Error updating PDF.' });
    }
  },

  // Delete a PDF by its ID.
  async deletePdf(req, res) {
    const { id } = req.params;
    try {
      await db.query(`DELETE FROM pdfs WHERE id = ?`, [id]);
      res.status(200).json({ message: 'PDF deleted successfully.' });
    } catch (error) {
      console.error('Error deleting PDF:', error);
      res.status(500).json({ message: 'Error deleting PDF.' });
    }
  },

  // Updated: Get PDF details including cover photo data, rating, uploader's username, and Base64 profile picture.
  async getPdfDetails(req, res) {
    const { id } = req.params;
    try {
      const [pdfs] = await db.query(
        `SELECT p.id, p.title, p.description, p.user_id, p.file_name, p.file_size, p.mime_type, p.cover_photo, 
                p.created_at,
                u.username AS user,
                u.profile_pic AS profilePic,
                COALESCE(AVG(pr.rating), 0) AS average_rating,
                COUNT(pr.rating) AS rating_count
         FROM pdfs p
         LEFT JOIN pdf_ratings pr ON p.id = pr.pdf_id
         LEFT JOIN users u ON p.user_id = u.id
         WHERE p.id = ?
         GROUP BY p.id, u.username, u.profile_pic`,
        [id]
      );
      if (pdfs.length === 0) {
        return res.status(404).json({ message: 'PDF not found.' });
      }
      
      const pdf = pdfs[0];
      // Convert profile_pic blob to Base64.
      if (pdf.profilePic) {
        pdf.profilePicBase64 = pdf.profilePic.toString('base64');
      } else {
        pdf.profilePicBase64 = null;
      }
      delete pdf.profilePic;
      
      // Calculate rating percentage (useful for star-progress UI).
      pdf.rating_percentage = (pdf.average_rating / 5) * 100;
      res.status(200).json(pdf);
    } catch (error) {
      console.error('Error retrieving PDF details:', error);
      res.status(500).json({ message: 'Error retrieving PDF details.' });
    }
  },

  // Fetch only the cover photo of a PDF.
  async getCoverPhoto(req, res) {
    const { id } = req.params;
    try {
      const [pdfs] = await db.query(`SELECT cover_photo FROM pdfs WHERE id = ?`, [id]);
      if (pdfs.length === 0 || !pdfs[0].cover_photo) {
        return res.status(404).json({ message: 'Cover photo not found.' });
      }
      const photoData = pdfs[0].cover_photo;
      const coverBuffer = Buffer.isBuffer(photoData) ? photoData : Buffer.from(photoData);
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

  // Fetch only the comments for a PDF.
  async getComments(req, res) {
    const { id } = req.params;
    try {
      const [comments] = await db.query(
        `SELECT c.id, c.comment, c.created_at, c.user_id, u.username AS user_name
         FROM comments c 
         LEFT JOIN users u ON c.user_id = u.id 
         WHERE c.pdf_id = ? 
         ORDER BY c.created_at ASC`,
        [id]
      );
      res.status(200).json(comments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      res.status(500).json({ message: 'Error fetching comments.' });
    }
  },

  // Add a comment for a PDF.
  async commentOnPdf(req, res) {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: user not found.' });
    }
    try {
      await db.query(
        `INSERT INTO comments (pdf_id, user_id, comment, created_at)
         VALUES (?, ?, ?, NOW())`,
        [id, userId, comment]
      );
      res.status(201).json({ message: 'Comment added successfully.' });
    } catch (error) {
      console.error('Error adding comment:', error);
      res.status(500).json({ message: 'Error adding comment.' });
    }
  },

  // Search PDFs by title or description.
  async searchPdfs(req, res) {
    const { q } = req.query;
    try {
      const [rows] = await db.query(
        `SELECT p.*, u.username AS user, u.profile_pic AS profilePic 
         FROM pdfs p 
         LEFT JOIN users u ON p.user_id = u.id 
         WHERE p.title LIKE ? OR p.description LIKE ?`,
        [`%${q}%`, `%${q}%`]
      );
      // Convert raw profile_pic data to Base64.
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

  // Record download history for a PDF. Expects req.body.pdfId.
  async recordHistory(req, res) {
    const { pdfId } = req.body;
    const userId = req.user?.id;
    if (!pdfId) {
      return res.status(400).json({ message: 'PDF ID is required.' });
    }
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: user not found.' });
    }
    try {
      console.log(`Recording download for PDF ID ${pdfId} by user ${userId}.`);
      await helpers.recordDownload(pdfId, userId, req);
      return res.status(200).json({ message: 'Download history recorded successfully.' });
    } catch (error) {
      console.error('Error recording download history:', error);
      return res.status(500).json({ message: 'Error recording download history.' });
    }
  },

  // Download a PDF file and record the download history.
  async downloadPdf(req, res) {
    const { id } = req.params;
    const userId = req.user && req.user.id;
    try {
      const [pdfs] = await db.query(
        `SELECT file_name, mime_type, pdf_data FROM pdfs WHERE id = ?`,
        [id]
      );
      if (pdfs.length === 0) {
        return res.status(404).json({ message: 'PDF not found.' });
      }
      const pdf = pdfs[0];

      res.setHeader('Content-Disposition', `attachment; filename="${pdf.file_name}"`);
      res.setHeader('Content-Type', pdf.mime_type);
      res.send(pdf.pdf_data);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      res.status(500).json({ message: 'Error downloading PDF.' });
    }
  },

  // Rate a PDF. Expects req.body.rating and the logged-in user's id.
  async ratePdf(req, res) {
    const { id } = req.params; // PDF id
    const { rating } = req.body;
    const currentUserId = req.user && req.user.id;
  
    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized: user not found.' });
    }
  
    try {
      // Insert or update the rating for the PDF.
      await db.query(
        `INSERT INTO pdf_ratings (pdf_id, user_id, rating, created_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE rating = ?, created_at = NOW()`,
        [id, currentUserId, rating, rating]
      );
  
      // Retrieve the uploader of this PDF.
      const [pdfRows] = await db.query(
        `SELECT user_id FROM pdfs WHERE id = ?`,
        [id]
      );
  
      if (pdfRows.length > 0) {
        const uploaderId = pdfRows[0].user_id;
  
        // Recalculate the overall rating for the uploader.
        const [ratingRows] = await db.query(
          `SELECT AVG(pr.rating) AS overallRating
           FROM pdf_ratings pr
           JOIN pdfs p ON p.id = pr.pdf_id
           WHERE p.user_id = ?`,
          [uploaderId]
        );
  
        const overallRating = ratingRows[0].overallRating;
  
        // Update the overall_rating field in the users table.
        await db.query(
          `UPDATE users SET overall_rating = ? WHERE id = ?`,
          [overallRating, uploaderId]
        );
      }
  
      res.status(200).json({ message: 'Rating submitted successfully.' });
    } catch (error) {
      console.error('Error submitting rating:', error);
      res.status(500).json({ message: 'Error submitting rating.' });
    }
  }  
};

module.exports = pdfController;
