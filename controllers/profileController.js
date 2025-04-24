const { db } = require('../config/db');

const profileController = {
  /**
   * Retrieves the current user's profile details, including download history.
   */
  async getProfile(req, res) {
    const userId = req.user.id; // Provided by the authentication middleware.
    try {
      // Retrieve the user record including the profile_pic BLOB.
      const [users] = await db.query(
        `SELECT id, username, email, role, created_at, last_login, profile_pic, overall_rating 
         FROM users 
         WHERE id = ?`,
        [userId]
      );

      if (!users || users.length === 0) {
        return res.status(404).json({ message: 'User not found.' });
      }
      const user = users[0];

      // Convert profile_pic binary data to a Base64 string if available.
      user.profilePicBase64 = user.profile_pic ? user.profile_pic.toString('base64') : null;
      // Remove the raw binary field from the response.
      delete user.profile_pic;

      // Query the download_history for this user, including the PDF payment status.
      const [downloads] = await db.query(
        `
        SELECT 
          dh.id, 
          dh.pdf_id, 
          dh.pdf_title, 
          dh.downloaded_at, 
          dh.ip_address, 
          dh.user_agent,
          CASE WHEN p.is_paid = 1 THEN 'paid' ELSE 'free' END AS payment_status
        FROM download_history dh
        LEFT JOIN pdfs p ON dh.pdf_id = p.id
        WHERE dh.user_id = ?
        `,
        [userId]
      );

      // Attach the download history to the user object.
      user.downloadHistory = downloads;

      res.status(200).json(user);
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ message: 'Error fetching profile.' });
    }
  },

  /**
   * Updates the current user's profile.
   */
  async updateProfile(req, res) {
    const userId = req.user.id;
    const { username, email } = req.body;

    // Ensure both username and email are provided.
    if (!username || !email) {
      return res.status(400).json({ message: 'Username and email are required.' });
    }

    try {
      // If a new profile picture is provided (e.g., via Multer), update it.
      if (req.file && req.file.buffer) {
        await db.query(
          `UPDATE users SET username = ?, email = ?, profile_pic = ? WHERE id = ?`,
          [username, email, req.file.buffer, userId]
        );
      } else {
        // Otherwise, update only the username and email.
        await db.query(
          `UPDATE users SET username = ?, email = ? WHERE id = ?`,
          [username, email, userId]
        );
      }
      res.status(200).json({ message: 'Profile updated successfully.' });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ message: 'Error updating profile.' });
    }
  },

  /**
   * Retrieves the user's download and upload history along with performance metrics.
   * The upload history now includes metrics such as download_count, average_rating, rating_count,
   * and the payment_status indicating if the PDF is paid or free.
   */
  async getHistory(req, res) {
    const userId = req.user.id;
    try {
      // Query download history including the PDF payment status.
      const [downloads] = await db.query(
        `
        SELECT 
          dh.id, 
          dh.pdf_id, 
          dh.pdf_title, 
          dh.downloaded_at, 
          dh.ip_address, 
          dh.user_agent,
          CASE WHEN p.is_paid = 1 THEN 'paid' ELSE 'free' END AS payment_status
        FROM download_history dh
        LEFT JOIN pdfs p ON dh.pdf_id = p.id
        WHERE dh.user_id = ?
        `,
        [userId]
      );

      // Query upload history along with metrics from the pdf_ratings table and payment status.
      const [uploads] = await db.query(
        `
        SELECT 
          p.id,
          p.title,
          p.download_count,
          p.created_at,
          p.price,
          CASE WHEN p.is_paid = 1 THEN 'paid' ELSE 'free' END AS payment_status,
          COALESCE(AVG(pr.rating), 0) AS average_rating,
          COUNT(pr.id) AS rating_count
        FROM pdfs p
        LEFT JOIN pdf_ratings pr ON p.id = pr.pdf_id
        WHERE p.user_id = ? AND p.status = 'active'
        GROUP BY p.id
        ORDER BY p.created_at DESC
        `,
        [userId]
      );

      // Aggregate overall performance metrics across all uploads.
      let totalDownloads = 0;
      let totalRatingsSum = 0;
      let totalRatingsCount = 0;
      uploads.forEach((pdf) => {
        totalDownloads += parseInt(pdf.download_count, 10) || 0;
        totalRatingsSum += (parseFloat(pdf.average_rating) * pdf.rating_count) || 0;
        totalRatingsCount += pdf.rating_count || 0;
      });
      const overallAverageRating =
        totalRatingsCount > 0 ? (totalRatingsSum / totalRatingsCount).toFixed(2) : 'N/A';

      res.status(200).json({
        downloads,
        uploads,
        overallMetrics: {
          totalDownloads,
          overallAverageRating,
        },
      });
    } catch (error) {
      console.error('Error fetching history:', error);
      res.status(500).json({ message: 'Error fetching history.' });
    }
  },

  /**
   * Retrieves the upload fee permission status for the current user.
   * This method checks whether the user has paid their upload fee.
   * Assumes that your "users" table has a column named "upload_fee_paid".
   */
  async getUploadPermission(req, res) {
    const userId = req.user.id;
    try {
      const [users] = await db.query(
        'SELECT upload_fee_paid FROM users WHERE id = ?',
        [userId]
      );
      if (!users || users.length === 0) {
        return res.status(404).json({ message: 'User not found.' });
      }
      // Assuming a value of 1 means the fee has been paid.
      const hasPaid = users[0].upload_fee_paid === 1;
      res.status(200).json({ hasPaid });
    } catch (error) {
      console.error('Error checking upload fee status:', error);
      res.status(500).json({ message: 'Error checking upload fee status.' });
    }
  },
};

module.exports = profileController;
