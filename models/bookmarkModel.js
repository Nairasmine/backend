// models/bookmarkModel.js
const { db } = require('../config/db');

const bookmarkModel = {
  /**
   * Retrieve all bookmarked PDFs for a given user.
   * Joins the bookmarks and pdfs tables to return PDF details.
   */
  async getBookmarks(userId) {
    try {
      const selectQuery = `
        SELECT 
          b.id AS bookmark_id,
          b.user_id,
          b.pdf_id,
          p.title,
          p.description,
          p.file_name,
          p.created_at,
          p.updated_at,
          IFNULL(TO_BASE64(p.cover_photo), '') AS cover_photo
        FROM bookmarks b
        INNER JOIN pdfs p ON b.pdf_id = p.id
        WHERE b.user_id = ?
      `;
      const [rows] = await db.query(selectQuery, [userId]);
      return rows;
    } catch (error) {
      console.error('Error in getBookmarks:', error);
      throw error;
    }
  },

  /**
   * Add a new bookmark for a given user and PDF.
   */
  async addBookmark(userId, pdfId) {
    try {
      const insertQuery = `
        INSERT INTO bookmarks (user_id, pdf_id)
        VALUES (?, ?)
      `;
      const [result] = await db.query(insertQuery, [userId, pdfId]);
      return {
        bookmark_id: result.insertId,
        user_id: userId,
        pdf_id: pdfId
      };
    } catch (error) {
      console.error('Error in addBookmark:', error);
      throw error;
    }
  },

  /**
   * Remove a bookmark for a given user and PDF.
   */
  async removeBookmark(userId, pdfId) {
    try {
      const deleteQuery = `
        DELETE FROM bookmarks
        WHERE user_id = ? AND pdf_id = ?
      `;
      await db.query(deleteQuery, [userId, pdfId]);
      return;
    } catch (error) {
      console.error('Error in removeBookmark:', error);
      throw error;
    }
  },
};

module.exports = bookmarkModel;
