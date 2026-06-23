const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const userRoutes = require('./routes/user');
const itemRoutes = require('./routes/item');
const orderRoutes = require('./routes/order');
const transactionRoutes = require('./routes/transaction');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploaded product images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api/users', userRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'Kafé Lumière' }));

// Serve the frontend (single-codebase deployment)
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));
app.get('/', (req, res) => res.sendFile(path.join(frontendDir, 'home.html')));

// 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ message: 'Duplicate entry', detail: err.errors?.[0]?.message });
  }
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ message: err.errors?.[0]?.message || 'Validation error' });
  }
  res.status(500).json({ message: err.message || 'Internal server error' });
});

module.exports = app;
