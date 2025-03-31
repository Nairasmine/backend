const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const router = express.Router();

router.post(
  '/register',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('A valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
  ],
  authController.register
);

router.post(
  '/login',
  [
    body('email')
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  authController.login
);

router.post('/logout', authController.logout);
router.post('/change-password', authController.changePassword);

module.exports = router;
