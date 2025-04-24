// paymentController.js
const { helpers, db } = require('../config/db.js');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { createCanvas, loadImage } = require('canvas');

/**
 * Generates a dynamic receipt PDF that includes purchase details and a QR code.
 * @param {Object} purchase - The purchase record.
 * @param {Object} userInfo - Contains user details like username and email.
 * @returns {Promise<Buffer>} - The PDF data as a Buffer.
 */
async function generateReceiptPdf(purchase, userInfo) {
  return new Promise((resolve, reject) => {
    try {
      const receiptData = {
        transactionId: purchase.transaction_id,
        userId: purchase.user_id,
        username: userInfo.username,
        customerEmail: userInfo.email,
        pdfId: purchase.pdf_id,
        amount: purchase.amount,
        paymentMethod: purchase.payment_method,
        purchaseDate: purchase.purchase_date,
      };
      const qrData = JSON.stringify(receiptData);

      // Generate a QR code data URL with high error correction.
      QRCode.toDataURL(qrData, { errorCorrectionLevel: 'H' }, (err, qrDataUrl) => {
        if (err) return reject(err);

        // Convert the QR code data URL into a Buffer.
        const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
        const qrBuffer = Buffer.from(base64Data, 'base64');

        // Create a new PDF document.
        const doc = new PDFDocument();
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Build the PDF content.
        doc.fontSize(20).text('Receipt', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12)
          .text(`Transaction ID: ${purchase.transaction_id}`)
          .text(`User ID: ${purchase.user_id}`)
          .text(`Username: ${userInfo.username}`)
          .text(`Email: ${userInfo.email}`)
          .text(`PDF ID: ${purchase.pdf_id}`)
          .text(`Amount: ₦${purchase.amount}`)
          .text(`Payment Method: ${purchase.payment_method}`)
          .text(`Purchase Date: ${purchase.purchase_date || new Date().toISOString()}`);
        doc.moveDown();
        doc.image(qrBuffer, { width: 100, align: 'center' });
        doc.moveDown();
        doc.fontSize(10)
          .text('Scan the QR code to view full receipt details (in JSON)', { align: 'center' });
        doc.end();
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generates a receipt image (PNG) that includes purchase details and a QR code.
 * @param {Object} purchase - The purchase record.
 * @param {Object} userInfo - User information.
 * @returns {Promise<Buffer>} - The PNG image as a Buffer.
 */
async function generateReceiptImage(purchase, userInfo) {
  const receiptData = {
    transactionId: purchase.transaction_id,
    userId: purchase.user_id,
    username: userInfo.username,
    customerEmail: userInfo.email,
    pdfId: purchase.pdf_id,
    amount: purchase.amount,
    paymentMethod: purchase.payment_method,
    purchaseDate: purchase.purchase_date,
  };

  const qrDataString = JSON.stringify(receiptData);
  const qrDataUrl = await QRCode.toDataURL(qrDataString, { errorCorrectionLevel: 'H' });
  const canvasWidth = 500;
  const canvasHeight = 400;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // Draw background.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Add title.
  ctx.fillStyle = '#000000';
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Receipt', canvasWidth / 2, 30);

  // Write purchase details.
  ctx.font = '14px Arial';
  ctx.textAlign = 'left';
  const margin = 20;
  let textY = 50;
  ctx.fillText(`Transaction ID: ${purchase.transaction_id}`, margin, textY);
  textY += 20;
  ctx.fillText(`User ID: ${purchase.user_id}`, margin, textY);
  textY += 20;
  ctx.fillText(`Username: ${userInfo.username}`, margin, textY);
  textY += 20;
  ctx.fillText(`Email: ${userInfo.email}`, margin, textY);
  textY += 20;
  ctx.fillText(`PDF ID: ${purchase.pdf_id}`, margin, textY);
  textY += 20;
  ctx.fillText(`Amount: ₦${purchase.amount}`, margin, textY);
  textY += 20;
  ctx.fillText(`Payment Method: ${purchase.payment_method}`, margin, textY);
  textY += 20;
  const purchaseDate = purchase.purchase_date || new Date().toISOString();
  ctx.fillText(`Purchase Date: ${purchaseDate}`, margin, textY);
  textY += 30;

  // Load and draw the QR code.
  const qrImage = await loadImage(qrDataUrl);
  const qrSize = 100;
  const qrX = canvasWidth / 2 - qrSize / 2;
  ctx.drawImage(qrImage, qrX, textY, qrSize, qrSize);
  textY += qrSize + 20;

  // Instruction text.
  ctx.textAlign = 'center';
  ctx.font = '12px Arial';
  ctx.fillText('Scan the QR code to view full receipt details (in JSON)', canvasWidth / 2, textY);

  return canvas.toBuffer('image/png');
}

/**
 * Verifies a payment and records the purchase.
 * For upload fee transactions (when pdfId is "upload_permission"), the amount must be exactly 500 naira.
 * For PDF downloads, any amount is accepted.
 * Endpoint: POST /payment/verify
 */
const verifyPayment = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    let { reference, pdfId, amount, payment_method } = req.body;
    if (!userId || !pdfId || !amount || !reference) {
      return res.status(400).json({ success: false, message: 'Missing required purchase details (userId, pdfId, amount, or reference).' });
    }

    // If payment_method is not provided, assign a default value.
    payment_method = payment_method || 'paystack';
    
    console.log(`Verifying payment for PDF ${pdfId} with reference: ${reference} for user: ${userId}`);

    // Simulate payment verification. Replace with actual verification logic as needed.
    const paymentVerified = true;
    if (!paymentVerified) {
      return res.status(402).json({ success: false, message: 'Payment verification failed.' });
    }

    // For upload fee transactions, enforce an amount of exactly 500 naira.
    if (pdfId === 'upload_permission') {
      if (parseFloat(amount) !== 500) {
        return res.status(402).json({ success: false, message: 'Payment amount must be exactly 500 naira for upload permission.' });
      }
      pdfId = 0; // Convert dummy identifier if needed.
    }

    // Record the purchase.
    const purchase = await helpers.recordPurchase({
      user_id: userId,
      pdf_id: pdfId,
      amount,
      payment_method,
      transaction_id: reference,
      status: 'completed'
    });

    // Retrieve user information for receipt generation.
    const [userRows] = await db.query('SELECT username, email FROM users WHERE id = ?', [userId]);
    const userInfo = userRows[0] || { username: 'N/A', email: 'N/A' };

    // Generate receipt assets.
    const receiptPdfBuffer = await generateReceiptPdf(purchase, userInfo);
    const receiptImageBuffer = await generateReceiptImage(purchase, userInfo);

    // Update the purchase record with receipt data.
    await helpers.updatePurchaseReceipt(purchase.id, receiptPdfBuffer, receiptImageBuffer);
    purchase.receipt_pdf = receiptPdfBuffer;
    purchase.receipt_image = receiptImageBuffer;
    console.log(`Payment for PDF ${pdfId} recorded and receipt generated successfully for user ${userId}`);

    return res.status(201).json({ success: true, message: 'Payment verified and purchase recorded successfully.', purchase });
  } catch (error) {
    console.error('Error in verifyPayment:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error during payment verification.' });
  }
};

/**
 * Initializes a Paystack payment.
 * Endpoint: POST /payment/paystack/initialize
 * Returns a dummy authorization_url for simulation.
 */
const initializePaystack = async (req, res) => {
  try {
    const { amount, email, reference, ...extraData } = req.body;
    if (!amount || !email || !reference) {
      return res.status(400).json({ success: false, message: 'Missing required payment details (amount, email, or reference).' });
    }
    // For simulation, generate a dummy authorization_url.
    const authorization_url = `https://paystack.com/pay/${reference}`;
    const paymentData = {
      amount,
      email,
      reference,
      ...extraData,
      initialized: true,
      authorization_url,
      timestamp: new Date().toISOString()
    };
    console.log('Paystack payment initialization successful:', paymentData);
    return res.status(200).json({ success: true, message: 'Paystack payment initialized successfully.', ...paymentData });
  } catch (error) {
    console.error('Error in initializePaystack:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error initializing Paystack payment.' });
  }
};

/**
 * Verifies a Paystack payment using the provided reference.
 * Endpoint: GET /payment/paystack/verify/:reference
 */
const verifyPaystackPayment = async (req, res) => {
  try {
    const { reference } = req.params;
    if (!reference) {
      return res.status(400).json({ success: false, message: 'Missing payment reference.' });
    }
    // Simulate verification – in production, call Paystack's API.
    const paymentVerified = true;
    if (!paymentVerified) {
      return res.status(402).json({ success: false, message: 'Paystack payment verification failed.' });
    }
    // Optionally, retrieve the purchase record by transaction/reference.
    const purchase = await helpers.getPurchaseByTransactionId(reference);
    console.log(`Paystack payment verified for reference: ${reference}`);
    return res.status(200).json({ success: true, message: 'Paystack payment verified successfully.', status: 'success', purchase });
  } catch (error) {
    console.error('Error in verifyPaystackPayment:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error verifying Paystack payment.' });
  }
};

/**
 * Records (or updates) a payment purchase.
 * Endpoint: POST /payment/record
 */
const recordPurchase = async (req, res) => {
  try {
    const purchaseData = req.body;
    if (
      !purchaseData.user_id ||
      purchaseData.pdf_id === undefined ||
      !purchaseData.amount ||
      !purchaseData.payment_method ||
      !purchaseData.transaction_id ||
      !purchaseData.status
    ) {
      return res.status(400).json({ success: false, message: 'Missing required purchase data.' });
    }
    if (purchaseData.pdf_id === 'upload_permission') {
      purchaseData.pdf_id = 0;
    }
    const purchase = await helpers.recordPurchase(purchaseData);
    if (!purchase) {
      return res.status(500).json({ success: false, message: 'Failed to record purchase.' });
    }
    return res.status(201).json({ success: true, message: 'Purchase recorded successfully.', purchase });
  } catch (error) {
    console.error('Error recording purchase:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error during purchase recording.' });
  }
};

