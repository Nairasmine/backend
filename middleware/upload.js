// File: middleware/upload.js

const multer = require('multer');

// Configure memory storage so that the file is stored as a buffer
const storage = multer.memoryStorage();

// OPTIONAL: File filter to allow only images
const fileFilter = (req, file, cb) => {
  // Allow only image mimetypes (you can modify this to allow other types)
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Set up Multer middleware with a file size limit (e.g., 5MB)
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter,
});

module.exports = upload;
