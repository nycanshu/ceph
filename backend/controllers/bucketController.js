const Minio = require('minio');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Initialize MinIO admin client
const minioAdmin = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true' || false,
  accessKey: process.env.MINIO_ADMIN_KEY || 'minioadmin',
  secretKey: process.env.MINIO_ADMIN_SECRET || 'minioadmin123'
});

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

    // Create bucket in MinIO using admin credentials
    await minioAdmin.makeBucket(name, 'us-east-1');
    
    // Create bucket record in database
    const bucket = await prisma.bucket.create({
      data: {
        name,
        userId
      },
      include: { user: true }
    });

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

// Validation rules
function getValidationRules() {
  return [
    body('name').isString().trim().isLength({ min: 3, max: 63 })
      .matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
      .withMessage('Bucket name must be 3-63 characters, lowercase, and can contain only letters, numbers, and hyphens')
  ];
}

module.exports = {
  getUserBuckets,
  createBucket,
  getValidationRules
}; 