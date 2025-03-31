const { db } = require('../config/db');

const pdfModel = {
  async createPdf(data) {
    try {
      const { title, description, file_name, file_path, file_size, user_id, visibility, tags, mime_type } = data;
      const [result] = await db.query(`
        INSERT INTO pdfs (title, description, file_name, file_path, file_size, user_id, visibility, tags, mime_type, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [title, description, file_name, file_path, file_size, user_id, visibility, JSON.stringify(tags || []), mime_type]);
      return result.insertId;
    } catch (error) {
      console.error('Error creating PDF:', error);
      throw error;
    }
  },

  async getPdfById(id) {
    try {
      const [rows] = await db.query(`
        SELECT * FROM pdfs WHERE id = ? AND status = 'active'
      `, [id]);
      return rows[0];
    } catch (error) {
      console.error('Error fetching PDF by ID:', error);
      throw error;
    }
  },

  async updatePdf(id, data) {
    try {
      const { title, description, visibility, tags } = data;
      const [result] = await db.query(`
        UPDATE pdfs 
        SET 
          title = COALESCE(?, title),
          description = COALESCE(?, description),
          visibility = COALESCE(?, visibility),
          tags = COALESCE(?, tags),
          updated_at = NOW()
        WHERE id = ? AND status = 'active'
      `, [title, description, visibility, JSON.stringify(tags || []), id]);
      return result.affectedRows;
    } catch (error) {
      console.error('Error updating PDF:', error);
      throw error;
    }
  },

  async deletePdf(id) {
    try {
      const [result] = await db.query(`
        UPDATE pdfs SET status = 'deleted' WHERE id = ?
      `, [id]);
      return result.affectedRows;
    } catch (error) {
      console.error('Error deleting PDF:', error);
      throw error;
    }
  },

  async searchPdfs(filters = {}) {
    try {
      const { query, userId, visibility, limit = 10, offset = 0 } = filters;

      let sql = `
        SELECT * FROM pdfs
        WHERE status = 'active'
      `;

      const params = [];
      if (query) {
        sql += ` AND (title LIKE ? OR description LIKE ?)`;
        params.push(`%${query}%`, `%${query}%`);
      }
      if (userId) {
        sql += ` AND user_id = ?`;
        params.push(userId);
      }
      if (visibility) {
        sql += ` AND visibility = ?`;
        params.push(visibility);
      }

      sql += ` LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), parseInt(offset));

      const [rows] = await db.query(sql, params);
      return rows;
    } catch (error) {
      console.error('Error searching PDFs:', error);
      throw error;
    }
  }
};

module.exports = pdfModel;
