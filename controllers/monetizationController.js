// controllers/monetizationController.js
const { db } = require('../config/db.js');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const withdrawEarnings = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { amount, recipient } = req.body;
    if (!userId || !amount || parseFloat(amount) <= 0 || !recipient) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid withdrawal request. Please provide a valid amount and recipient code." 
      });
    }

    // Initiate a withdrawal via Paystack's Transfer API (or simulation when in development)
    const response = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
      },
      body: JSON.stringify({
         source: "balance",
         amount: parseFloat(amount) * 100,
         recipient: recipient,
         reason: "Withdrawal request"
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(400).json({ success: false, message: data.message || "Withdrawal failed" });
    }

    // After a successful withdrawal, update the user's last withdrawal time
    await db.query(`UPDATE users SET last_withdrawal_at = NOW() WHERE id = ?`, [userId]);

    return res.status(200).json({
       success: true,
       message: "Withdrawal initiated successfully",
       transfer: data.data
    });
  } catch (error) {
    console.error("Error in withdrawEarnings:", error);
    return res.status(500).json({ 
      success: false,
      message: error.message || "Error processing withdrawal."
    });
  }
};

const getMonetizationDetails = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: user not found.' });
    }

    // Calculate free earnings (free download count x 1 naira)
    const [freeRows] = await db.query(
      `SELECT COALESCE(COUNT(dh.id), 0) AS freeDownloads 
       FROM download_history dh 
       JOIN pdfs p ON dh.pdf_id = p.id
       WHERE p.user_id = ? AND p.is_paid = false`,
      [userId]
    );
    const freeDownloads = parseInt(freeRows[0].freeDownloads, 10) || 0;
    const freeEarnings = freeDownloads * 1;

    // Calculate paid earnings.
    const [paidRows] = await db.query(
      `SELECT COALESCE(SUM(p.amount), 0) AS paidEarnings
       FROM purchases p
       JOIN pdfs pdf ON p.pdf_id = pdf.id
       WHERE pdf.user_id = ? AND p.transaction_type = 'pdf_purchase' AND p.status = 'completed'`,
      [userId]
    );
    const paidEarnings = parseFloat(paidRows[0].paidEarnings) || 0;
    const totalEarnings = freeEarnings + paidEarnings;

    // Subtract withdrawals (both pending and paid) to get available balance.
    const [withdrawalRows] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS withdrawnTotal
       FROM withdrawals 
       WHERE user_id = ? AND status IN ('pending', 'paid')`,
      [userId]
    );
    const withdrawnTotal = parseFloat(withdrawalRows[0].withdrawnTotal) || 0;
    const availableBalance = totalEarnings - withdrawnTotal;
    
    return res.status(200).json({
      success: true,
      freeDownloads,
      freeEarnings,
      paidEarnings,
      totalEarnings: availableBalance,
    });
  } catch (error) {
    console.error("Error in getMonetizationDetails:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error retrieving monetization details.",
    });
  }
};


module.exports = {
  getMonetizationDetails,
  withdrawEarnings,
};
