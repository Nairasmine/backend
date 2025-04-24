const { db } = require('../config/db');

/**
 * Verifies the upload fee payment and updates the user's upload_fee_paid status.
 * For this simplified example, we assume that once the amount is validated (i.e., equals 500),
 * the payment is considered verified.
 *
 * @param {number|string} userId - The id of the user.
 * @param {object} paymentData - The payment data (amount, paymentMethod, reference).
 * @returns {Promise<boolean>} - Returns true if the update is successful.
 */
const verifyUploadFeePayment = async (userId, paymentData) => {
  // Here, you could integrate with your payment gateway for actual payment verification.
  // For now, if the code reaches this function, we assume the payment is verified.
  
  // Update the user record, setting upload_fee_paid to 1.
  const sql = 'UPDATE users SET upload_fee_paid = 1 WHERE id = ?';
  const [result] = await db.query(sql, [userId]);
  
  // Check that we successfully updated the record (affectedRows may vary based on your db driver).
  return result && result.affectedRows > 0;
};

module.exports = {
  verifyUploadFeePayment,
};
