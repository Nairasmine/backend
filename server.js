const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require(path.join(__dirname, './routes/authRoutes'));
const pdfRoutes = require(path.join(__dirname, './routes/pdfRoutes'));
const profileRoutes = require(path.join(__dirname, './routes/profileRoutes'));
const usersRoutes = require(path.join(__dirname, './routes/usersRoutes'));
const bookmarkRoutes = require(path.join(__dirname, './routes/bookmarkRoutes'));
const paymentRoutes = require(path.join(__dirname, './routes/paymentRoutes'));

const app = express();

/**
 * Validate required environment variables
 */
const validateEnv = () => {
  const requiredVars = ['PORT', 'PAYSTACK_SECRET_KEY'];
  requiredVars.forEach((key) => {
    if (!process.env[key]) {
      console.error(`Missing required environment variable: ${key}`);
      process.exit(1);
    }
  });
};
validateEnv();

// Configure CORS properly for working with credentials
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000', // Use frontend URL from env or default
  credentials: true, // This is critical for withCredentials to work
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Enable CORS with proper configuration
app.use(cors(corsOptions));

// JSON parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount routes with the /api base path
app.use('/api/auth', authRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/payment', paymentRoutes); // Changed from payment to payments to match your client code

// Base API route for sanity check
app.get('/api', (req, res) => {
  res.send('Welcome to the PDF Manager API!');
});

// Health check route for monitoring
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack || err.message);
  const statusCode = err.status || 500;
  res.status(statusCode).json({ message: err.message || 'Internal Server Error' });
});

// Graceful shutdown handling
const handleShutdown = (signal) => {
  console.log(`${signal} received: Closing server gracefully...`);
  app.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// Start the server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Assign server to app for graceful shutdown
app.close = server.close.bind(server);