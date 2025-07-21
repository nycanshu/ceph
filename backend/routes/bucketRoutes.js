const express = require('express');
const { getUserBuckets, createBucket, getValidationRules, getBucketPolicy, deleteBucket } = require('../controllers/bucketController');
const authMiddleware = require('../middleware/auth');


const router = express.Router();

// Bucket routes (all require authentication)
router.get('/', authMiddleware, getUserBuckets);
router.post('/', authMiddleware, getValidationRules(), createBucket);
router.delete('/', authMiddleware, deleteBucket);
// Add endpoint to get a bucket's policy
router.get('/:name/policy', authMiddleware, getBucketPolicy);

module.exports = router; 