const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  // Check for token in Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false,
      message: 'Access token is missing or malformed' 
    });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded; // Attach decoded user to request
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(403).json({ 
        success: false,
        message: 'Token expired' 
      });
    }
    return res.status(403).json({ 
      success: false,
      message: 'Invalid token' 
    });
  }
};

module.exports = authenticateToken;