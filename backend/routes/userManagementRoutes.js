const express = require('express');
const { getUserInfo, getUserPolicy, updateUserPolicy, listAllUsers } = require('../controllers/userManagementController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get user info including MinIO details
router.get('/info', getUserInfo);

// Get user policy
router.get('/policy', getUserPolicy);

// Update user policy
router.put('/policy', updateUserPolicy);

// List all users (admin only - you might want to add admin middleware here)
router.get('/all', listAllUsers);

module.exports = router; 