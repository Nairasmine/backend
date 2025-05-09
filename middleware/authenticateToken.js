const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  // Retrieve token from the Authorization header.
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access token is missing or malformed'
    });
  }

  const token = authHeader.split(' ')[1].trim();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach token payload to the request.
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
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
