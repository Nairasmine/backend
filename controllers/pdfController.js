const pdfModel = require('../models/pdfModel');
const multer = require('multer');
const axios = require('axios'); // Make sure to require axios

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
  // Middleware: Process multiple file fields
  uploadFile: upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'cover_photo', maxCount: 1 }
  ]),

  // Upload a new PDF
  async uploadPdf(req, res) {
    const { title, description, visibility, tags, isPaid, price } = req.body;
    const userId = req.user && req.user.id;
    
    if (!req.files || !req.files.pdf || req.files.pdf.length === 0) {
      return res.status(400).json({ message: 'No PDF file uploaded.' });
    }
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: user not found.' });
    }
    
    // Validate price for paid PDFs
    const paidStatus = isPaid === 'true';
    const priceValue = parseFloat(price) || 0.00;
    if (paidStatus && priceValue <= 0) {
      return res.status(400).json({ message: 'Price must be greater than 0 for paid PDFs.' });
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
        tags,
        isPaid: paidStatus,
        price: priceValue
      });
      res.status(201).json({ message: 'PDF uploaded successfully.' });
    } catch (error) {
      console.error('Error uploading PDF:', error);
      res.status(500).json({ message: 'Error uploading PDF.' });
    }
  },

  // Get all PDFs with payment info
  async getAllPdfs(req, res) {
    try {
      const pdfs = await pdfModel.getAllPdfs();
      
      // Process each PDF to include payment information correctly
      const pdfsWithProfile = pdfs.map(pdf => {
        // Convert profilePic to base64 if exists
        if (pdf.profilePic) {
          pdf.profilePicBase64 = pdf.profilePic.toString('base64');
        } else {
          pdf.profilePicBase64 = null;
        }
        delete pdf.profilePic;
        
        // Ensure isPaid is a string and price is a number
        pdf.isPaid = pdf.is_paid ? "true" : "false";
        pdf.price = parseFloat(pdf.price) || 0.00;
        
        return pdf;
      });
      
      res.status(200).json(pdfsWithProfile);
    } catch (error) {
      console.error('Error fetching PDFs:', error);
      res.status(500).json({ message: 'Error fetching PDFs.' });
    }
  },

  // Update PDF metadata
  async updatePdf(req, res) {
    const { id } = req.params;
    const { title, description, isPaid, price } = req.body;

    // Validate price for paid PDFs
    const paidStatus = isPaid === 'true';
    const priceValue = parseFloat(price) || 0.00;
    if (paidStatus && priceValue <= 0) {
      return res.status(400).json({ message: 'Price must be greater than 0 for paid PDFs.' });
    }

    try {
      await pdfModel.updatePdf(id, { 
        title, 
        description, 
        isPaid: paidStatus, 
        price: priceValue 
      });
      res.status(200).json({ message: 'PDF updated successfully.' });
    } catch (error) {
      console.error('Error updating PDF:', error);
      res.status(500).json({ message: 'Error updating PDF.' });
    }
  },

  // Delete a PDF
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

  // Get PDF details with payment info
  async getPdfDetails(req, res) {
    const { id } = req.params;
    try {
      const pdfs = await pdfModel.getPdfDetails(id);
      if (!pdfs || pdfs.length === 0) {
        return res.status(404).json({ message: 'PDF not found.' });
      }
      
      const pdf = pdfs[0];
      
      // Convert profilePic to base64 if exists
      if (pdf.profilePic) {
        pdf.profilePicBase64 = pdf.profilePic.toString('base64');
      } else {
        pdf.profilePicBase64 = null;
      }
      delete pdf.profilePic;
      
      // Add payment information
      pdf.isPaid = pdf.is_paid ? "true" : "false";
      pdf.price = parseFloat(pdf.price) || 0.00;
      pdf.rating_percentage = (pdf.average_rating / 5) * 100;
      
      res.status(200).json(pdf);
    } catch (error) {
      console.error('Error retrieving PDF details:', error);
      res.status(500).json({ message: 'Error retrieving PDF details.' });
    }
  },

  // Get cover photo
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

  // Get comments
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

  // Add comment
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

  // Search PDFs with payment info
  async searchPdfs(req, res) {
    const { q, isPaid, visibility, sortBy, limit, offset } = req.query;
    try {
      const rows = await pdfModel.searchPdfs({
        query: q,
        isPaid: isPaid === 'true',
        visibility,
        sortBy,
        limit: parseInt(limit) || 10,
        offset: parseInt(offset) || 0
      });
      
      // Process each PDF to include payment information correctly
      const rowsWithProfile = rows.map(row => {
        // Convert profilePic to base64 if exists
        if (row.profilePic) {
          row.profilePicBase64 = row.profilePic.toString('base64');
        } else {
          row.profilePicBase64 = null;
        }
        delete row.profilePic;
        
        // Ensure isPaid is a string and price is a number
        row.isPaid = row.is_paid ? "true" : "false";
        row.price = parseFloat(row.price) || 0.00;
        
        return row;
      });
      
      res.status(200).json(rowsWithProfile);
    } catch (error) {
      console.error('Error searching PDFs:', error);
      res.status(500).json({ message: 'Error searching PDFs.' });
    }
  },

  // Download PDF with payment verification
  async downloadPdf(req, res) {
    const { id } = req.params;
    const userId = req.user && req.user.id;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: user not found.' });
    }
    
    try {
      const results = await pdfModel.downloadPdf(id);
      if (!results || results.length === 0) {
        return res.status(404).json({ message: 'PDF not found.' });
      }
      
      const pdf = results[0];
      
      // Check if PDF is paid and user has permission
      if (pdf.is_paid) {
        // Verify if user has purchased this PDF
        const hasPurchased = await pdfModel.checkPurchase(userId, id);
        if (!hasPurchased) {
          return res.status(403).json({ 
            message: 'This is a paid PDF. Please purchase to download.',
            price: parseFloat(pdf.price) || 0.00
          });
        }
      }
      
      res.setHeader('Content-Disposition', `attachment; filename="${pdf.file_name}"`);
      res.setHeader('Content-Type', pdf.mime_type);
      res.send(pdf.pdf_data);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      res.status(500).json({ message: 'Error downloading PDF.' });
    }
  },

  // Rate PDF
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

  // Record download history
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
      await pdfModel.recordHistory(pdfId, userId, req);
      res.status(200).json({ message: 'Download history recorded successfully.' });
    } catch (error) {
      console.error('Error recording download history:', error);
      res.status(500).json({ message: 'Error recording download history.' });
    }
  },

  // -------------------- Bookmark Endpoints --------------------

  // Add bookmark
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

  // Remove bookmark
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

  // Get bookmarks with payment info
  async getBookmarks(req, res) {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: user not found.' });
    }
    try {
      const bookmarks = await pdfModel.getBookmarks(userId);
      
      // Format payment info
      const formattedBookmarks = bookmarks.map(bookmark => {
        return {
          ...bookmark,
          isPaid: bookmark.is_paid ? "true" : "false",
          price: parseFloat(bookmark.price) || 0.00
        };
      });
      
      res.status(200).json(formattedBookmarks);
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
      res.status(500).json({ message: 'Error fetching bookmarks.' });
    }
  },

  // Get purchased PDFs with payment info
  async getPurchasedPdfs(req, res) {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: user not found.' });
    }
    try {
      const purchasedPdfs = await pdfModel.getPurchasedPdfs(userId);
      
      // Process profile pictures and payment info
      const pdfsWithProfile = purchasedPdfs.map(pdf => {
        if (pdf.profilePic) {
          pdf.profilePicBase64 = pdf.profilePic.toString('base64');
        } else {
          pdf.profilePicBase64 = null;
        }
        delete pdf.profilePic;
        
        // Ensure isPaid is a string and price is a number
        pdf.isPaid = pdf.is_paid ? "true" : "false";
        pdf.price = parseFloat(pdf.price) || 0.00;
        
        return pdf;
      });
      
      res.status(200).json(pdfsWithProfile);
    } catch (error) {
      console.error('Error fetching purchased PDFs:', error);
      res.status(500).json({ message: 'Error fetching purchased PDFs.' });
    }
  },

  // Handle PDF purchase
  async purchasePdf(req, res) {
    const { pdfId } = req.params;
    const userId = req.user && req.user.id;
  
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User not logged in' });
    }
  
    try {
      // Verify if the PDF exists and is a paid one
      const pdf = await pdfModel.getPdfDetails(pdfId);
      if (!pdf || pdf.length === 0) {
        return res.status(404).json({ message: 'PDF not found' });
      }
  
      if (pdf[0].is_paid !== 1) {
        return res.status(400).json({ message: 'This PDF is free and does not require payment' });
      }
  
      // Check if the user already purchased the PDF
      const hasPurchased = await pdfModel.checkPurchase(userId, pdfId);
      if (hasPurchased) {
        return res.status(400).json({ message: 'You have already purchased this PDF' });
      }
  
      // Prepare payment data
      const paymentData = {
        email: req.user.email,
        amount: Math.round(parseFloat(pdf[0].price) * 100), // Convert to kobo
        metadata: {
          userId,
          pdfId,
          pdfTitle: pdf[0].title,
        },
        callback_url: `${process.env.FRONTEND_URL}/payment-callback`,
      };
  
      // Call payment gateway (e.g., Paystack API)
      const paymentResponse = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        paymentData,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
  
      return res.json({
        paymentUrl: paymentResponse.data.data.authorization_url,
        reference: paymentResponse.data.data.reference,
      });
    } catch (error) {
      console.error('Purchase error:', error);
      return res.status(500).json({ message: 'An error occurred during payment initialization' });
    }
  },  

  verifyPayment: async (reference) => {
    try {
      const response = await fetch(`${API_BASE_URL}/pdf/verify-payment`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reference }),
      });
  
      if (!response.ok) {
        throw new Error(`Payment verification failed with status ${response.status}`);
      }
  
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error verifying payment:', error.message);
      throw error; // Re-throw error for proper handling in the UI
    }
  },  

  // Check purchase status
  async checkPurchase(req, res) {
    const { pdfId } = req.params;
    const userId = req.user?.id;
  
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User not logged in' });
    }
  
    try {
      const hasPurchased = await pdfModel.checkPurchase(userId, pdfId);
      return res.json({ hasPurchased });
    } catch (error) {
      console.error('Check purchase error:', error.message);
      return res.status(500).json({ message: 'An error occurred while checking the purchase status' });
    }
  }
  
};

module.exports = pdfController;