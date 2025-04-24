// controllers/withdrawalController.js
const { db } = require('../config/db.js');

/**
 * Creates a new withdrawal request.
 * Expects the following in req.body:
 *  - amount: A positive number
 *  - bank_name, account_number, account_name: Strings for bank details.
 * The userId is extracted from req.user (attached by authentication middleware) or falls back to req.body.userId.
 */
const createWithdrawal = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { amount, bank_name, account_number, account_name } = req.body;

    // Validate required inputs.
    if (
      !userId ||
      !amount ||
      parseFloat(amount) <= 0 ||
      !bank_name ||
      !account_number ||
      !account_name
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal request. Please provide a user ID, a positive amount, and complete bank details.",
      });
    }

    // Insert the withdrawal request. (Assumes a default value for requested_at is defined in your table.)
    const [result] = await db.query(
      `INSERT INTO withdrawals (user_id, bank_name, account_number, account_name, amount)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, bank_name, account_number, account_name, amount]
    );

    return res.status(201).json({
      success: true,
      message: "Withdrawal request submitted successfully.",
      withdrawalId: result.insertId,
    });
  } catch (error) {
    console.error("Error creating withdrawal request:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error creating withdrawal request.",
    });
  }
};

/**
 * Lists withdrawal requests.
 * If a status query parameter is provided, only withdrawals matching that status are returned.
 * Additionally, if a userId query parameter is provided, the endpoint calculates that user's earnings
 * (using logic similar to the monetization controller) and includes them in the response.
 */
const listWithdrawals = async (req, res) => {
  try {
    const status = req.query.status; // to filter withdrawals by status
    const userIdForEarnings = req.query.userId; // if provided, include user earnings in the response
    
    let query = `
      SELECT w.*, u.username, u.email 
      FROM withdrawals w 
      JOIN users u ON w.user_id = u.id
    `;
    const params = [];

    if (status) {
      query += ` WHERE w.status = ?`;
      params.push(status);
    }

    // Order by the requested_at timestamp in descending order.
    query += ` ORDER BY w.requested_at DESC`;

    const [rows] = await db.query(query, params);

    // If userId is provided, compute the user's earnings using the same logic as in getMonetizationDetails.
    if (userIdForEarnings) {
      // Calculate free earnings.
      const [freeRows] = await db.query(
        `SELECT COALESCE(COUNT(dh.id), 0) AS freeDownloads 
         FROM download_history dh 
         JOIN pdfs p ON dh.pdf_id = p.id
         WHERE p.user_id = ? AND p.is_paid = false`,
        [userIdForEarnings]
      );
      const freeDownloads = parseInt(freeRows[0].freeDownloads, 10) || 0;
      const freeEarnings = freeDownloads * 1;

      // Calculate paid earnings.
      const [paidRows] = await db.query(
        `SELECT COALESCE(SUM(p.amount), 0) AS paidEarnings
         FROM purchases p
         JOIN pdfs pdf ON p.pdf_id = pdf.id
         WHERE pdf.user_id = ? AND p.transaction_type = 'pdf_purchase' AND p.status = 'completed'`,
        [userIdForEarnings]
      );
      const paidEarnings = parseFloat(paidRows[0].paidEarnings) || 0;

      const totalEarnings = freeEarnings + paidEarnings;

      // Subtract withdrawals (both pending and paid) to get the available balance.
      const [withdrawalRows] = await db.query(
        `SELECT COALESCE(SUM(amount), 0) AS withdrawnTotal
         FROM withdrawals 
         WHERE user_id = ? AND status IN ('pending', 'paid')`,
        [userIdForEarnings]
      );
      const withdrawnTotal = parseFloat(withdrawalRows[0].withdrawnTotal) || 0;
      const availableBalance = totalEarnings - withdrawnTotal;

      return res.status(200).json({
        success: true,
        withdrawals: rows,
        earnings: {
          freeDownloads,
          freeEarnings,
          paidEarnings,
          availableBalance
        }
      });
    } else {
      return res.status(200).json({
        success: true,
        withdrawals: rows
      });
    }
  } catch (error) {
    console.error("Error listing withdrawals:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error listing withdrawals.",
    });
  }
};

/**
 * Updates the status of a specified withdrawal.
 * Expects the following in req.params and req.body:
 *  - id: The withdrawal ID to update.
 *  - status: The new status (must be either 'paid' or 'declined').
 * If setting status to 'paid', the processed_at timestamp is automatically updated to NOW().
 */
const updateWithdrawalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // Expected values: 'paid' or 'declined'
    
    // Validate that both an ID and a valid status are provided.
    if (!id || !status || (status !== 'paid' && status !== 'declined')) {
      return res.status(400).json({
        success: false,
        message: "Invalid request. Please provide a valid withdrawal ID and status ('paid' or 'declined').",
      });
    }

    const [result] = await db.query(
      `UPDATE withdrawals 
       SET status = ?, processed_at = NOW() 
       WHERE id = ?`,
      [status, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal request not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Withdrawal status updated successfully.",
    });
  } catch (error) {
    console.error("Error updating withdrawal status:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error updating withdrawal status.",
    });
  }
};

module.exports = { createWithdrawal, listWithdrawals, updateWithdrawalStatus };
