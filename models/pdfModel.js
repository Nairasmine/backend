const { db, helpers } = require('../config/db');

// -------------------- Create a PDF --------------------
// Allowing paid/free PDFs with price option
async function createPdf({
  title,
  description,
  userId,
  file_name,
  file_size,
  mime_type,
  cover_photo,
  pdf_data,
  visibility,
  tags,
  isPaid = false, // Default to free
  price = 0.00    // Default to free
}) {
  if (isPaid && price <= 0) {
    throw new Error('Price must be greater than 0 for paid PDFs.');
  }

  const query = `
    INSERT INTO pdfs 
      (title, description, user_id, file_name, file_size, mime_type, cover_photo, pdf_data, 
       visibility, tags, is_paid, price, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;
  return await db.query(query, [
    title,
    description,
    userId,
    file_name,
    file_size,
    mime_type,
    cover_photo,
    pdf_data,
    visibility,
    JSON.stringify(tags),
    isPaid,
    price
  ]);
}

// -------------------- Retrieve Metadata for All Active PDFs --------------------
async function getAllPdfs() {
  const query = `
    SELECT p.id, p.title, p.description, p.user_id, p.file_name, p.file_size, p.mime_type, 
           p.is_paid, p.price, p.created_at, p.cover_photo,
           u.username AS user,
           u.profile_pic AS profilePic,
           COALESCE(AVG(pr.rating), 0) AS average_rating
    FROM pdfs p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN pdf_ratings pr ON p.id = pr.pdf_id
    WHERE p.status = 'active'
    GROUP BY p.id, p.title, p.description, p.user_id, p.file_name, p.file_size, p.mime_type, 
             p.is_paid, p.price, p.created_at, p.cover_photo, u.username, u.profile_pic
    ORDER BY p.created_at DESC
  `;
  const [results] = await db.query(query);
  return results;
}

// -------------------- Update a PDF --------------------
async function updatePdf(id, { title, description, isPaid, price }) {
  if (isPaid && price <= 0) {
    throw new Error('Price must be greater than 0 for paid PDFs.');
  }

  const query = `
    UPDATE pdfs 
    SET title = ?, description = ?, is_paid = ?, price = ? 
    WHERE id = ?
  `;
  return await db.query(query, [title, description, isPaid, price, id]);
}

// -------------------- Delete a PDF --------------------
async function deletePdf(id) {
  const query = `DELETE FROM pdfs WHERE id = ?`;
  return await db.query(query, [id]);
}

// -------------------- Get PDF Details --------------------
async function getPdfDetails(id) {
  const query = `
    SELECT p.id, p.title, p.description, p.user_id, p.file_name, p.file_size, p.mime_type, 
           p.cover_photo, p.is_paid, p.price, p.created_at, p.tags,
           u.username AS user,
           u.profile_pic AS profilePic,
           COALESCE(AVG(pr.rating), 0) AS average_rating,
           COUNT(pr.rating) AS rating_count
    FROM pdfs p
    LEFT JOIN pdf_ratings pr ON p.id = pr.pdf_id
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.id = ?
    GROUP BY p.id, u.username, u.profile_pic
  `;
  const [results] = await db.query(query, [id]);
  return results;
}

// -------------------- Get Cover Photo --------------------
async function getCoverPhoto(id) {
  const query = `SELECT cover_photo FROM pdfs WHERE id = ?`;
  const [results] = await db.query(query, [id]);
  return results;
}

// -------------------- Get Comments --------------------
async function getComments(pdfId) {
  const query = `
    SELECT c.id, c.comment, c.created_at, c.user_id, u.username AS user_name
    FROM comments c 
    LEFT JOIN users u ON c.user_id = u.id 
    WHERE c.pdf_id = ? 
    ORDER BY c.created_at ASC
  `;
  const [results] = await db.query(query, [pdfId]);
  return results;
}

// -------------------- Add Comment --------------------
async function addComment(pdfId, userId, comment) {
  const query = `
    INSERT INTO comments (pdf_id, user_id, comment, created_at)
    VALUES (?, ?, ?, NOW())
  `;
  return await db.query(query, [pdfId, userId, comment]);
}

// -------------------- Search PDFs --------------------
async function searchPdfs(filters = {}) {
  const { query, userId, visibility, isPaid, sortBy = 'newest', limit = 10, offset = 0 } = filters;

  let sql = `
    SELECT p.*, u.username AS user, u.profile_pic AS profilePic,
           COALESCE(AVG(pr.rating), 0) AS average_rating,
           COUNT(DISTINCT h.id) AS download_count
    FROM pdfs p 
    LEFT JOIN users u ON p.user_id = u.id 
    LEFT JOIN pdf_ratings pr ON p.id = pr.pdf_id
    LEFT JOIN download_history h ON p.id = h.pdf_id
    WHERE p.status = 'active'
  `;
  const params = [];

  if (query) {
    sql += ` AND (p.title LIKE ? OR p.description LIKE ?)`;
    params.push(`%${query}%`, `%${query}%`);
  }

  if (userId) {
    sql += ` AND p.user_id = ?`;
    params.push(userId);
  }

  if (visibility) {
    sql += ` AND p.visibility = ?`;
    params.push(visibility);
  }

  if (isPaid !== undefined) {
    sql += ` AND p.is_paid = ?`;
    params.push(isPaid);
  }

  sql += ` GROUP BY p.id, p.title, p.description, p.user_id, p.file_name, p.file_size, p.mime_type, 
            p.cover_photo, p.is_paid, p.price, p.created_at, p.tags, u.username, u.profile_pic`;

  const sortMap = {
    newest: 'p.created_at DESC',
    oldest: 'p.created_at ASC',
    downloads: 'download_count DESC',
    rating: 'average_rating DESC',
    title: 'p.title ASC'
  };

  sql += ` ORDER BY ${sortMap[sortBy] || 'p.created_at DESC'}`;
  sql += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  const [results] = await db.query(sql, params);
  return results;
}

// -------------------- Download PDF --------------------
async function downloadPdf(id) {
  const query = `
    SELECT file_name, mime_type, pdf_data, is_paid, price 
    FROM pdfs 
    WHERE id = ?
  `;
  const [results] = await db.query(query, [id]);
  return results;
}

// -------------------- Rate PDF --------------------
async function ratePdf(id, userId, rating) {
  const query = `
    INSERT INTO pdf_ratings (pdf_id, user_id, rating, created_at)
    VALUES (?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE rating = ?, created_at = NOW()
  `;
  await db.query(query, [id, userId, rating, rating]);

  const [uploaderResults] = await db.query(`SELECT user_id FROM pdfs WHERE id = ?`, [id]);
  if (uploaderResults.length > 0) {
    const uploaderId = uploaderResults[0].user_id;
    const [ratingRows] = await db.query(
      `SELECT AVG(pr.rating) AS overallRating
       FROM pdf_ratings pr
       JOIN pdfs p ON p.id = pr.pdf_id
       WHERE p.user_id = ?`,
       [uploaderId]
    );
    const overallRating = ratingRows[0].overallRating;
    await db.query(`UPDATE users SET overall_rating = ? WHERE id = ?`, [overallRating, uploaderId]);
  }
}

// -------------------- Record Download History --------------------
async function recordHistory(pdfId, userId, req) {
  return await helpers.recordDownload(pdfId, userId, req);
}

// -------------------- Bookmark Functions --------------------

// Add bookmark
async function bookmarkPdf(userId, pdfId) {
  const query = `INSERT IGNORE INTO bookmarks (user_id, pdf_id) VALUES (?, ?)`;
  return await db.query(query, [userId, pdfId]);
}

// Remove bookmark
async function removeBookmark(userId, pdfId) {
  const query = `DELETE FROM bookmarks WHERE user_id = ? AND pdf_id = ?`;
  return await db.query(query, [userId, pdfId]);
}

// Get bookmarks
async function getBookmarks(userId) {
  const query = `
    SELECT b.*, p.title, p.description, p.file_name, p.created_at, p.updated_at, p.is_paid, p.price
    FROM bookmarks b
    INNER JOIN pdfs p ON b.pdf_id = p.id
    WHERE b.user_id = ?
  `;
  const [results] = await db.query(query, [userId]);
  return results;
}

// -------------------- Payment Functions --------------------

// Check if user has purchased a PDF
async function checkPurchase(userId, pdfId) {
  const query = `
    SELECT COUNT(*) as count 
    FROM purchases 
    WHERE user_id = ? AND pdf_id = ?
  `;
  const [result] = await db.query(query, [userId, pdfId]);
  return result[0].count > 0;
}

// Record a purchase
async function recordPurchase(userId, pdfId, reference, amount) {
  const query = `
    INSERT INTO purchases (user_id, pdf_id, reference, amount, purchase_date)
    VALUES (?, ?, ?, ?, NOW())
  `;
  return await db.query(query, [userId, pdfId, reference, amount]);
}

// Get purchased PDFs
async function getPurchasedPdfs(userId) {
  const query = `
    SELECT p.id, p.title, p.description, p.file_name, p.created_at, p.is_paid, p.price,
           p.user_id, u.username AS user, u.profile_pic AS profilePic,
           COALESCE(AVG(pr.rating), 0) AS average_rating,
           pu.purchase_date
    FROM purchases pu
    INNER JOIN pdfs p ON pu.pdf_id = p.id
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN pdf_ratings pr ON p.id = pr.pdf_id
    WHERE pu.user_id = ?
    GROUP BY p.id, p.title, p.description, p.file_name, p.created_at, p.is_paid, p.price,
             p.user_id, u.username, u.profile_pic, pu.purchase_date
    ORDER BY pu.purchase_date DESC
  `;
  const [results] = await db.query(query, [userId]);
  return results;
}

module.exports = {
  createPdf,
  getAllPdfs,
  updatePdf,
  deletePdf,
  getPdfDetails,
  getCoverPhoto,
  getComments,
  addComment,
  searchPdfs,
  downloadPdf,
  ratePdf,
  recordHistory,
  bookmarkPdf,
  removeBookmark,
  getBookmarks,
  checkPurchase,
  recordPurchase,
  getPurchasedPdfs
};