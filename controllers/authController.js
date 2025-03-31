const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');

const authController = {
  async register(req, res) {
    const { username, email, password } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ message: 'Username, email, and password are required.' });
    }

    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      await db.query(
        `INSERT INTO users (username, email, password, role, status, created_at)
         VALUES (?, ?, ?, 'user', 'active', NOW())`,
        [username, email, hashedPassword]
      );
      res.status(201).json({ message: 'User registered successfully.' });
    } catch (error) {
      console.error('Error in register:', error);
      res.status(500).json({ message: 'Error registering user.' });
    }
  },

  async login(req, res) {
    const { email, password } = req.body;
  
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
  
    try {
      const [users] = await db.query(`SELECT * FROM users WHERE email = ?`, [email]);
  
      if (users.length === 0) {
        return res.status(404).json({ message: 'User not found.' });
      }
  
      const user = users[0];
      const isValidPassword = bcrypt.compareSync(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid password.' });
      }
  
      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '1h' }
      );
  
      res.status(200).json({ token, user });
    } catch (error) {
      console.error('Error in login:', error);
      res.status(500).json({ message: 'Error logging in.' });
    }
  },  

  async logout(req, res) {
    // In a real-world scenario, you might blacklist the token here.
    res.status(200).json({ message: 'Successfully logged out' });
  },

  async changePassword(req, res) {
    const { userId, newPassword } = req.body;

    // Validate required fields
    if (!userId || !newPassword) {
      return res
        .status(400)
        .json({ message: 'User ID and new password are required.' });
    }

    try {
      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      await db.query(`UPDATE users SET password = ? WHERE id = ?`, [
        hashedPassword,
        userId,
      ]);

      res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Error in changePassword:', error);
      res.status(500).json({ message: 'Error changing password' });
    }
  },
};

module.exports = authController;
