const { db } = require('../config/db');

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

    // Convert profile_pic blob to a Base64 string.
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

    // (Optional) Format overall_rating if provided.
    if (user.overall_rating !== undefined && user.overall_rating !== null) {
      user.overall_rating = Number(user.overall_rating).toFixed(2);
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

module.exports = {
  getProfileByUsername,
};
