const { helpers } = require('../config/db.js');

const verifyPayment = async (req, res) => {
  try {
    // Use authenticated user info if available
    const userId = req.user ? req.user.id : req.body.userId;
    const { reference, pdfId, amount, payment_method } = req.body;
    
    // Validate required fields
    if (!userId || !pdfId || !amount || !reference) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required purchase details (userId, pdfId, amount, or reference).' 
      });
    }
    
    console.log(`Verifying payment for reference: ${reference} by user: ${userId}`);
    
    // Simulated payment verification (replace with real logic if needed)
    const paymentVerified = true;
    if (!paymentVerified) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment verification failed.' 
      });
    }
    
    // Record the payment (purchase) in the database
    const purchaseResult = await helpers.recordPurchase({
      user_id: userId,
      pdf_id: pdfId,
      amount: amount,
      payment_method: payment_method || 'unknown',
      transaction_id: reference,
      status: 'completed'
    });
    
    return res.json({
      success: true,
      message: 'Payment verified and purchase recorded',
      purchase: purchaseResult
    });
    
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Payment verification failed due to a server error.'
    });
  }
};

module.exports = { verifyPayment };
