const { db, helpers } = require('../config/db');

const profileModel = {
  async getProfile(userId) {
    try {
      const [rows] = await db.query(`
        SELECT 
          id, 
          username, 
          email, 
          role, 
          profile_picture, 
          created_at, 
          last_login,
          status
        FROM users 
        WHERE id = ? AND status = 'active'
      `, [userId]);

      return rows[0];
    } catch (error) {
      console.error('Error in getProfile:', error);
      throw error;
    }
  },

  async updateProfile(userId, profileData) {
    try {
      const { email, profile_picture } = profileData;

      const updateFields = [];
      const updateValues = [];

      if (email) {
        updateFields.push('email = ?');
        updateValues.push(email);
      }

      if (profile_picture) {
        updateFields.push('profile_picture = ?');
        updateValues.push(profile_picture);
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_at = NOW()');
        updateValues.push(userId);
        await db.query(`
          UPDATE users 
          SET ${updateFields.join(', ')} 
          WHERE id = ? AND status = 'active'
        `, updateValues);
      }

      return await this.getProfile(userId);
    } catch (error) {
      console.error('Error in updateProfile:', error);
      throw error;
    }
  }
};

module.exports = profileModel;