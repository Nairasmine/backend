// controllers/pdfRankingsController.js

const { db } = require('../config/db'); // Updated path

const getTopSellers = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    
    const [rows] = await db.query(
      `
      SELECT 
        u.username,
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
      GROUP BY u.username
      ORDER BY score DESC
      LIMIT ?
      `,
      [limit]
    );

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

    return res.json(rows);
  } catch (error) {
    console.error('Error fetching most selling books:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getTopSellers, getMostSellingBooks };