/**
 * Processes a PDF purchase.
 * Endpoint: POST /payment/:pdfId/purchase
 */
const purchasePdf = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { pdfId } = req.params;
    const { amount, payment_method, reference } = req.body;
    if (!userId || !pdfId || !amount || !payment_method || !reference) {
      return res.status(400).json({ success: false, message: 'Missing required purchase details (userId, pdfId, amount, payment_method or reference).' });
    }
    console.log(`Processing PDF purchase for PDF ${pdfId} with reference: ${reference} for user: ${userId}`);

    // Simulate payment processing logic.
    const paymentSuccessful = true;
    if (!paymentSuccessful) {
      return res.status(402).json({ success: false, message: 'Payment processing failed.' });
    }

    const purchase = await helpers.recordPurchase({
      user_id: userId,
      pdf_id: pdfId,
      amount,
      payment_method,
      transaction_id: reference,
      status: 'completed'
    });

    const [userRows] = await db.query('SELECT username, email FROM users WHERE id = ?', [userId]);
    const userInfo = userRows[0] || { username: 'N/A', email: 'N/A' };

    const receiptPdfBuffer = await generateReceiptPdf(purchase, userInfo);
    const receiptImageBuffer = await generateReceiptImage(purchase, userInfo);

    await helpers.updatePurchaseReceipt(purchase.id, receiptPdfBuffer, receiptImageBuffer);
    purchase.receipt_pdf = receiptPdfBuffer;
    purchase.receipt_image = receiptImageBuffer;

    return res.status(201).json({ success: true, message: 'PDF purchase processed successfully.', purchase });
  } catch (error) {
    console.error('Error in purchasePdf:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error during PDF purchase processing.' });
  }
};

