const { db } = require('../config/db'); // Adjust the path as needed

/**
 * Verifies the upload fee payment and grants upload permission.
 * Expects: amount, paymentMethod, and reference in req.body.
 * The authenticated user ID is available as req.user.id (via the JWT middleware).
 */
const verifyUploadFeePayment = async (req, res) => {
  try {
    const userId = req.user.id; // JWT middleware provides this
    const { amount, paymentMethod, reference } = req.body;

    // Check that required fields are present.
    if (!userId || !amount || !paymentMethod || !reference) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment data: amount, paymentMethod, or reference.',
      });
    }

    // Verify that the payment amount is exactly 500 naira.
    if (parseFloat(amount) !== 500) {
      return res.status(402).json({
        success: false,
        message: 'Invalid payment amount. Expected amount is 500 naira.',
      });
    }

    // Update the user’s record to set the upload_fee_paid flag.
    const sql = 'UPDATE users SET upload_fee_paid = 1 WHERE id = ?';
    const [result] = await db.query(sql, [userId]);

    if (result && result.affectedRows > 0) {
      return res.status(200).json({
        success: true,
        message: 'Upload fee payment verified and upload permission granted.',
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to update payment status. Please try again.',
      });
    }
  } catch (error) {
    console.error('Error verifying upload fee payment:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error.',
    });
  }
};

/**
 * Retrieves the upload fee status for the current user.
 * Expects the authenticated user ID to be available in req.user.id.
 */
const getUploadFeeStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: user not found.',
      });
    }
    const [rows] = await db.query('SELECT upload_fee_paid FROM users WHERE id = ?', [userId]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }
    const hasPaid = rows[0].upload_fee_paid === 1;
    return res.status(200).json({
      success: true,
      upload_fee_paid: hasPaid,
    });
  } catch (error) {
    console.error('Error checking upload fee status:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during upload fee status check.',
    });
  }
};

module.exports = {
  verifyUploadFeePayment,
  getUploadFeeStatus,
};
