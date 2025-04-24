const mysql = require('mysql2');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const path = require('path');

// --- Constants ---
const CURRENT_TIMESTAMP = new Date().toISOString();
const CURRENT_USER = 'Nairasmine';
const UPLOAD_FEE_IDENTIFIER = -1;

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
    // Create users table with an additional column for last withdrawal date.
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
        reset_token_expires TIMESTAMP NULL,
        upload_fee_paid TINYINT(1) DEFAULT 0,
        last_withdrawal_at DATETIME DEFAULT NULL
      )
    `);

    // Create pdfs table.
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS pdfs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        file_name VARCHAR(255) NOT NULL,
        file_size INT NOT NULL,
        mime_type VARCHAR(100) DEFAULT 'application/pdf',
        cover_photo LONGBLOB,
        pdf_data LONGBLOB,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        download_count INT DEFAULT 0,
        status ENUM('active', 'deleted') DEFAULT 'active',
        visibility ENUM('public', 'private', 'paid') DEFAULT 'public',
        tags JSON,
        is_paid BOOLEAN DEFAULT FALSE,
        price DECIMAL(10,2) DEFAULT 0.00,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX (user_id),
        INDEX (title),
        INDEX (status),
        INDEX (visibility)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Create dummy PDF record for upload fee transactions.
    await promisePool.query(`
      INSERT IGNORE INTO pdfs (id, title, description, file_name, file_size, user_id, visibility, status)
      VALUES (?, 'Upload Fee', 'Special record for upload fee transactions', 'system.pdf', 0, 1, 'private', 'active')
    `, [UPLOAD_FEE_IDENTIFIER]);

    // Create purchases table.
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
        transaction_type ENUM('pdf_purchase', 'upload_fee') DEFAULT 'pdf_purchase',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE,
        INDEX (user_id),
        INDEX (pdf_id),
        INDEX (transaction_id),
        INDEX (purchase_date),
        INDEX (status),
        INDEX (transaction_type)
      ) ENGINE=InnoDB;
    `);

    // Create comments table.
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

    // Create pdf_ratings table.
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

    // Create download_history table.
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

    // Create bookmarks table.
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

    // Create withdrawals table for handling manual payout requests.
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        bank_name VARCHAR(255) NOT NULL,
        account_number VARCHAR(50) NOT NULL,
        account_name VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status ENUM('pending', 'paid', 'declined') DEFAULT 'pending',
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Attempt to add the last_withdrawal_at column (if running an update on an existing users table).
    try {
      await promisePool.query(`
        ALTER TABLE users ADD COLUMN last_withdrawal_at DATETIME DEFAULT NULL
      `);
      console.log("Column 'last_withdrawal_at' added successfully.");
    } catch (alterErr) {
      if (alterErr.code === 'ER_DUP_FIELDNAME') {
        console.log("Column 'last_withdrawal_at' already exists.");
      } else {
        console.error("Error adding last_withdrawal_at column:", alterErr);
      }
    }
    
    // Insert default admin user if no user exists.
    const [userCountResult] = await promisePool.query('SELECT COUNT(*) AS count FROM users');
    if (userCountResult[0].count === 0) {
      const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Okikiokiki123@', 10);
      await promisePool.query(
        `INSERT INTO users (
          username,
          password,
          role,
          email,
          created_at,
          status
        ) VALUES (?, ?, 'admin', ?, NOW(), 'active')`,
        [CURRENT_USER, hashedPassword, 'admin@example.com']
      );
      console.log('Default admin user created because no users existed.');
    } else {
      console.log('Users already exist; skipping default admin creation.');
    }

    console.log('Database and tables initialized successfully');
    return promisePool;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

