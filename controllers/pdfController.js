// controllers/pdfController.js
require('dotenv').config();
const pdfModel = require('../models/pdfModel');
const { helpers } = require('../config/db');  // Import helpers to use recordDownload
const multer = require('multer');
const axios = require('axios');
const zlib = require('zlib');
const crypto = require('crypto');

// ----------------------------- Encryption Config -----------------------------
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; 
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function encryptBuffer(buffer) {
  if (!ENCRYPTION_KEY) return buffer;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

function decryptBuffer(buffer) {
  if (!ENCRYPTION_KEY) return buffer;
  const iv = buffer.slice(0, IV_LENGTH);
  const encryptedText = buffer.slice(IV_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
  return Buffer.concat([decipher.update(encryptedText), decipher.final()]);
}

// ----------------------------- Multer Configuration -----------------------------
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'pdf') {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only PDFs are allowed in pdf field'));
    }
  } else if (file.fieldname === 'cover_photo') {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only JPEG/PNG images are allowed in cover_photo field'));
    }
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  }
};
const upload = multer({ storage, fileFilter });

// ----------------------------- Helper: Compute Additional Charge -----------------------------
function computeAdditionalCharge(price) {
  let charge = 0;
  if (price >= 100 && price <= 500) {
    charge = 50;
  } else if (price > 500 && price <= 2000) {
    charge = 100;
  } else if (price > 2000 && price <= 5000) {
    charge = 200;
  } else if (price > 5000 && price <= 15000) {
    charge = 300;
  } else if (price > 15000 && price <= 30000) {
    charge = 500;
  } else if (price > 30000) {
    charge = 500 + Math.ceil((price - 30000) / 1000) * 50;
  }
  return charge;
}

