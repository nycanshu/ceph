const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'MinIO Express Server is running!',
    endpoints: {
      signup: 'POST /api/users/signup',
      login: 'POST /api/users/login',
      buckets: 'GET/POST /api/buckets (requires auth)'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString()
  });
});

// Import route modules
const userRoutes = require('./routes/userRoutes');
const bucketRoutes = require('./routes/bucketRoutes');
const userManagementRoutes = require('./routes/userManagementRoutes');

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/buckets', bucketRoutes);
app.use('/api/user-management', userManagementRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false,
    error: 'Something went wrong!',
    message: err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Route not found' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 MinIO endpoint: ${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || 9000}`);
});

module.exports = { app }; 