const express = require('express');
const cors = require('cors');
const path = require('path'); // Use `path` module for cleaner imports
require('dotenv').config();

const authRoutes = require(path.join(__dirname, './routes/authRoutes'));
const pdfRoutes = require(path.join(__dirname, './routes/pdfRoutes'));
const profileRoutes = require(path.join(__dirname, './routes/profileRoutes'));
const usersRoutes = require(path.join(__dirname, './routes/usersRoutes')); // New: Users routes
const bookmarkRoutes = require(path.join(__dirname, './routes/bookmarkRoutes')); // New: Bookmarks routes

const app = express();

// Validate environment variables
if (!process.env.PORT || !process.env.PAYSTACK_SECRET_KEY) {
  console.error('Missing required environment variables. Please check your .env file.');
  process.exit(1); // Exit the application if environment variables are missing
}

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount routes with the /api base path
app.use('/api/auth', authRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/bookmarks', bookmarkRoutes);

// A base API route for sanity check
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
process.on('SIGTERM', () => {
  console.log('SIGTERM received: Closing server gracefully...');
  app.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
