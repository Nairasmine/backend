const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  // Retrieve the token from the Authorization header.
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access token is missing or malformed'
    });
  }

  // Extract token from header.
  const token = authHeader.split(' ')[1];

  try {
    // Verify the token using the JWT secret.
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded; // Attach decoded token payload to request.
    return next();
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
