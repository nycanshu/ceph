const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { exec } = require('child_process');
const { promisify } = require('util');

// Alternative: MinIO JavaScript SDK approach
// const Minio = require('minio');
// const minioAdmin = new Minio.Client({
//   endPoint: 'localhost',
//   port: 9000,
//   useSSL: false,
//   accessKey: 'minioadmin',
//   secretKey: 'minioadmin123'
// });

const execAsync = promisify(exec);
const prisma = new PrismaClient();

// Import MinIO admin helper
const MinioAdmin = require('../helpers/minio-admin');
const minioAdmin = new MinioAdmin();

// Generate MinIO credentials from email and password
function generateMinioCredentials(email, password) {
  // Use email as access key (sanitized for MinIO requirements)
  // MinIO access keys must be 3-20 characters, alphanumeric only
  let accessKey = email.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (accessKey.length < 3) accessKey = accessKey + '123';
  if (accessKey.length > 20) accessKey = accessKey.substring(0, 20);
  
  // Use password as secret key (sanitized for MinIO requirements)
  // MinIO secret keys must be 8-40 characters, alphanumeric only
  let secretKey = password.replace(/[^a-zA-Z0-9]/g, '');
  if (secretKey.length < 8) secretKey = secretKey + '12345678';
  if (secretKey.length > 40) secretKey = secretKey.substring(0, 40);
  
  return { accessKey, secretKey };
}

// Create MinIO IAM user using MinioAdmin helper
async function createMinioUser(username, accessKey, secretKey) {
  try {
    const result = await minioAdmin.createUser(username, accessKey, secretKey);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Create MinIO policy for user using MinioAdmin helper
async function createMinioPolicy(userId, username) {
  try {
    // Query all buckets owned by the user
    const buckets = await prisma.bucket.findMany({
      where: { userId },
      select: { name: true }
    });
    // Build resource ARNs for each bucket
    const resources = buckets.flatMap(bucket => [
      `arn:aws:s3:::${bucket.name}`,
      `arn:aws:s3:::${bucket.name}/*`
    ]);
    // If no buckets, use a placeholder resource or empty Statement
    let statement = [];
    if (resources.length > 0) {
      statement.push({
        Effect: 'Allow',
        Action: [
          's3:GetObject',
          's3:PutObject',
          's3:DeleteObject',
          's3:ListBucket'
        ],
        Resource: resources
      });
    }
    // Policy object
    const policy = {
      Version: '2012-10-17',
      Statement: statement
    };
    console.log(`Creating policy for ${username}:`, JSON.stringify(policy, null, 2));
    // Store policy in MinIO
    const result = await minioAdmin.createPolicy(username, policy);
    return result;
  } catch (error) {
    console.error('Error in createMinioPolicy:', error);
    return { success: false, error: error.message };
  }
}

// User signup
async function signup(req, res) {
  try {
    // Check for validation errors
    // const errors = validationResult(req);
    // if (!errors.isEmpty()) {
    //   return res.status(400).json({
    //     success: false,
    //     errors: errors.array()
    //   });
    // }

    const { email, password } = req.body;

    // Ensure email is present and valid
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate MinIO credentials
    const { accessKey, secretKey } = generateMinioCredentials(email, password);

    // Generate username for MinIO using email
    let username = email.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (username.length < 3) username = username + '123';
    if (username.length > 20) username = username.substring(0, 20);

    // Create MinIO IAM user
    const minioUserResult = await createMinioUser(username, accessKey, secretKey);
    if (!minioUserResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create MinIO user',
        message: minioUserResult.error
      });
    }

    // Create user in database
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        minioAccessKey: accessKey,
        minioSecretKey: secretKey
      }
    });

    // After user is created, create initial MinIO policy
    const policyResult = await createMinioPolicy(user.id, username);
    if (!policyResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create MinIO policy',
        message: policyResult.error
      });
    }

    // Remove sensitive data from response
    const { passwordHash: _, minioSecretKey: __, ...userResponse } = user;

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: userResponse
    });
  } catch (error) {
    console.error('Error in signup:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

// User login
async function login(req, res) {
  try {
    // const errors = validationResult(req);
    // if (!errors.isEmpty()) {
    //   return res.status(400).json({
    //     success: false,
    //     errors: errors.array()
    //   });
    // }

    const { email, password } = req.body;

    // Ensure email is present
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Get user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        minioAccessKey: user.minioAccessKey
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Remove sensitive data from response
    const { passwordHash, minioSecretKey, ...userResponse } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

// // Validation rules
// function getSignupValidationRules() {
//   return [
//     body('email').isEmail().normalizeEmail()
//       .withMessage('Must be a valid email address'),
//     body('password').isString().isLength({ min: 6 })
//       .withMessage('Password must be at least 6 characters long')
//   ];
// }

// function getLoginValidationRules() {
//   return [
//     body('email').isEmail().normalizeEmail()
//       .withMessage('Must be a valid email address'),
//     body('password').isString().notEmpty()
//       .withMessage('Password is required')
//   ];
// }

module.exports = {
  signup,
  login,
  // getSignupValidationRules,
  // getLoginValidationRules
};
