// config/db.js
const mysql = require('mysql2');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const path = require('path');

// --- Constants ---
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

    // Create purchases table with receipt columns (for PDF and image)
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        pdf_id INT NOT NULL,
        purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        payment_method VARCHAR(50) NOT NULL,
        payment_provider VARCHAR(50),
        transaction_id VARCHAR(100) NOT NULL,
        status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'completed',
        receipt_pdf LONGBLOB,
        receipt_image LONGBLOB,
        billing_address JSON,
        customer_email VARCHAR(255),
        metadata JSON,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE,
        INDEX (user_id),
        INDEX (pdf_id),
        INDEX (transaction_id),
        INDEX (purchase_date),
        INDEX (status)
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
      const [result] = await promisePool.query(`UPDATE pdfs SET download_count = download_count + 1 WHERE id = ?`, [pdfId]);
      return result;
    } catch (error) {
      console.error('Error in updateDownloadCount:', error);
      throw error;
    }
  },
  async getPdfWithDetails(pdfId) {
    try {
      const [rows] = await promisePool.query(
        `SELECT 
          p.*, u.username AS uploaded_by,
          COUNT(DISTINCT dh.id) AS download_count,
          COALESCE(AVG(pr.rating), 0) AS average_rating,
          COUNT(DISTINCT c.id) AS comment_count
         FROM pdfs p
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN download_history dh ON p.id = dh.pdf_id
         LEFT JOIN pdf_ratings pr ON p.id = pr.pdf_id
         LEFT JOIN comments c ON p.id = c.pdf_id
         WHERE p.id = ? AND p.status = 'active'
         GROUP BY p.id`,
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
      const [titleRows] = await connection.query('SELECT title FROM pdfs WHERE id = ?', [pdfId]);
      const pdfTitle = titleRows.length > 0 ? titleRows[0].title : 'Unknown Title';
      await connection.query(
        `INSERT INTO download_history (pdf_id, pdf_title, user_id, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?)`,
        [pdfId, pdfTitle, userId, req.ip, req.headers['user-agent'] || 'unknown']
      );
      await connection.query(`UPDATE pdfs SET download_count = download_count + 1 WHERE id = ?`, [pdfId]);
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
      const { query, userId, visibility, sortBy = 'newest', limit = 10, offset = 0 } = filters;
      let sql = `
        SELECT 
          p.*, u.username AS uploaded_by,
          COUNT(DISTINCT dh.id) AS download_count,
          COALESCE(AVG(pr.rating), 0) AS average_rating,
          COUNT(DISTINCT c.id) AS comment_count
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
      const [result] = await promisePool.query(`INSERT IGNORE INTO bookmarks (user_id, pdf_id) VALUES (?, ?)`, [userId, pdfId]);
      return result;
    } catch (error) {
      console.error('Error in bookmarkPdf:', error);
      throw error;
    }
  },
  async removeBookmark(userId, pdfId) {
    try {
      const [result] = await promisePool.query(`DELETE FROM bookmarks WHERE user_id = ? AND pdf_id = ?`, [userId, pdfId]);
      return result;
    } catch (error) {
      console.error('Error in removeBookmark:', error);
      throw error;
    }
  },
  async getBookmarks(userId) {
    try {
      const [rows] = await promisePool.query(
        `SELECT b.*, p.title, p.description, p.file_name, p.created_at, p.updated_at
         FROM bookmarks b
         INNER JOIN pdfs p ON b.pdf_id = p.id
         WHERE b.user_id = ?`,
        [userId]
      );
      return rows;
    } catch (error) {
      console.error('Error in getBookmarks:', error);
      throw error;
    }
  },
  async getPurchaseByUserAndPdf(user_id, pdf_id) {
    try {
      const [rows] = await promisePool.query(`SELECT * FROM purchases WHERE user_id = ? AND pdf_id = ? LIMIT 1`, [user_id, pdf_id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error in getPurchaseByUserAndPdf:', error);
      throw error;
    }
  },
  async recordPurchase(purchaseData) {
    try {
      const { 
        user_id, 
        pdf_id, 
        amount, 
        payment_method, 
        transaction_id, 
        status = 'completed',
        currency = 'USD',
        payment_provider,
        billing_address,
        customer_email,
        metadata
      } = purchaseData;
      const [result] = await promisePool.query(
        `INSERT INTO purchases (
          user_id, pdf_id, amount, currency, payment_method, 
          payment_provider, transaction_id, status, billing_address, customer_email, metadata
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user_id, 
          pdf_id, 
          amount, 
          currency, 
          payment_method, 
          payment_provider, 
          transaction_id, 
          status,
          billing_address ? JSON.stringify(billing_address) : null,
          customer_email,
          metadata ? JSON.stringify(metadata) : null
        ]
      );
      return { id: result.insertId, ...purchaseData, transaction_id };
    } catch (error) {
      console.error('Error recording purchase:', error);
      throw error;
    }
  },
  async updatePurchaseReceipt(purchaseId, receiptPdfBuffer, receiptImageBuffer) {
    try {
      const [result] = await promisePool.query(
        `UPDATE purchases SET receipt_pdf = ?, receipt_image = ? WHERE id = ?`,
        [receiptPdfBuffer, receiptImageBuffer, purchaseId]
      );
      return result;
    } catch (error) {
      console.error('Error updating purchase receipt:', error);
      throw error;
    }
  },
  async getUserPurchases(userId) {
    try {
      const [rows] = await promisePool.query(
        `SELECT 
           p.*, pdf.title, pdf.description, pdf.price, pdf.cover_photo, u.username AS author_username
         FROM purchases p
         JOIN pdfs pdf ON p.pdf_id = pdf.id
         JOIN users u ON pdf.user_id = u.id
         WHERE p.user_id = ?
         ORDER BY p.purchase_date DESC`,
        [userId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting user purchases:', error);
      throw error;
    }
  },
  async getUserPurchasesWithPaymentDetails(userId) {
    try {
      const [rows] = await promisePool.query(
        `SELECT 
           p.id AS purchase_id, p.amount, p.currency, p.payment_method, p.payment_provider,
           p.transaction_id, p.status AS payment_status, p.purchase_date, p.receipt_pdf, p.receipt_image,
           p.customer_email, pdf.id AS pdf_id, pdf.title, pdf.description, pdf.price, pdf.cover_photo,
           u.username AS author_username, u.id AS author_id
         FROM purchases p
         JOIN pdfs pdf ON p.pdf_id = pdf.id
         JOIN users u ON pdf.user_id = u.id
         WHERE p.user_id = ?
         ORDER BY p.purchase_date DESC`,
        [userId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting user purchases with payment details:', error);
      throw error;
    }
  },
  async getPurchaseStats(userId) {
    try {
      const [rows] = await promisePool.query(
        `SELECT 
           COUNT(*) AS total_purchases,
           SUM(amount) AS total_spent,
           COUNT(DISTINCT pdf_id) AS unique_pdfs_purchased,
           MIN(purchase_date) AS first_purchase_date,
           MAX(purchase_date) AS last_purchase_date
         FROM purchases
         WHERE user_id = ? AND status = 'completed'`,
        [userId]
      );
      return rows[0];
    } catch (error) {
      console.error('Error getting purchase stats:', error);
      throw error;
    }
  },
  async getPurchaseSummary() {
    try {
      const [rows] = await promisePool.query(
        `SELECT 
           COUNT(*) AS totalPurchases,
           SUM(amount) AS totalRevenue,
           COUNT(DISTINCT user_id) AS uniqueCustomers
         FROM purchases
         WHERE status = 'completed'`
      );
      return rows[0];
    } catch (error) {
      console.error('Error in getPurchaseSummary:', error);
      throw error;
    }
  },
  async getPurchaseTrends(timeRange) {
    try {
      const [rows] = await promisePool.query(
        `SELECT 
           DATE(purchase_date) AS date,
           COUNT(*) AS purchases,
           SUM(amount) AS revenue
         FROM purchases
         WHERE purchase_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY DATE(purchase_date)
         ORDER BY date`,
        [parseInt(timeRange) || 30]
      );
      return rows;
    } catch (error) {
      console.error('Error in getPurchaseTrends:', error);
      throw error;
    }
  },
  async getUserPurchaseStats(userId) {
    try {
      const [rows] = await promisePool.query(
        `SELECT 
           COUNT(*) AS totalPurchases,
           SUM(amount) AS totalSpent,
           MIN(purchase_date) AS firstPurchase,
           MAX(purchase_date) AS lastPurchase
         FROM purchases
         WHERE user_id = ?`,
        [userId]
      );
      return rows[0];
    } catch (error) {
      console.error('Error in getUserPurchaseStats:', error);
      throw error;
    }
  },
  async getPurchaseReceipt(userId, pdfId) {
    try {
      const [rows] = await promisePool.query(
        `SELECT p.*, pdf.title AS pdfTitle, pdf.price AS pdfPrice
         FROM purchases p
         JOIN pdfs pdf ON p.pdf_id = pdf.id
         WHERE p.user_id = ? AND p.pdf_id = ?`,
        [userId, pdfId]
      );
      return rows[0];
    } catch (error) {
      console.error('Error in getPurchaseReceipt:', error);
      throw error;
    }
  },
  // NEW: Retrieve purchase by transaction ID.
  async getPurchaseByTransactionId(transactionId) {
    try {
      const query = 'SELECT * FROM purchases WHERE transaction_id = ?';
      const [rows] = await promisePool.query(query, [transactionId]);
      return (rows && rows.length > 0) ? rows[0] : null;
    } catch (error) {
      console.error('Error in getPurchaseByTransactionId:', error);
      throw error;
    }
  }
};

initializeDatabase().catch(console.error);

module.exports = {
  db: promisePool,
  helpers,
  CURRENT_TIMESTAMP,
  CURRENT_USER
};
