// config/db.js

const mysql = require('mysql2');
require('dotenv').config();
const bcrypt = require('bcryptjs');

// Constants
const CURRENT_TIMESTAMP = new Date().toISOString();
const CURRENT_USER = 'Nairasmine';

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Okikiokiki123@',
  database: process.env.DB_NAME || 'pdf',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Convert pool to use promises
const promisePool = pool.promise();

// Initialize database and tables
const initializeDatabase = async () => {
  try {
    // Create users table
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL,
        profile_pic LONGBLOB,
        email VARCHAR(255) UNIQUE,
        role ENUM('user', 'admin') DEFAULT 'user',
        overall_rating DECIMAL(3,2) DEFAULT 0,
        status ENUM('active', 'inactive') DEFAULT 'active',
        reset_token VARCHAR(255),
        reset_token_expires TIMESTAMP NULL
      )
    `);

    // Create pdfs table
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS pdfs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        file_name VARCHAR(255) NOT NULL,
        file_size INT NOT NULL,
        mime_type VARCHAR(100) DEFAULT 'application/pdf',
        cover_photo LONGBLOB,
        pdf_data LONGBLOB,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
        download_count INT DEFAULT 0,
        status ENUM('active', 'deleted') DEFAULT 'active',
        visibility ENUM('public', 'private', 'paid') DEFAULT 'public',
        tags JSON,
        is_paid BOOLEAN DEFAULT FALSE,
        price DECIMAL(10,2) DEFAULT 0.00,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create purchases table
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        pdf_id INT NOT NULL,
        purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(50),
        transaction_id VARCHAR(100),
        status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'completed',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE,
        INDEX (user_id),
        INDEX (pdf_id),
        INDEX (transaction_id)
      )
    `);

    // Create comments table
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        pdf_id INT NOT NULL,
        user_id INT NOT NULL,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create pdf_ratings table
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS pdf_ratings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        pdf_id INT NOT NULL,
        user_id INT NOT NULL,
        rating INT CHECK (rating >= 1 AND rating <= 5),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_rating (pdf_id, user_id),
        FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create download_history table
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS download_history (
        id INT PRIMARY KEY AUTO_INCREMENT,
        pdf_id INT NOT NULL,
        pdf_title VARCHAR(255),
        user_id INT NOT NULL,
        downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        user_agent TEXT,
        FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create bookmarks table
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        pdf_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_bookmark (user_id, pdf_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE
      )
    `);

    // Insert default admin user if not exists
    const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Okikiokiki123@', 10);
    await promisePool.query(`
      INSERT IGNORE INTO users (
        username,
        password,
        role,
        email,
        created_at,
        status
      ) VALUES (?, ?, 'admin', ?, NOW(), 'active')
    `, [CURRENT_USER, hashedPassword, 'admin@example.com']);

    console.log('Database and tables initialized successfully');
    return promisePool;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

// Helper functions
const helpers = {
  getCurrentTimestamp() {
    return CURRENT_TIMESTAMP;
  },

  getCurrentUser() {
    return CURRENT_USER;
  },

  async updateDownloadCount(pdfId) {
    try {
      const [result] = await promisePool.query(
        `
        UPDATE pdfs
        SET download_count = download_count + 1
        WHERE id = ?
      `,
        [pdfId]
      );
      console.log(`Download count updated for PDF ID: ${pdfId}`);
      return result;
    } catch (error) {
      console.error('Error in updateDownloadCount:', error);
      throw error;
    }
  },

  async getPdfWithDetails(pdfId) {
    try {
      const [rows] = await promisePool.query(
        `
        SELECT 
          p.*,
          u.username AS uploaded_by,
          COUNT(DISTINCT dh.id) AS download_count,
          COALESCE(AVG(pr.rating), 0) AS average_rating,
          COUNT(DISTINCT c.id) AS comment_count
        FROM pdfs p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN download_history dh ON p.id = dh.pdf_id
        LEFT JOIN pdf_ratings pr ON p.id = pr.pdf_id
        LEFT JOIN comments c ON p.id = c.pdf_id
        WHERE p.id = ? AND p.status = 'active'
        GROUP BY p.id
      `,
        [pdfId]
      );
      return rows[0];
    } catch (error) {
      console.error('Error in getPdfWithDetails:', error);
      throw error;
    }
  },

  async recordDownload(pdfId, userId, req) {
    const connection = await promisePool.getConnection();
    try {
      await connection.beginTransaction();

      const [titleRows] = await connection.query(
        'SELECT title FROM pdfs WHERE id = ?',
        [pdfId]
      );
      const pdfTitle = titleRows.length > 0 ? titleRows[0].title : 'Unknown Title';

      await connection.query(
        `
          INSERT INTO download_history (
            pdf_id,
            pdf_title,
            user_id,
            ip_address,
            user_agent
          ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          pdfId,
          pdfTitle,
          userId,
          req.ip,
          req.headers['user-agent'] || 'unknown'
        ]
      );

      await connection.query(
        `
          UPDATE pdfs 
          SET download_count = download_count + 1 
          WHERE id = ?
        `,
        [pdfId]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.error('Error in recordDownload:', error);
      throw error;
    } finally {
      connection.release();
    }
  },

  async searchPdfs(filters = {}) {
    try {
      const {
        query,
        userId,
        visibility,
        sortBy = 'newest',
        limit = 10,
        offset = 0
      } = filters;

      let sql = `
        SELECT 
          p.*,
          u.username as uploaded_by,
          COUNT(DISTINCT dh.id) as download_count,
          COALESCE(AVG(pr.rating), 0) as average_rating,
          COUNT(DISTINCT c.id) as comment_count
        FROM pdfs p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN download_history dh ON p.id = dh.pdf_id
        LEFT JOIN pdf_ratings pr ON p.id = pr.pdf_id
        LEFT JOIN comments c ON p.id = c.pdf_id
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

      sql += ` GROUP BY p.id`;

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

      const [rows] = await promisePool.query(sql, params);
      return rows;
    } catch (error) {
      console.error('Error in searchPdfs:', error);
      throw error;
    }
  },

  async bookmarkPdf(userId, pdfId) {
    try {
      const [result] = await promisePool.query(
        `
        INSERT IGNORE INTO bookmarks (user_id, pdf_id)
        VALUES (?, ?)
      `,
        [userId, pdfId]
      );
      return result;
    } catch (error) {
      console.error('Error in bookmarkPdf:', error);
      throw error;
    }
  },

  async removeBookmark(userId, pdfId) {
    try {
      const [result] = await promisePool.query(
        `
        DELETE FROM bookmarks 
        WHERE user_id = ? AND pdf_id = ?
      `,
        [userId, pdfId]
      );
      return result;
    } catch (error) {
      console.error('Error in removeBookmark:', error);
      throw error;
    }
  },

  async getBookmarks(userId) {
    try {
      const [rows] = await promisePool.query(
        `
        SELECT b.*, p.title, p.description, p.file_name, p.created_at, p.updated_at
        FROM bookmarks b
        INNER JOIN pdfs p ON b.pdf_id = p.id
        WHERE b.user_id = ?
      `,
        [userId]
      );
      return rows;
    } catch (error) {
      console.error('Error in getBookmarks:', error);
      throw error;
    }
  },

  async recordPurchase(userId, pdfId, amount, paymentMethod = 'unknown', transactionId = null) {
    try {
      const [result] = await promisePool.query(
        `
        INSERT INTO purchases (user_id, pdf_id, amount, payment_method, transaction_id, status)
        VALUES (?, ?, ?, ?, ?, 'completed')
      `,
        [userId, pdfId, amount, paymentMethod, transactionId]
      );
      return result;
    } catch (error) {
      console.error('Error recording purchase:', error);
      throw error;
    }
  },

  async recordPurchaseAlt(purchaseData) {
    try {
      const query = `
        INSERT INTO purchases 
          (user_id, pdf_id, amount, payment_method, transaction_id, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      const [result] = await promisePool.query(query, [
        purchaseData.user_id,
        purchaseData.pdf_id,
        purchaseData.amount,
        purchaseData.payment_method,
        purchaseData.transaction_id,
        purchaseData.status
      ]);
      return result;
    } catch (error) {
      console.error('Error in recordPurchaseAlt:', error);
      throw error;
    }
  },

  async getUserPurchases(userId) {
    try {
      const [rows] = await promisePool.query(
        `
        SELECT 
          p.*, 
          pdf.title, 
          pdf.description, 
          pdf.cover_photo,
          u.username as author_username
        FROM purchases p
        JOIN pdfs pdf ON p.pdf_id = pdf.id
        JOIN users u ON pdf.user_id = u.id
        WHERE p.user_id = ?
        ORDER BY p.purchase_date DESC
      `,
        [userId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting user purchases:', error);
      throw error;
    }
  },

  async recordPurchase({ user_id, pdf_id, amount, payment_method, transaction_id, status }) {
    try {
      const [result] = await promisePool.query(
        `
        INSERT INTO purchases (user_id, pdf_id, amount, payment_method, transaction_id, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [user_id, pdf_id, amount, payment_method, transaction_id, status]
      );
      console.log(`Purchase recorded for User ID: ${user_id}, PDF ID: ${pdf_id}`);
      return result;
    } catch (error) {
      console.error('Error recording purchase:', error);
      throw error;
    }
  }  

};

// Initialize database
initializeDatabase().catch(console.error);

module.exports = {
  db: promisePool,
  helpers,
  CURRENT_TIMESTAMP,
  CURRENT_USER
};
