const express = require('express');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const router = express.Router();

// Middleware to process validation results
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// User login endpoint – no role check here.
router.post(
  '/login',
  [
    body('email')
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidation
  ],
  authController.userLogin
);

// Admin login endpoint – only allows admin-role users.
router.post(
  '/admin/login',
  [
    body('email')
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidation
  ],
  authController.adminLogin
);

// Optionally, you can use a different endpoint for admin signup if needed.
router.post(
  '/signup',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('A valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    handleValidation
  ],
  authController.signup
);

router.post('/logout', authController.logout);
router.post('/change-password', authController.changePassword);

module.exports = router;
