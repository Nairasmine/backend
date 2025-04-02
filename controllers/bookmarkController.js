// controllers/bookmarkController.js
const bookmarkModel = require('../models/bookmarkModel');

const bookmarkController = {
  async getAllBookmarks(req, res) {
    try {
      // Assume that your authentication middleware attaches a user object.
      const userId = req.user && req.user.id;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized: user not found.' });
      }
      const results = await bookmarkModel.getBookmarks(userId);
      return res.status(200).json(results);
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      return res.status(500).json({ message: "Error fetching bookmarks." });
    }
  }
};

module.exports = bookmarkController;