/**
 * Checks whether the current user has purchased a specific PDF.
 * Endpoint: GET /payment/:pdfId/purchase-status?userId=...
 */
const getPurchaseStatus = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    const pdfId = req.params.pdfId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: user not found.' });
    }
    if (!pdfId) {
      return res.status(400).json({ message: 'Missing PDF identifier in parameters.' });
    }
    if (typeof helpers.getPurchaseByUserAndPdf !== 'function') {
      console.error('getPurchaseByUserAndPdf function is not implemented in helpers.');
      return res.status(501).json({ message: 'Purchase status check not implemented on server.' });
    }
    const purchaseRecord = await helpers.getPurchaseByUserAndPdf(userId, pdfId);
    const purchased = !!purchaseRecord;
    return res.status(200).json({ success: true, purchased });
  } catch (error) {
    console.error('Error checking purchase status:', error);
    return res.status(500).json({ success: false, message: 'An error occurred while checking purchase status.' });
  }
};

/**
 * Retrieves the PDFs purchased by the current user along with total spent.
 * Endpoint: GET /payment/purchases?userId=...
 */
const getPurchasedPdfs = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : req.query.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: user not found." });
    }
    const purchases = await helpers.getUserPurchasesWithPaymentDetails(userId);
    const totalSpent = purchases.reduce((sum, purchase) => sum + parseFloat(purchase.amount), 0);
    return res.json({ success: true, purchases, totalSpent });
  } catch (error) {
    console.error("Error retrieving purchased PDFs:", error);
    return res.status(500).json({
      message: "An error occurred while retrieving purchase history.",
      error: error.message,
    });
  }
};

