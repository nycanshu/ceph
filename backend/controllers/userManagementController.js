const { PrismaClient } = require('@prisma/client');
const MinioAdmin = require('../helpers/minio-admin');

const prisma = new PrismaClient();
const minioAdmin = new MinioAdmin();

// Get user info including policy
async function getUserInfo(req, res) {
  try {
    const userId = req.user.userId;
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Generate username from email
    const username = user.email.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (username.length < 3) username = username + '123';
    if (username.length > 20) username = username.substring(0, 20);

    // Get MinIO user info
    const minioUserInfo = await minioAdmin.getUserInfo(username);
    
    if (!minioUserInfo.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get MinIO user info',
        message: minioUserInfo.error
      });
    }

    // Remove sensitive data
    const { passwordHash, minioSecretKey, ...userResponse } = user;

    res.json({
      success: true,
      data: {
        ...userResponse,
        minio: minioUserInfo.user
      }
    });
  } catch (error) {
    console.error('Error in getUserInfo:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

// Get user policy
async function getUserPolicy(req, res) {
  try {
    const userId = req.user.userId;
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Generate username from email
    const username = user.email.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (username.length < 3) username = username + '123';
    if (username.length > 20) username = username.substring(0, 20);

    // Get MinIO user policy
    const policyResult = await minioAdmin.getUserPolicy(username);
    
    if (!policyResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get user policy',
        message: policyResult.error
      });
    }

    res.json({
      success: true,
      data: {
        username,
        policy: policyResult.policy
      }
    });
  } catch (error) {
    console.error('Error in getUserPolicy:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

// Update user policy
async function updateUserPolicy(req, res) {
  try {
    const userId = req.user.userId;
    const { policy } = req.body;
    
    if (!policy) {
      return res.status(400).json({
        success: false,
        error: 'Policy is required'
      });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Generate username from email
    const username = user.email.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (username.length < 3) username = username + '123';
    if (username.length > 20) username = username.substring(0, 20);

    // Update MinIO user policy
    const updateResult = await minioAdmin.updateUserPolicy(username, policy);
    
    if (!updateResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update user policy',
        message: updateResult.error
      });
    }

    res.json({
      success: true,
      message: 'User policy updated successfully'
    });
  } catch (error) {
    console.error('Error in updateUserPolicy:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

// List all users (admin only)
async function listAllUsers(req, res) {
  try {
    // Get all users from database
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        createdAt: true,
        minioAccessKey: true
      }
    });

    // Get MinIO user info for each user
    const usersWithMinioInfo = await Promise.all(
      users.map(async (user) => {
        const username = user.email.toLowerCase().replace(/[^a-z0-9]/g, '');
        const sanitizedUsername = username.length < 3 ? username + '123' : 
                                 username.length > 20 ? username.substring(0, 20) : username;
        
        const minioInfo = await minioAdmin.getUserInfo(sanitizedUsername);
        
        return {
          ...user,
          minio: minioInfo.success ? minioInfo.user : null
        };
      })
    );

    res.json({
      success: true,
      data: usersWithMinioInfo
    });
  } catch (error) {
    console.error('Error in listAllUsers:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

module.exports = {
  getUserInfo,
  getUserPolicy,
  updateUserPolicy,
  listAllUsers
}; 