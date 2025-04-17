const { helpers } = require('../config/db.js');

const verifyPayment = async (req, res) => {
  try {
    // Use the authenticated user if available; otherwise, get from the request body.
    const userId = req.user ? req.user.id : req.body.userId;
    const { reference, pdfId, amount, payment_method } = req.body;
    
    // Validate required fields.
    if (!userId || !pdfId || !amount || !reference) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required purchase details (userId, pdfId, amount, or reference).' 
      });
    }
    
    console.log(`Verifying payment for PDF ${pdfId} with reference: ${reference} by user: ${userId}`);
    
    // Simulated payment verification (replace with your real verification logic)
    const paymentVerified = true;
    if (!paymentVerified) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment verification failed.' 
      });
    }
    
    // OPTIONAL: Check if a purchase record already exists for one-time payments.
    let existingPurchase;
    if (typeof helpers.getPurchaseByUserAndPdf === 'function') {
      existingPurchase = await helpers.getPurchaseByUserAndPdf(userId, pdfId);
      if (existingPurchase) {
        return res.json({
          success: true,
          message: 'Purchase already recorded.',
          purchase: existingPurchase
        });
      }
    }
    
    // Record the purchase in the database (one-time payment)
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
      message: 'Payment verified and purchase recorded.',
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

const getPurchaseStatus = async (req, res) => {
  try {
    // Use authenticated user if available, or fallback to a query parameter.
    const userId = req.user ? req.user.id : req.query.userId;
    const pdfId = req.params.pdfId;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: user not found.' });
    }
    
    // Check for an existing purchase record.
    if (typeof helpers.getPurchaseByUserAndPdf !== 'function') {
      console.error("getPurchaseByUserAndPdf function is not implemented");
      return res.status(501).json({ message: "Purchase status check not implemented on server." });
    }
    
    const purchase = await helpers.getPurchaseByUserAndPdf(userId, pdfId);
    return res.json({ purchased: purchase ? true : false });
  } catch (error) {
    console.error("Error checking purchase status:", error);
    return res.status(500).json({ message: "An error occurred while checking purchase status." });
  }
};

module.exports = { verifyPayment, getPurchaseStatus };
