const { db } = require('../config/db');
const bcrypt = require('bcryptjs');

const userModel = {
  // Create a new user
  async createUser(data) {
    try {
      const { username, email, password, role, avatar } = data;

      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const [result] = await db.query(
        `INSERT INTO users (username, email, password, role, avatar, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
        [username, email, hashedPassword, role || 'user', avatar || '']
      );

      return result.insertId; // Return the newly created user's ID
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  // Find a user by email
  async findByEmail(email) {
    try {
      const [rows] = await db.query(
        `SELECT * FROM users WHERE email = ? AND status = 'active'`,
        [email]
      );
      return rows[0]; // Return the first matching user
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  },

  // Find a user by ID
  async findById(userId) {
    try {
      const [rows] = await db.query(
        `SELECT * FROM users WHERE id = ? AND status = 'active'`,
        [userId]
      );
      return rows[0]; // Return the first matching user
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  },

  // Update the last login timestamp
  async updateLastLogin(userId) {
    try {
      await db.query(
        `UPDATE users SET last_login = NOW() WHERE id = ?`,
        [userId]
      );
    } catch (error) {
      console.error('Error updating last login:', error);
      throw error;
    }
  },

  // Compare passwords
  async comparePassword(candidatePassword, storedPassword) {
    try {
      return await bcrypt.compare(candidatePassword, storedPassword);
    } catch (error) {
      console.error('Error comparing passwords:', error);
      throw error;
    }
  },
};

module.exports = userModel;
