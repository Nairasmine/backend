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
          -- Optionally, you can also fetch the cover photo from the PDFs table.
          -- For example, if you want the cover photo as a Base64 string (MySQL):
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

  // Other bookmark functions (bookmarkPdf, removeBookmark) remain unchanged…
};

module.exports = bookmarkModel;
