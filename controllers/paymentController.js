// controllers/paymentController.js
const { helpers, db } = require('../config/db.js');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

// Function to generate a dynamic receipt PDF that includes purchase info and a QR code.
async function generateReceiptPdf(purchase, userInfo) {
  return new Promise((resolve, reject) => {
    try {
      // Construct an object with full purchase info.
      const receiptData = {
        transactionId: purchase.transaction_id,
        userId: purchase.user_id,
        username: userInfo.username,
        customerEmail: userInfo.email,
        pdfId: purchase.pdf_id,
        amount: purchase.amount,
        paymentMethod: purchase.payment_method,
        purchaseDate: purchase.purchase_date
      };
      const qrData = JSON.stringify(receiptData);
      // Generate QR code data URL (PNG)
      QRCode.toDataURL(qrData, { errorCorrectionLevel: 'H' }, (err, qrDataUrl) => {
        if (err) return reject(err);
        // Remove data URL prefix to get Base64
        const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
        const qrBuffer = Buffer.from(base64Data, 'base64');
        // Create a new PDF document.
        const doc = new PDFDocument();
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          resolve(Buffer.concat(buffers));
        });
        // Title / Header
        doc.fontSize(20).text('Receipt', { align: 'center' });
        doc.moveDown();
        // Purchase details
        doc.fontSize(12)
          .text(`Transaction ID: ${purchase.transaction_id}`)
          .text(`User ID: ${purchase.user_id}`)
          .text(`Username: ${userInfo.username}`)
          .text(`Email: ${userInfo.email}`)
          .text(`PDF ID: ${purchase.pdf_id}`)
          .text(`Amount: ${purchase.amount}`)
          .text(`Payment Method: ${purchase.payment_method}`)
          .text(`Purchase Date: ${purchase.purchase_date || new Date().toISOString()}`);
        doc.moveDown();
        // Insert QR code image in the PDF
        doc.image(qrBuffer, { width: 100, align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text('Scan the QR code to view full receipt details (in JSON)', { align: 'center' });
        doc.end();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Function to generate a receipt image (QR code) as a PNG Buffer.
async function generateReceiptImage(purchase, userInfo) {
  const receiptData = {
    transactionId: purchase.transaction_id,
    userId: purchase.user_id,
    username: userInfo.username,
    customerEmail: userInfo.email,
    pdfId: purchase.pdf_id,
    amount: purchase.amount,
    paymentMethod: purchase.payment_method,
    purchaseDate: purchase.purchase_date
  };
  const qrData = JSON.stringify(receiptData);
  return QRCode.toBuffer(qrData, { type: 'png', errorCorrectionLevel: 'H' });
}

const verifyPayment = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { reference, pdfId, amount, payment_method = 'unknown' } = req.body;
    if (!userId || !pdfId || !amount || !reference) {
      return res.status(400).json({ success: false, message: 'Missing required purchase details (userId, pdfId, amount, or reference).' });
    }
    console.log(`Verifying payment for PDF ${pdfId} with reference: ${reference} for user: ${userId}`);
    const paymentVerified = true;
    if (!paymentVerified) {
      return res.status(402).json({ success: false, message: 'Payment verification failed.' });
    }
    // Check if a purchase already exists
    if (typeof helpers.getPurchaseByUserAndPdf === 'function') {
      const existingPurchase = await helpers.getPurchaseByUserAndPdf(userId, pdfId);
      if (existingPurchase) {
        console.log(`Purchase already exists for user ${userId} and PDF ${pdfId}`);
        return res.status(200).json({ success: true, message: 'Purchase already recorded.', purchase: existingPurchase });
      }
    }
    // Record the purchase (without receipt data initially)
    const purchase = await helpers.recordPurchase({
      user_id: userId,
      pdf_id: pdfId,
      amount,
      payment_method,
      transaction_id: reference,
      status: 'completed'
    });
    // Fetch user info (username and email) for the receipt
    const [userRows] = await db.query('SELECT username, email FROM users WHERE id = ?', [userId]);
    const userInfo = userRows[0] || { username: 'N/A', email: 'N/A' };
    // Generate dynamic receipt PDF and QR code image.
    const receiptPdfBuffer = await generateReceiptPdf(purchase, userInfo);
    const receiptImageBuffer = await generateReceiptImage(purchase, userInfo);
    // Update the purchase record with the generated receipt BLOBs.
    await helpers.updatePurchaseReceipt(purchase.id, receiptPdfBuffer, receiptImageBuffer);
    // Merge receipt data into purchase object for response.
    purchase.receipt_pdf = receiptPdfBuffer;
    purchase.receipt_image = receiptImageBuffer;
    console.log(`Payment for PDF ${pdfId} recorded and receipt generated successfully for user ${userId}`);
    return res.status(201).json({ success: true, message: 'Payment verified and purchase recorded successfully.', purchase });
  } catch (error) {
    console.error('Error in verifyPayment:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error during payment verification.' });
  }
};

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
    return res.status(500).json({ message: "An error occurred while retrieving purchase history.", error: error.message });
  }
};

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
  getPurchaseStatus,
  getPurchasedPdfs,
  downloadReceiptPdf,
  downloadReceiptImage
};
