// UserController.js

const { db } = require('../config/db');

/**
 * Retrieve a public user profile by username.
 *
 * This function queries the user's basic information from the database,
 * converts the profile picture (if present) from a blob into a Base64 string,
 * and then queries for the PDFs posted by that user—including rating statistics
 * and the total download count.
 *
 * @param {Object} req - Express request object; expects req.params.username.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Responds with JSON data containing the user profile.
 */
const getProfileByUsername = async (req, res) => {
  const { username } = req.params;

  try {
    // Query the user's basic information.
    const [userRows] = await db.query(
      `SELECT id, username, profile_pic, overall_rating, email 
       FROM users 
       WHERE username = ?`,
      [username]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = userRows[0];

    // Convert the profile_pic blob to a Base64 string.
    user.profilePicBase64 = user.profile_pic ? user.profile_pic.toString('base64') : null;
    delete user.profile_pic;

    // Query PDFs posted by this user including rating statistics and download_count.
    const [pdfRows] = await db.query(
      `SELECT 
         p.id, 
         p.title, 
         p.description, 
         p.file_name, 
         p.created_at,
         p.download_count,
         COALESCE(AVG(pr.rating), 0) AS average_rating,
         COUNT(pr.rating) AS rating_count
       FROM pdfs p 
       LEFT JOIN pdf_ratings pr ON p.id = pr.pdf_id
       WHERE p.user_id = ?
       GROUP BY p.id, p.download_count`,
      [user.id]
    );

    // Attach the list of PDFs to the user object.
    user.postedPdfs = pdfRows;

    // Compute the total download count from all posted PDFs.
    user.total_download_count = (pdfRows && pdfRows.length > 0)
      ? pdfRows.reduce((sum, pdf) => sum + (Number(pdf.download_count) || 0), 0)
      : 0;

    // Format overall_rating if provided.
    if (user.overall_rating !== undefined && user.overall_rating !== null) {
      user.overall_rating = Number(user.overall_rating).toFixed(2);
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

/**
 * Retrieve the profile of the currently authenticated user.
 *
 * This function expects that an authentication middleware has verified the JWT
 * and attached the user details to req.user (with at least the user ID).
 * It then retrieves the user information from the database, converts any blob
 * (like profile_pic) into a Base64 string, and even attaches PDF details if desired.
 *
 * @param {Object} req - Express request object; expects req.user.id.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Responds with JSON data containing the current user's profile.
 */
const getCurrentUser = async (req, res) => {
  try {
    // Ensure that the authentication middleware has set req.user.
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Unauthorized: No user information found.' });
    }

    // Query the user's basic information using the ID from req.user.
    const [userRows] = await db.query(
      `SELECT id, username, profile_pic, overall_rating, email 
       FROM users 
       WHERE id = ?`,
      [req.user.id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = userRows[0];

    // Convert the profile_pic blob to a Base64 string.
    user.profilePicBase64 = user.profile_pic ? user.profile_pic.toString('base64') : null;
    delete user.profile_pic;

    // (Optional) Retrieve PDFs posted by this user.
    const [pdfRows] = await db.query(
      `SELECT 
         p.id, 
         p.title, 
         p.description, 
         p.file_name, 
         p.created_at,
         p.download_count,
         COALESCE(AVG(pr.rating), 0) AS average_rating,
         COUNT(pr.rating) AS rating_count
       FROM pdfs p 
       LEFT JOIN pdf_ratings pr ON p.id = pr.pdf_id
       WHERE p.user_id = ?
       GROUP BY p.id, p.download_count`,
      [user.id]
    );
    user.postedPdfs = pdfRows;
    user.total_download_count = (pdfRows && pdfRows.length > 0)
      ? pdfRows.reduce((sum, pdf) => sum + (Number(pdf.download_count) || 0), 0)
      : 0;

    if (user.overall_rating !== undefined && user.overall_rating !== null) {
      user.overall_rating = Number(user.overall_rating).toFixed(2);
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching current user:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

module.exports = {
  getProfileByUsername,
  getCurrentUser,
};
