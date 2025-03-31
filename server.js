const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const pdfRoutes = require('./routes/pdfRoutes');
const profileRoutes = require('./routes/profileRoutes');
const usersRoutes = require('./routes/usersRoutes'); // New: Users routes

const app = express();

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount routes with an /api base path
app.use('/api/auth', authRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', usersRoutes); // New: Mount users route

// A base API route for sanity check
app.get('/api', (req, res) => {
  res.send('Welcome to the PDF Manager API!');
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
