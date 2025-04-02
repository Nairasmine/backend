const { db } = require('../config/db');

const profileController = {
  // Retrieves the current user's profile details, including download history.
  async getProfile(req, res) {
    const userId = req.user.id; // Provided by the authentication middleware
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

      // Query the download_history for this user with the pdf_title.
      const [downloads] = await db.query(
        `SELECT id, pdf_id, pdf_title, downloaded_at, ip_address, user_agent 
         FROM download_history 
         WHERE user_id = ?`,
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

  // Updates the current user's profile.
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
   * Retrieves the user's download history and the upload (PDF) history with performance metrics.
   * The upload history includes for each PDF:
   *  - download_count
   *  - average_rating (based on ratings in pdf_ratings)
   *  - the number of ratings (rating_count)
   * In addition, aggregated overall metrics are computed.
   */
  async getHistory(req, res) {
    const userId = req.user.id;
    try {
      // Query download history including the pdf_title.
      const [downloads] = await db.query(
        `SELECT id, pdf_id, pdf_title, downloaded_at, ip_address, user_agent 
         FROM download_history 
         WHERE user_id = ?`,
        [userId]
      );

      // Query upload history along with metrics from the pdf_ratings table.
      const [uploads] = await db.query(
        `
        SELECT 
          p.id,
          p.title,
          p.download_count,
          p.created_at,
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
};

module.exports = profileController;
