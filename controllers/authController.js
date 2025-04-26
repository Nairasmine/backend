const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');

const authController = {
  // Allows all users to log in
  async userLogin(req, res) {
    const { email, password } = req.body;
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
      console.error('Error in user login:', error);
      res.status(500).json({ message: 'Error logging in.' });
    }
  },

  // Only allows admins to log in
  async adminLogin(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    try {
      const [users] = await db.query(`SELECT * FROM users WHERE email = ?`, [email]);
      if (users.length === 0) {
        return res.status(404).json({ message: 'User not found.' });
      }
      const user = users[0];
      if (user.role !== 'admin') {
        return res.status(401).json({ message: 'Access denied. Not an admin account.' });
      }
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
      console.error('Error in admin login:', error);
      res.status(500).json({ message: 'Error logging in.' });
    }
  },

  // Updated signup function to make the first user an admin
async signup(req, res) {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email, and password are required.' });
  }
  
  try {
    // Check if any users exist in the database
    const [userCountResult] = await db.query('SELECT COUNT(*) AS count FROM users');
    const userCount = userCountResult[0].count;
    
    // Determine the role - first user becomes admin
    const role = userCount === 0 ? 'admin' : 'user';
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    await db.query(
      `INSERT INTO users (username, email, password, role, status, created_at)
       VALUES (?, ?, ?, ?, 'active', NOW())`,
      [username, email, hashedPassword, role]
    );
    
    res.status(201).json({ 
      message: `Account created successfully.${role === 'admin' ? ' You are the first user, so you have been assigned administrator privileges.' : ''}`,
      role: role
    });
  } catch (error) {
    console.error('Error in signup:', error);
    res.status(500).json({ message: 'Error creating account.' });
  }
},

  async logout(req, res) {
    res.status(200).json({ message: 'Successfully logged out' });
  },

  async changePassword(req, res) {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) {
      return res.status(400).json({ message: 'User ID and new password are required.' });
    }
    try {
      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      await db.query(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, userId]);
      res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Error in changePassword:', error);
      res.status(500).json({ message: 'Error changing password' });
    }
  },
};

module.exports = authController;
