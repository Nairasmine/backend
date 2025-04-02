const { db, helpers } = require('../config/db');

// Create a new PDF.
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
  tags
}) {
  const query = `
    INSERT INTO pdfs 
      (title, description, user_id, file_name, file_size, mime_type, cover_photo, pdf_data, visibility, tags, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
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
    JSON.stringify(tags)
  ]);
}

// Retrieve metadata for all active PDFs.
async function getAllPdfs() {
  const query = `
    SELECT p.id, p.title, p.description, p.user_id, p.file_name, p.file_size, p.mime_type, p.created_at,
           u.username AS user,
           u.profile_pic AS profilePic
    FROM pdfs p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.status = 'active'
    ORDER BY p.created_at DESC
  `;
  const [results] = await db.query(query);
  return results;
}

// Update a PDF's title and description.
async function updatePdf(id, title, description) {
  const query = `UPDATE pdfs SET title = ?, description = ? WHERE id = ?`;
  return await db.query(query, [title, description, id]);
}

// Delete a PDF.
async function deletePdf(id) {
  const query = `DELETE FROM pdfs WHERE id = ?`;
  return await db.query(query, [id]);
}

// Retrieve full details for a specified PDF.
async function getPdfDetails(id) {
  const query = `
    SELECT p.id, p.title, p.description, p.user_id, p.file_name, p.file_size, p.mime_type, p.cover_photo, 
           p.created_at,
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

// Get the cover photo for a PDF.
async function getCoverPhoto(id) {
  const query = `SELECT cover_photo FROM pdfs WHERE id = ?`;
  const [results] = await db.query(query, [id]);
  return results;
}

// Retrieve all comments for a PDF.
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

// Add a comment to a PDF.
async function addComment(pdfId, userId, comment) {
  const query = `
    INSERT INTO comments (pdf_id, user_id, comment, created_at)
    VALUES (?, ?, ?, NOW())
  `;
  return await db.query(query, [pdfId, userId, comment]);
}

// Search for PDFs by title or description.
async function searchPdfs(queryString) {
  const query = `
    SELECT p.*, u.username AS user, u.profile_pic AS profilePic 
    FROM pdfs p 
    LEFT JOIN users u ON p.user_id = u.id 
    WHERE p.title LIKE ? OR p.description LIKE ?
  `;
  const params = [`%${queryString}%`, `%${queryString}%`];
  const [results] = await db.query(query, params);
  return results;
}

// Retrieve the file data for PDF download.
async function downloadPdf(id) {
  const query = `
    SELECT file_name, mime_type, pdf_data 
    FROM pdfs 
    WHERE id = ?
  `;
  const [results] = await db.query(query, [id]);
  return results;
}

// Rate a PDF and update the uploader's overall rating.
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

// Record a download history.
async function recordHistory(pdfId, userId, req) {
  return await helpers.recordDownload(pdfId, userId, req);
}

// -------------------- Bookmark Functions --------------------

// Add (or ignore if exists) a bookmark for a user and PDF.
async function bookmarkPdf(userId, pdfId) {
  const query = `INSERT IGNORE INTO bookmarks (user_id, pdf_id) VALUES (?, ?)`;
  return await db.query(query, [userId, pdfId]);
}

// Remove a bookmark.
async function removeBookmark(userId, pdfId) {
  const query = `DELETE FROM bookmarks WHERE user_id = ? AND pdf_id = ?`;
  return await db.query(query, [userId, pdfId]);
}

// Retrieve all bookmarks for a user.
async function getBookmarks(userId) {
  const query = `
    SELECT b.*, p.title, p.description, p.file_name, p.created_at, p.updated_at
    FROM bookmarks b
    INNER JOIN pdfs p ON b.pdf_id = p.id
    WHERE b.user_id = ?
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
  getBookmarks
};
