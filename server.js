// server.js (or app.js)

const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit'); // For rate limiting
const helmet = require('helmet'); // To set secure headers
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const pdfRoutes = require('./routes/pdfRoutes');
const profileRoutes = require('./routes/profileRoutes');
const usersRoutes = require('./routes/usersRoutes');
const bookmarkRoutes = require('./routes/bookmarkRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const uploadPermissionRoutes = require('./routes/uploadPermissionRoutes');
const monetizationRoutes = require('./routes/monetizationRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const userAdminRoutes = require('./routes/useradminRoutes');
const pdfRankingsRoutes = require('./routes/pdfRankingsRoutes'); // Ranking endpoints

// Import authentication middleware
const authenticateToken = require('./middleware/authenticateToken');

const app = express();

// ---------------------------- Security Enhancements -----------------------------

// Apply Helmet to set secure HTTP headers.
app.use(helmet());

// Apply rate limiting to all /api routes.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10000,               // limit each IP to 10000 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api/', apiLimiter);

// ---------------------------- Environment Validation -----------------------------
['PORT', 'PAYSTACK_SECRET_KEY', 'JWT_SECRET'].forEach((key) => {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

// ---------------------------- CORS Configuration -----------------------------
const whitelist = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3001'
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (whitelist.includes(origin)) {
      callback(null, true);
    } else {
      console.error('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// ---------------------------- Middleware -----------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uncomment the following to enable response compression (optional)
// const compression = require('compression');
// app.use(compression());

// Serve static files (for production build)
app.use(express.static(path.join(__dirname, 'build')));

// ---------------------------- Mount Routes -----------------------------
// Public routes
app.use('/api/auth', authRoutes);

// Protected routes (requiring JWT validation)
app.use('/api/pdf', authenticateToken, pdfRoutes);
app.use('/api/profile', authenticateToken, profileRoutes);
app.use('/api/users', authenticateToken, usersRoutes);
app.use('/api/bookmarks', authenticateToken, bookmarkRoutes);
app.use('/api/payment', authenticateToken, paymentRoutes);
app.use('/api/upload', authenticateToken, uploadPermissionRoutes);
app.use('/api/monetization', authenticateToken, monetizationRoutes);
app.use('/api/withdrawals', authenticateToken, withdrawalRoutes);
app.use('/api/useradmin', authenticateToken, userAdminRoutes);

// ***** Included Ranking Endpoints *****
// Mount the ranking routes for top sellers and most selling books.
app.use('/api/pdf-rankings', authenticateToken, pdfRankingsRoutes);

// ---------------------------- Fallback Routes -----------------------------
// Welcome endpoint.
app.get('/api', (req, res) => {
  res.send('Welcome to the PDF Manager API!');
});

// Health check endpoint.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// For production: serve index.html for any unknown routes.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// ---------------------------- Global Error Handler -----------------------------
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack || err.message);
  const statusCode = err.status || 500;
  res.status(statusCode).json({ message: err.message || 'Internal Server Error' });
});

// ---------------------------- Start Server -----------------------------
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
app.close = server.close.bind(server);

module.exports = app;
