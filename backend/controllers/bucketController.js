const Minio = require('minio');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Initialize MinIO admin client
const MinioAdmin = require('../helpers/minio-admin');
const minioAdmin = new MinioAdmin();

// Helper to generate username from email
function getUsernameFromEmail(email) {
  let username = email.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (username.length < 3) username = username + '123';
  if (username.length > 20) username = username.substring(0, 20);
  return username;
}

// Get user's buckets
async function getUserBuckets(req, res) {
  try {
    const userId = req.user.userId;

    const buckets = await prisma.bucket.findMany({
      where: { userId },
      include: { user: true }
    });

    res.json({
      success: true,
      data: buckets
    });
  } catch (error) {
    console.error('Error in getUserBuckets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch buckets',
      message: error.message
    });
  }
}

// Create a new bucket
async function createBucket(req, res) {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name } = req.body;
    const userId = req.user.userId;

    // Check if bucket name is already taken in database
    const existingBucket = await prisma.bucket.findUnique({
      where: { name }
    });

    if (existingBucket) {
      return res.status(409).json({
        success: false,
        error: 'Bucket name already taken'
      });
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Create bucket in MinIO using MinioAdmin helper
    try {
      await minioAdmin.minioAdmin.makeBucket(name, 'us-east-1');
    } catch (err) {
      console.error('Error creating bucket in MinIO:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to create bucket in MinIO',
        message: err.message
      });
    }
    
    // Set bucket policy to allow only this user's access key
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: [user.minioAccessKey] },
          Action: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:ListBucket'
          ],
          Resource: [
            `arn:aws:s3:::${name}`,
            `arn:aws:s3:::${name}/*`
          ]
        }
      ]
    };
    try {
      await minioAdmin.minioAdmin.setBucketPolicy(name, JSON.stringify(policy));
    } catch (err) {
      // Rollback bucket if policy fails
      try { await minioAdmin.minioAdmin.removeBucket(name); } catch (e) {}
      console.error('Error setting bucket policy:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to set bucket policy',
        message: err.message
      });
    }

    // Create bucket record in database
    let bucket;
    try {
      bucket = await prisma.bucket.create({
        data: {
          name,
          userId
        },
        include: { user: true }
      });
    } catch (err) {
      // Rollback MinIO bucket if DB fails
      try { await minioAdmin.minioAdmin.removeBucket(name); } catch (e) {}
      console.error('Error creating bucket in DB:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to create bucket in database',
        message: err.message
      });
    }

    res.status(201).json({
      success: true,
      message: `Bucket '${name}' created successfully`,
      data: bucket
    });
  } catch (error) {
    console.error('Error in createBucket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create bucket',
      message: error.message
    });
  }
}

// Delete a bucket (no policy update needed)
async function deleteBucket(req, res) {
  try {
    // Validate bucket name
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    const { name } = req.body;
    const userId = req.user.userId;

    // Check if bucket exists and belongs to user
    const bucket = await prisma.bucket.findUnique({ where: { name } });
    if (!bucket || bucket.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: 'Bucket not found or not owned by user'
      });
    }

    // Delete from MinIO
    try {
      await minioAdmin.minioAdmin.removeBucket(name);
    } catch (err) {
      console.error('Error deleting bucket from MinIO:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete bucket from MinIO',
        message: err.message
      });
    }

    // Delete from DB
    try {
      await prisma.bucket.delete({ where: { name } });
    } catch (err) {
      console.error('Error deleting bucket from DB:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete bucket from database',
        message: err.message
      });
    }

    res.json({
      success: true,
      message: `Bucket '${name}' deleted successfully`
    });
  } catch (error) {
    console.error('Error in deleteBucket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete bucket',
      message: error.message
    });
  }
}

// Get bucket policy endpoint
async function getBucketPolicy(req, res) {
  try {
    const { name } = req.params;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Bucket name required' });
    }
    let policy;
    try {
      policy = await minioAdmin.minioAdmin.getBucketPolicy(name);
    } catch (err) {
      return res.status(404).json({ success: false, error: 'Policy not found', message: err.message });
    }
    res.json({ success: true, bucket: name, policy: JSON.parse(policy) });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch bucket policy', message: error.message });
  }
}

// Validation rules
function getValidationRules() {
  return [
    body('name').isString().trim().isLength({ min: 3, max: 63 })
      .matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
      .withMessage('Bucket name must be 3-63 characters, lowercase, and can contain only letters, numbers, and hyphens')
  ];
}

// Validation rules for deleteBucket
function getDeleteBucketValidationRules() {
  return [
    body('name').isString().trim().isLength({ min: 3, max: 63 })
      .matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
      .withMessage('Bucket name must be 3-63 characters, lowercase, and can contain only letters, numbers, and hyphens')
  ];
}

module.exports = {
  getUserBuckets,
  createBucket,
  getValidationRules,
  deleteBucket,
  getDeleteBucketValidationRules,
  getBucketPolicy
}; 