// ----------------------------- Controller Methods -----------------------------
const pdfController = {
  // Middleware: Process multiple file uploads.
  uploadFile: upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'cover_photo', maxCount: 1 }
  ]),

  // Upload a new PDF: compress and encrypt file data.
  async uploadPdf(req, res) {
    const title = (req.body.title || '').trim();
    const description = (req.body.description || '').trim();
    const visibility = (req.body.visibility || 'public').trim();
    const tags = (req.body.tags || '').trim();
    const { isPaid, price } = req.body;
    const userId = req.user && req.user.id;
    if (!req.files || !req.files.pdf || req.files.pdf.length === 0) {
      return res.status(400).json({ message: 'No PDF file uploaded.' });
    }
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: user not found.' });
    }
    const paidStatus = isPaid === 'true';
    const priceValue = parseFloat(price) || 0.00;
    if (paidStatus && priceValue <= 0) {
      return res.status(400).json({ message: 'Price must be greater than 0 for paid PDFs.' });
    }
    const pdfFile = req.files.pdf[0];
    const compressedPdfData = zlib.gzipSync(pdfFile.buffer);
    const encryptedPdfData = encryptBuffer(compressedPdfData);
    let encryptedCoverPhoto = null;
    if (req.files.cover_photo && req.files.cover_photo.length > 0) {
      const coverPhotoBuffer = req.files.cover_photo[0].buffer;
      const compressedCoverPhoto = zlib.gzipSync(coverPhotoBuffer);
      encryptedCoverPhoto = encryptBuffer(compressedCoverPhoto);
    }
    let extraCharge = 0;
    let finalPrice = priceValue;
    if (paidStatus) {
      extraCharge = computeAdditionalCharge(priceValue);
      finalPrice = priceValue + extraCharge;
    }
    try {
      await pdfModel.createPdf({
        title,
        description,
        userId,
        file_name: pdfFile.originalname,
        file_size: pdfFile.size,
        mime_type: pdfFile.mimetype,
        cover_photo: encryptedCoverPhoto,
        pdf_data: encryptedPdfData,
        visibility,
        tags,
        isPaid: paidStatus,
        price: finalPrice
      });
      res.status(201).json({
        message: 'PDF uploaded successfully.',
        originalPrice: priceValue,
        extraCharge,
        finalPrice
      });
    } catch (error) {
      console.error('Error uploading PDF:', error);
      res.status(500).json({ message: 'Error uploading PDF.' });
    }
  },

  // Retrieve metadata for all active PDFs.
  async getAllPdfs(req, res) {
    try {
      const pdfs = await pdfModel.getAllPdfs();
      const pdfsWithProfile = pdfs.map(pdf => {
        if (pdf.profilePic) {
          try {
            const decryptedPic = decryptBuffer(pdf.profilePic);
            const decompressedPic = zlib.gunzipSync(decryptedPic);
            pdf.profilePicBase64 = decompressedPic.toString('base64');
          } catch (err) {
            pdf.profilePicBase64 = pdf.profilePic.toString('base64');
          }
        } else {
          pdf.profilePicBase64 = null;
        }
        delete pdf.profilePic;
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

  // Update a PDF.
  async updatePdf(req, res) {
    const { id } = req.params;
    const title = (req.body.title || '').trim();
    const description = (req.body.description || '').trim();
    const { isPaid, price } = req.body;
    const paidStatus = isPaid === 'true';
    const priceValue = parseFloat(price) || 0.00;
    if (paidStatus && priceValue <= 0) {
      return res.status(400).json({ message: 'Price must be greater than 0 for paid PDFs.' });
    }
    let extraCharge = 0;
    let finalPrice = priceValue;
    if (paidStatus) {
      extraCharge = computeAdditionalCharge(priceValue);
      finalPrice = priceValue + extraCharge;
    }
    try {
      await pdfModel.updatePdf(id, {
        title,
        description,
        isPaid: paidStatus,
        price: finalPrice,
        extraCharge
      });
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

  // Retrieve full details for a specific PDF.
  async getPdfDetails(req, res) {
    const { id } = req.params;
    try {
      const pdfs = await pdfModel.getPdfDetails(id);
      if (!pdfs || pdfs.length === 0) {
        return res.status(404).json({ message: 'PDF not found.' });
      }
      const pdf = pdfs[0];
      if (pdf.profilePic) {
        try {
          const decryptedPic = decryptBuffer(pdf.profilePic);
          const decompressedPic = zlib.gunzipSync(decryptedPic);
          pdf.profilePicBase64 = decompressedPic.toString('base64');
        } catch (_) {
          pdf.profilePicBase64 = pdf.profilePic.toString('base64');
        }
      } else {
        pdf.profilePicBase64 = null;
      }
      delete pdf.profilePic;
      pdf.isPaid = pdf.is_paid ? "true" : "false";
      pdf.price = parseFloat(pdf.price) || 0.00;
      pdf.rating_percentage = (pdf.average_rating / 5) * 100;
      res.status(200).json(pdf);
    } catch (error) {
      console.error('Error retrieving PDF details:', error);
      res.status(500).json({ message: 'Error retrieving PDF details.' });
    }
  },

  // Serve cover photo.
  async getCoverPhoto(req, res) {
    const { id } = req.params;
    try {
      const results = await pdfModel.getCoverPhoto(id);
      if (!results || results.length === 0 || !results[0].cover_photo) {
        return res.status(404).json({ message: 'Cover photo not found.' });
      }
      const photoData = results[0].cover_photo;
      const decryptedCover = decryptBuffer(photoData);
      const decompressedCover = zlib.gunzipSync(decryptedCover);
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': decompressedCover.length,
      });
      res.end(decompressedCover);
    } catch (error) {
      console.error('Error retrieving cover photo:', error);
      res.status(500).json({ message: 'Error retrieving cover photo.' });
    }
  },

  // Retrieve comments for a PDF.
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

  // -------------------- Search PDFs for Frontend --------------------
  async searchPdfs(req, res) {
    try {
      const filters = {
        query: req.query.query,           // Search term for title/description.
        userId: req.query.userId,         // Optional: filter by uploader.
        visibility: req.query.visibility, // e.g., 'public'
        isPaid: req.query.isPaid,         // Boolean string.
        sortBy: req.query.sortBy,         // newest, oldest, downloads, rating, title.
        limit: req.query.limit || 10,
        offset: req.query.offset || 0
      };
      const results = await pdfModel.searchPdfs(filters);
      const processed = results.map(row => {
        if (row.profilePic) {
          try {
            const decryptedPic = decryptBuffer(row.profilePic);
            const decompressedPic = zlib.gunzipSync(decryptedPic);
            row.profilePicBase64 = decompressedPic.toString('base64');
          } catch (e) {
            row.profilePicBase64 = row.profilePic.toString('base64');
          }
        } else {
          row.profilePicBase64 = null;
        }
        delete row.profilePic;
        row.isPaid = row.is_paid ? "true" : "false";
        row.price = parseFloat(row.price) || 0.00;
        return row;
      });
      res.status(200).json(processed);
    } catch (error) {
      console.error('Error searching PDFs:', error);
      res.status(500).json({ message: 'Error searching PDFs.' });
    }
  },

  // Download PDF with payment verification.
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
      const isPdfPaid =
        pdf.is_paid === true ||
        pdf.is_paid === 1 ||
        pdf.is_paid === 'true';
      if (isPdfPaid) {
        const hasPurchased = await pdfModel.checkPurchase(userId, id);
        if (!hasPurchased) {
          return res.status(403).json({
            message: 'This is a paid PDF. Please purchase to download.',
            price: Number(pdf.price) || 0.00
          });
        }
      }
      const decryptedPdf = decryptBuffer(pdf.pdf_data);
      const decompressedPdfData = zlib.gunzipSync(decryptedPdf);
      res.setHeader('Content-Disposition', `attachment; filename="${pdf.file_name}"`);
      res.setHeader('Content-Type', pdf.mime_type);
      return res.send(decompressedPdfData);
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
      await helpers.recordDownload(pdfId, userId, req);
      res.status(200).json({ message: 'Download history recorded successfully.' });
    } catch (error) {
      console.error('Error recording download history:', error);
      res.status(500).json({ message: 'Error recording download history.' });
    }
  },

  // -------------------- Bookmark Endpoints --------------------
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

  async getBookmarks(req, res) {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: user not found.' });
    }
    try {
      const bookmarks = await pdfModel.getBookmarks(userId);
      const formattedBookmarks = bookmarks.map(bookmark => ({
        ...bookmark,
        isPaid: bookmark.is_paid ? "true" : "false",
        price: parseFloat(bookmark.price) || 0.00
      }));
      res.status(200).json(formattedBookmarks);
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
      res.status(500).json({ message: 'Error fetching bookmarks.' });
    }
  },

  async getPurchasedPdfs(req, res) {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: user not found.' });
    }
    try {
      const purchasedPdfs = await pdfModel.getPurchasedPdfs(userId);
      const pdfsWithProfile = purchasedPdfs.map(pdf => {
        if (pdf.profilePic) {
          try {
            const decryptedPic = decryptBuffer(pdf.profilePic);
            const decompressedPic = zlib.gunzipSync(decryptedPic);
            pdf.profilePicBase64 = decompressedPic.toString('base64');
          } catch (_) {
            pdf.profilePicBase64 = pdf.profilePic.toString('base64');
          }
        } else {
          pdf.profilePicBase64 = null;
        }
        delete pdf.profilePic;
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

  async purchasePdf(req, res) {
    const { pdfId } = req.params;
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User not logged in' });
    }
    try {
      const pdf = await pdfModel.getPdfDetails(pdfId);
      if (!pdf || pdf.length === 0) {
        return res.status(404).json({ message: 'PDF not found' });
      }
      if (pdf[0].is_paid !== 1) {
        return res.status(400).json({ message: 'This PDF is free and does not require payment' });
      }
      const hasPurchased = await pdfModel.checkPurchase(userId, pdfId);
      if (hasPurchased) {
        return res.status(400).json({ message: 'You have already purchased this PDF' });
      }
      const paymentData = {
        email: req.user.email,
        amount: Math.round(parseFloat(pdf[0].price) * 100), // in kobo
        metadata: {
          userId,
          pdfId,
          pdfTitle: pdf[0].title,
        },
        callback_url: `${process.env.FRONTEND_URL}/payment-callback`,
      };
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

  async verifyPayment(req, res) {
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).json({ message: 'Payment reference is required.' });
    }
    try {
      const verifyResponse = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          },
        }
      );
      if (
        verifyResponse.data &&
        verifyResponse.data.data &&
        verifyResponse.data.data.status === 'success'
      ) {
        return res.json({
          success: true,
          message: 'Payment verified successfully',
          data: verifyResponse.data.data,
        });
      } else {
        return res.status(400).json({ success: false, message: 'Payment verification failed.' });
      }
    } catch (error) {
      console.error('Error verifying payment:', error.message);
      return res.status(500).json({ message: 'Error verifying payment.' });
    }
  },
  
  async checkPurchase(req, res) {
    const { pdfId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: User not logged in.' });
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
