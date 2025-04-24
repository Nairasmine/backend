// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const pdfRoutes = require('./routes/pdfRoutes');
const profileRoutes = require('./routes/profileRoutes');
const usersRoutes = require('./routes/usersRoutes');
const bookmarkRoutes = require('./routes/bookmarkRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const uploadPermissionRoutes = require('./routes/uploadPermissionRoutes');
const monetizationRoutes = require('./routes/monetizationRoutes'); // Existing monetization routes
const withdrawalRoutes = require('./routes/withdrawalRoutes');     // New withdrawal endpoints for admin panel

const app = express();

// Validate required environment variables
['PORT', 'PAYSTACK_SECRET_KEY'].forEach((key) => {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

// Define a whitelist of allowed origins (adjust as needed)
const whitelist = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3001'
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.error('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  // Added PATCH here along with the other methods.
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (if you have a production build)
app.use(express.static(path.join(__dirname, 'build')));

// Mount routes.
app.use('/api/auth', authRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/upload', uploadPermissionRoutes);
app.use('/api/monetization', monetizationRoutes);  // Monetization endpoints
app.use('/api/withdrawals', withdrawalRoutes);      // New withdrawal endpoints

app.get('/api', (req, res) => {
  res.send('Welcome to the PDF Manager API!');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// In production, serve the index.html for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack || err.message);
  const statusCode = err.status || 500;
  res.status(statusCode).json({ message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
app.close = server.close.bind(server);

module.exports = app;
