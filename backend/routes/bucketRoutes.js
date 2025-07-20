const express = require('express');
const { getUserBuckets, createBucket, getValidationRules } = require('../controllers/bucketController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Bucket routes (all require authentication)
router.get('/', authMiddleware, getUserBuckets);
router.post('/', authMiddleware, getValidationRules(), createBucket);

module.exports = router; 