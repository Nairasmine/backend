// controllers/bookmarkController.js
const bookmarkModel = require('../models/bookmarkModel');
const zlib = require('zlib');
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; 
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // For AES, this is always 16 bytes

function decryptBuffer(buffer) {
  if (!ENCRYPTION_KEY) return buffer;
  const iv = buffer.slice(0, IV_LENGTH);
  const encryptedText = buffer.slice(IV_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
  return Buffer.concat([decipher.update(encryptedText), decipher.final()]);
}

const bookmarkController = {
  async getAllBookmarks(req, res) {
    try {
      const userId = req.user && req.user.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized: user not found.' });
      }
      const results = await bookmarkModel.getBookmarks(userId);
      results.forEach((bookmark) => {
        if (bookmark.cover_photo) {
          try {
            let buffer = bookmark.cover_photo;
            if (ENCRYPTION_KEY) {
              buffer = decryptBuffer(buffer);
            }
            let decompressedBuffer;
            try {
              decompressedBuffer = zlib.gunzipSync(buffer);
            } catch (error) {
              if (error.code === 'Z_DATA_ERROR') {
                decompressedBuffer = buffer;
              } else {
                throw error;
              }
            }
            bookmark.cover_photo = 'data:image/jpeg;base64,' + decompressedBuffer.toString('base64');
          } catch (err) {
            console.error('Error processing cover photo for bookmark:', err);
            bookmark.cover_photo = null;
          }
        }
      });
      return res.status(200).json(results);
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      return res.status(500).json({ message: "Error fetching bookmarks." });
    }
  },

  // Dummy implementation for adding a bookmark.
  async addBookmark(req, res) {
    try {
      const userId = req.user && req.user.id;
      const { pdf_id } = req.body;
      if (!userId || !pdf_id) {
        return res.status(400).json({ message: 'Missing user or PDF id.' });
      }
      const result = await bookmarkModel.addBookmark(userId, pdf_id);
      return res.status(201).json(result);
    } catch (error) {
      console.error("Error adding bookmark:", error);
      return res.status(500).json({ message: "Error adding bookmark." });
    }
  },

  // Dummy implementation for removing a bookmark.
  async removeBookmark(req, res) {
    try {
      const userId = req.user && req.user.id;
      const pdfId = req.params.pdfId;
      if (!userId || !pdfId) {
        return res.status(400).json({ message: 'Missing user or PDF id.' });
      }
      await bookmarkModel.removeBookmark(userId, pdfId);
      return res.status(200).json({ message: 'Bookmark removed successfully.' });
    } catch (error) {
      console.error("Error removing bookmark:", error);
      return res.status(500).json({ message: "Error removing bookmark." });
    }
  },
};

module.exports = bookmarkController;
