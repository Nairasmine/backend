// controllers/usersController.js
const { db } = require('../config/db.js');

/**
 * Retrieves a list of users along with statistics:
 * - pdfCount: number of PDFs the user has created.
 * - downloadCount: total downloads of the user's PDFs.
 * - purchaseCount: total completed purchases of the user's PDFs.
 * - avgRating: the average rating of the user's PDFs (from the pdf_ratings table).
 *
 * The rankingScore is computed as:
 *   (purchaseCount * 5) + (downloadCount * 2) + (avgRating * 3)
 *
 * Users are ordered in descending order based on rankingScore.
 */
const getUserList = async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id,
        u.username,
        u.email,
        (SELECT COUNT(*) FROM pdfs p WHERE p.user_id = u.id) AS pdfCount,
        (SELECT COUNT(*) FROM download_history dh 
           JOIN pdfs p ON dh.pdf_id = p.id 
           WHERE p.user_id = u.id) AS downloadCount,
        (SELECT COUNT(*) FROM purchases pur 
           JOIN pdfs p ON pur.pdf_id = p.id 
           WHERE p.user_id = u.id AND pur.status = 'completed') AS purchaseCount,
        (SELECT IFNULL(AVG(pr.rating), 0) 
           FROM pdf_ratings pr 
           JOIN pdfs p ON pr.pdf_id = p.id 
           WHERE p.user_id = u.id) AS avgRating,
        (
          ((SELECT COUNT(*) FROM purchases pur 
              JOIN pdfs p ON pur.pdf_id = p.id 
              WHERE p.user_id = u.id AND pur.status = 'completed') * 5)
          +
          ((SELECT COUNT(*) FROM download_history dh 
              JOIN pdfs p ON dh.pdf_id = p.id 
              WHERE p.user_id = u.id) * 2)
          +
          ((SELECT IFNULL(AVG(pr.rating), 0) 
              FROM pdf_ratings pr 
              JOIN pdfs p ON pr.pdf_id = p.id 
              WHERE p.user_id = u.id) * 3)
        ) AS rankingScore
      FROM users u
      ORDER BY rankingScore DESC
    `;
    const [rows] = await db.query(query);
    return res.status(200).json({
      success: true,
      users: rows
    });
  } catch (error) {
    console.error("Error in getUserList:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error retrieving user list."
    });
  }
};

module.exports = { getUserList };