// Helper functions for various database operations.
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
        `UPDATE pdfs SET download_count = download_count + 1 WHERE id = ?`,
        [pdfId]
      );
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
  async recordPurchase(purchaseData) {
    try {
      const { 
        user_id, 
        pdf_id, 
        amount, 
        currency = 'USD', 
        payment_method, 
        payment_provider = null, 
        transaction_id, 
        status, 
        billing_address = null, 
        customer_email = null, 
        metadata = null, 
        transaction_type = pdf_id === 'upload_permission' ? 'upload_fee' : 'pdf_purchase'
      } = purchaseData;

      let finalPdfId;
      if (pdf_id === 'upload_permission' || transaction_type === 'upload_fee') {
        finalPdfId = UPLOAD_FEE_IDENTIFIER;
      } else if (transaction_type === 'pdf_purchase') {
        if (!pdf_id || isNaN(parseInt(pdf_id)) || parseInt(pdf_id) <= 0) {
          throw new Error('Invalid PDF id for a PDF purchase.');
        }
        finalPdfId = pdf_id;
      } else {
        finalPdfId = pdf_id;
      }

      const [result] = await promisePool.query(
        `INSERT INTO purchases (
          user_id, pdf_id, amount, currency, payment_method, 
          payment_provider, transaction_id, status, billing_address, 
          customer_email, metadata, transaction_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user_id, 
          finalPdfId, 
          amount, 
          currency, 
          payment_method, 
          payment_provider, 
          transaction_id, 
          status, 
          billing_address, 
          customer_email, 
          metadata, 
          transaction_type
        ]
      );

      if ((transaction_type === 'upload_fee' || pdf_id === 'upload_permission') && status === 'completed') {
        await promisePool.query(
          `UPDATE users SET upload_fee_paid = 1 WHERE id = ?`,
          [user_id]
        );
      }

      return { id: result.insertId, ...purchaseData, transaction_id };
    } catch (error) {
      console.error('Error in recordPurchase:', error);
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
  async getPurchaseByTransactionId(transactionId) {
    try {
      const [rows] = await promisePool.query(
        `SELECT * FROM purchases WHERE transaction_id = ?`,
        [transactionId]
      );
      return rows[0];
    } catch (error) {
      console.error('Error in getPurchaseByTransactionId:', error);
      throw error;
    }
  },
  async getPurchaseByUserAndPdf(userId, pdfId) {
    try {
      const [rows] = await promisePool.query(
        `SELECT * FROM purchases WHERE user_id = ? AND pdf_id = ? LIMIT 1`,
        [userId, pdfId]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error in getPurchaseByUserAndPdf:', error);
      throw error;
    }
  },
  async getUserPurchasesWithPaymentDetails(userId) {
    try {
      const [rows] = await promisePool.query(
        `SELECT 
           p.id AS purchase_id, p.amount, p.currency, p.payment_method, p.payment_provider,
           p.transaction_id, p.status AS payment_status, p.purchase_date, p.receipt_pdf, p.receipt_image,
           p.customer_email, pdf.id AS pdf_id, pdf.title, pdf.description, 
           CASE WHEN p.transaction_type = 'upload_fee' THEN 'Upload Fee' ELSE pdf.price END AS price,
           pdf.cover_photo,
           CASE WHEN p.transaction_type = 'upload_fee' THEN 'System' ELSE u.username END AS author_username,
           CASE WHEN p.transaction_type = 'upload_fee' THEN 1 ELSE u.id END AS author_id,
           p.transaction_type
         FROM purchases p
         JOIN pdfs pdf ON p.pdf_id = pdf.id
         LEFT JOIN users u ON pdf.user_id = u.id
         WHERE p.user_id = ?
         ORDER BY p.purchase_date DESC`,
        [userId]
      );
      return rows;
    } catch (error) {
      console.error("Error in getUserPurchasesWithPaymentDetails:", error);
      throw error;
    }
  },
  async getPurchaseStats(userId) {
    try {
      const [rows] = await promisePool.query(
        `SELECT 
           COUNT(*) AS total_purchases,
           SUM(amount) AS total_spent,
           COUNT(DISTINCT CASE WHEN transaction_type = 'pdf_purchase' THEN pdf_id ELSE NULL END) AS unique_pdfs_purchased,
           MIN(purchase_date) AS first_purchase_date,
           MAX(purchase_date) AS last_purchase_date,
           SUM(CASE WHEN transaction_type = 'upload_fee' THEN 1 ELSE 0 END) AS upload_fee_count
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
           COUNT(DISTINCT user_id) AS uniqueCustomers,
           SUM(CASE WHEN transaction_type = 'upload_fee' THEN 1 ELSE 0 END) AS uploadFeeCount,
           SUM(CASE WHEN transaction_type = 'upload_fee' THEN amount ELSE 0 END) AS uploadFeeRevenue,
           SUM(CASE WHEN transaction_type = 'pdf_purchase' THEN 1 ELSE 0 END) AS pdfPurchaseCount,
           SUM(CASE WHEN transaction_type = 'pdf_purchase' THEN amount ELSE 0 END) AS pdfPurchaseRevenue
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
           SUM(amount) AS revenue,
           SUM(CASE WHEN transaction_type = 'upload_fee' THEN 1 ELSE 0 END) AS uploadFeeCount,
           SUM(CASE WHEN transaction_type = 'upload_fee' THEN amount ELSE 0 END) AS uploadFeeRevenue,
           SUM(CASE WHEN transaction_type = 'pdf_purchase' THEN 1 ELSE 0 END) AS pdfPurchaseCount,
           SUM(CASE WHEN transaction_type = 'pdf_purchase' THEN amount ELSE 0 END) AS pdfPurchaseRevenue
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
           MAX(purchase_date) AS lastPurchase,
           SUM(CASE WHEN transaction_type = 'upload_fee' THEN 1 ELSE 0 END) AS uploadFeeCount,
           SUM(CASE WHEN transaction_type = 'upload_fee' THEN amount ELSE 0 END) AS uploadFeeSpent,
           SUM(CASE WHEN transaction_type = 'pdf_purchase' THEN 1 ELSE 0 END) AS pdfPurchaseCount,
           SUM(CASE WHEN transaction_type = 'pdf_purchase' THEN amount ELSE 0 END) AS pdfPurchaseSpent
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
        `SELECT p.*, pdf.title AS pdfTitle, 
         CASE WHEN p.transaction_type = 'upload_fee' THEN 'Upload Fee' ELSE pdf.price END AS pdfPrice
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
  async recordUploadFee(userId, amount, paymentMethod, transactionId, paymentProvider = null) {
    try {
      return await this.recordPurchase({
        user_id: userId,
        pdf_id: UPLOAD_FEE_IDENTIFIER,
        amount,
        payment_method: paymentMethod,
        transaction_id: transactionId,
        payment_provider: paymentProvider,
        transaction_type: 'upload_fee'
      });
    } catch (error) {
      console.error('Error recording upload fee:', error);
      throw error;
    }
  },
  async hasUserPaidUploadFee(userId) {
    try {
      const [rows] = await promisePool.query(
        `SELECT upload_fee_paid FROM users WHERE id = ?`,
        [userId]
      );
      return rows.length > 0 && rows[0].upload_fee_paid === 1;
    } catch (error) {
      console.error('Error checking upload fee payment status:', error);
      throw error;
    }
  }
};

initializeDatabase().catch(console.error);

module.exports = {
  db: promisePool,
  helpers,
  CURRENT_TIMESTAMP,
  CURRENT_USER,
  UPLOAD_FEE_IDENTIFIER
};
