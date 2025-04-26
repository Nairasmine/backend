// controllers/pdfRankingsController.js

const { db } = require('../config/db'); // Updated path to your database configuration
const zlib = require('zlib');
const crypto = require('crypto');

// ----------------------------- Encryption / Decompression Config -----------------------------

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; 
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // For AES, this is always 16

// Decrypt a buffer if encryption key is provided.
function decryptBuffer(buffer) {
  if (!ENCRYPTION_KEY) return buffer;
  const iv = buffer.slice(0, IV_LENGTH);
  const encryptedText = buffer.slice(IV_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
  return Buffer.concat([decipher.update(encryptedText), decipher.final()]);
}

const getTopSellers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    
    const [rows] = await db.query(
      `
      SELECT 
        u.username,
        u.profile_pic,
        SUM(p.download_count) AS total_downloads,
        COALESCE(SUM(tp.total_purchases), 0) AS total_purchases,
        COALESCE(AVG(pr.average_rating), 0) AS average_rating,
        (
          SUM(p.download_count) + 
          (COALESCE(AVG(pr.average_rating), 0) * 3) + 
          (COALESCE(SUM(tp.total_purchases), 0) * 8)
        ) AS score
      FROM pdfs p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN (
        SELECT pdf_id, COUNT(*) AS total_purchases
        FROM purchases
        WHERE status = 'completed' AND transaction_type = 'pdf_purchase'
        GROUP BY pdf_id
      ) tp ON p.id = tp.pdf_id
      LEFT JOIN (
        SELECT pdf_id, AVG(rating) AS average_rating
        FROM pdf_ratings
        GROUP BY pdf_id
      ) pr ON p.id = pr.pdf_id
      WHERE p.status = 'active'
      GROUP BY u.username, u.profile_pic
      ORDER BY score DESC
      LIMIT ?
      `,
      [limit]
    );

    // For top sellers, if needed, convert the seller profile image.
    // (Assuming seller profile images are stored uncompressed or are directly usable.)
    rows.forEach(row => {
      if (row.profile_pic) {
        // If your profile images are compressed/encrypted, apply similar decryption/decompression.
        // For now, we assume they are stored as plain binary data.
        row.profile_pic = 'data:image/jpeg;base64,' + row.profile_pic.toString('base64');
      }
    });

    return res.json(rows);
  } catch (error) {
    console.error('Error fetching top sellers:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getMostSellingBooks = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    
    const [rows] = await db.query(
      `
      SELECT 
        p.id,
        p.title,
        p.cover_photo,
        p.download_count,
        u.username AS author,
        COALESCE(tp.total_purchases, 0) AS total_purchases,
        COALESCE(pr.average_rating, 0) AS average_rating,
        COALESCE(c.comment_count, 0) AS comment_count,
        (
          p.download_count + 
          (COALESCE(pr.average_rating, 0) * 2) + 
          (COALESCE(tp.total_purchases, 0) * 5) + 
          (COALESCE(c.comment_count, 0) * 2)
        ) AS score
      FROM pdfs p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN (
        SELECT pdf_id, COUNT(*) AS total_purchases
        FROM purchases
        WHERE status = 'completed' AND transaction_type = 'pdf_purchase'
        GROUP BY pdf_id
      ) tp ON p.id = tp.pdf_id
      LEFT JOIN (
        SELECT pdf_id, AVG(rating) AS average_rating
        FROM pdf_ratings
        GROUP BY pdf_id
      ) pr ON p.id = pr.pdf_id
      LEFT JOIN (
        SELECT pdf_id, COUNT(*) AS comment_count
        FROM comments
        GROUP BY pdf_id
      ) c ON p.id = c.pdf_id
      WHERE p.status = 'active'
      ORDER BY score DESC
      LIMIT ?
      `,
      [limit]
    );

    // Process the cover_photo buffer:
    rows.forEach(row => {
      if (row.cover_photo) {
        try {
          let buffer = row.cover_photo;
          // Decrypt if encryption is enabled.
          if (ENCRYPTION_KEY) {
            buffer = decryptBuffer(buffer);
          }
          // Decompress the cover photo buffer using gunzipSync.
          const decompressedBuffer = zlib.gunzipSync(buffer);
          // Convert the decompressed buffer to a Base64 string with data URI prefix.
          row.cover_photo = 'data:image/jpeg;base64,' + decompressedBuffer.toString('base64');
        } catch (err) {
          console.error('Error processing cover photo for PDF ID ' + row.id + ':', err);
          // Optionally, set the cover_photo to null if processing fails.
          row.cover_photo = null;
        }
      }
    });

    return res.json(rows);
  } catch (error) {
    console.error('Error fetching most selling books:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getTopSellers, getMostSellingBooks };