/**
 * Downloads the receipt PDF for a given transaction.
 * Endpoint: GET /payment/receipts/:transactionId/pdf
 */
const downloadReceiptPdf = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const purchase = await helpers.getPurchaseByTransactionId(transactionId);
    if (!purchase) {
      return res.status(404).json({ message: 'Receipt not found for this transaction.' });
    }
    if (req.user?.id !== purchase.user_id) {
      return res.status(403).json({ message: 'You do not have permission to access this receipt.' });
    }
    const receiptPdfBuffer = purchase.receipt_pdf;
    if (!receiptPdfBuffer) {
      return res.status(404).json({ message: 'Receipt PDF not found in the database.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${purchase.pdf_title || 'Receipt'}.pdf"`);
    return res.end(receiptPdfBuffer);
  } catch (error) {
    console.error('Error in downloadReceiptPdf:', error);
    return res.status(500).json({ message: error.message || 'Error downloading receipt PDF.' });
  }
};

/**
 * Downloads the receipt image for a given transaction.
 * Endpoint: GET /payment/receipts/:transactionId/image
 */
const downloadReceiptImage = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const purchase = await helpers.getPurchaseByTransactionId(transactionId);
    if (!purchase) {
      return res.status(404).json({ message: 'Receipt not found for this transaction.' });
    }
    if (req.user?.id !== purchase.user_id) {
      return res.status(403).json({ message: 'You do not have permission to access this receipt.' });
    }
    const receiptImageBuffer = purchase.receipt_image;
    if (!receiptImageBuffer) {
      return res.status(404).json({ message: 'Receipt image not found in the database.' });
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${purchase.pdf_title || 'Receipt'}.png"`);
    return res.end(receiptImageBuffer);
  } catch (error) {
    console.error('Error in downloadReceiptImage:', error);
    return res.status(500).json({ message: error.message || 'Error downloading receipt image.' });
  }
};

module.exports = {
  verifyPayment,
  initializePaystack,
  verifyPaystackPayment,
  recordPurchase,
  purchasePdf,
  getPurchaseStatus,
  getPurchasedPdfs,
  downloadReceiptPdf,
  downloadReceiptImage,
};
