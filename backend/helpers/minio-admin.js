const Minio = require('minio');
const fs = require('fs');
const path = require('path');

class MinioAdmin {
  constructor() {
    // Initialize MinIO admin client
    this.minioAdmin = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT) || 9000,
      useSSL: process.env.MINIO_USE_SSL === 'true' || false,
      accessKey: process.env.MINIO_ADMIN_KEY || 'minioadmin',
      secretKey: process.env.MINIO_ADMIN_SECRET || 'minioadmin123'
    });
  }

  async createUser(username, accessKey, secretKey) {
    try {
      console.log('Creating MinIO user:', { username, accessKey, secretKey });
      
      // Create a user policy that will be applied to any buckets the user creates
      const userPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: [
              's3:GetObject',
              's3:PutObject',
              's3:DeleteObject',
              's3:ListBucket',
              's3:CreateBucket',
              's3:DeleteBucket'
            ],
            Resource: [
              `arn:aws:s3:::${username}-*`,
              `arn:aws:s3:::${username}-*/*`
            ]
          }
        ]
      };
      
      // Store the user policy (we'll apply it when user creates buckets)
      // For now, we'll just return success - no default bucket created
      console.log('User created with policy template');
      
      return { 
        success: true, 
        accessKey,
        secretKey,
        userPolicy
      };
    } catch (error) {
      console.log('Error creating MinIO user:', error.message);
      return { success: false, error: error.message };
    }
  }

  async createPolicy(username, policy) {
    try {
      console.log('Creating policy for user:', username);
      
      // For now, we'll skip policy creation since we're not creating IAM users
      // Instead, we'll use the admin credentials for all operations
      
      return { success: true };
    } catch (error) {
      console.log('Error creating policy:', error.message);
      return { success: false, error: error.message };
    }
  }

  async deleteUser(username) {
    try {
      console.log('Deleting user bucket:', username);
      
      const bucketName = `${username}-bucket`;
      const bucketExists = await this.minioAdmin.bucketExists(bucketName);
      
      if (bucketExists) {
        await this.minioAdmin.removeBucket(bucketName);
        console.log('Deleted bucket:', bucketName);
      }
      
      return { success: true };
    } catch (error) {
      console.log('Error deleting user:', error.message);
      return { success: false, error: error.message };
    }
  }

  async listUsers() {
    try {
      console.log('Listing buckets (users)');
      
      const buckets = [];
      const stream = this.minioAdmin.listBuckets();
      
      return new Promise((resolve, reject) => {
        stream.on('data', (bucket) => {
          buckets.push(bucket.name);
        });
        
        stream.on('end', () => {
          resolve({ success: true, users: buckets });
        });
        
        stream.on('error', (error) => {
          reject({ success: false, error: error.message });
        });
      });
    } catch (error) {
      console.log('Error listing users:', error.message);
      return { success: false, error: error.message };
    }
  }

  async getUserPolicy(username) {
    try {
      console.log('Getting policy for user:', username);
      
      // Try to get policy from default bucket first
      const defaultBucketName = `${username}-default`;
      const bucketExists = await this.minioAdmin.bucketExists(defaultBucketName);
      
      if (bucketExists) {
        try {
          const policy = await this.minioAdmin.getBucketPolicy(defaultBucketName);
          return { success: true, policy: JSON.parse(policy) };
        } catch (error) {
          // If no policy exists, return default user policy
          const defaultUserPolicy = {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: { AWS: ['*'] },
                Action: [
                  's3:GetObject',
                  's3:PutObject',
                  's3:DeleteObject',
                  's3:ListBucket',
                  's3:CreateBucket',
                  's3:DeleteBucket'
                ],
                Resource: [
                  `arn:aws:s3:::${username}-*`,
                  `arn:aws:s3:::${username}-*/*`
                ]
              }
            ]
          };
          return { success: true, policy: defaultUserPolicy };
        }
      }

      return { success: false, error: 'User not found' };
    } catch (error) {
      console.log('Error getting user policy:', error.message);
      return { success: false, error: error.message };
    }
  }

  async updateUserPolicy(username, policy) {
    try {
      console.log('Updating policy for user:', username);
      
      // Get all user buckets
      const userBuckets = await this.getUserBuckets(username);
      
      if (!userBuckets.success || userBuckets.buckets.length === 0) {
        return { success: false, error: 'User not found or no buckets exist' };
      }

      // Apply the policy to all user buckets
      for (const bucket of userBuckets.buckets) {
        await this.minioAdmin.setBucketPolicy(bucket.name, JSON.stringify(policy));
        console.log('Updated policy for bucket:', bucket.name);
      }
      
      return { success: true, updatedBuckets: userBuckets.buckets.length };
    } catch (error) {
      console.log('Error updating user policy:', error.message);
      return { success: false, error: error.message };
    }
  }

  async getUserInfo(username) {
    try {
      console.log('Getting user info for:', username);
      
      // Get all user buckets
      const userBuckets = await this.getUserBuckets(username);
      
      if (!userBuckets.success) {
        return { success: false, error: 'User not found' };
      }

      // Get user policy
      const policyResult = await this.getUserPolicy(username);
      
      // Get total objects count across all buckets
      let totalObjectCount = 0;
      for (const bucket of userBuckets.buckets) {
        try {
          const objects = this.minioAdmin.listObjects(bucket.name, '', true);
          const count = await new Promise((resolve) => {
            let bucketCount = 0;
            objects.on('data', () => bucketCount++);
            objects.on('end', () => resolve(bucketCount));
          });
          totalObjectCount += count;
        } catch (error) {
          console.log('Error counting objects in bucket:', bucket.name, error.message);
        }
      }

      return {
        success: true,
        user: {
          username,
          buckets: userBuckets.buckets,
          totalObjectCount,
          policy: policyResult.success ? policyResult.policy : null
        }
      };
    } catch (error) {
      console.log('Error getting user info:', error.message);
      return { success: false, error: error.message };
    }
  }

  async getUserBuckets(username) {
    try {
      console.log('Getting buckets for user:', username);
      
      const allBuckets = [];
      const stream = this.minioAdmin.listBuckets();
      
      return new Promise((resolve, reject) => {
        stream.on('data', (bucket) => {
          // Only include buckets that belong to this user
          if (bucket.name.startsWith(`${username}-`)) {
            allBuckets.push({
              name: bucket.name,
              creationDate: bucket.creationDate
            });
          }
        });
        
        stream.on('end', () => {
          resolve({ success: true, buckets: allBuckets });
        });
        
        stream.on('error', (error) => {
          reject({ success: false, error: error.message });
        });
      });
    } catch (error) {
      console.log('Error getting user buckets:', error.message);
      return { success: false, error: error.message };
    }
  }

  async createUserBucket(username, bucketName) {
    try {
      console.log('Creating bucket for user:', username, 'bucket:', bucketName);
      
      const fullBucketName = `${username}-${bucketName}`;
      
      // Check if bucket already exists
      const bucketExists = await this.minioAdmin.bucketExists(fullBucketName);
      if (bucketExists) {
        return { success: false, error: 'Bucket already exists' };
      }
      
      // Create the bucket
      await this.minioAdmin.makeBucket(fullBucketName, 'us-east-1');
      console.log('Created bucket:', fullBucketName);
      
      // Apply user policy to the new bucket
      const userPolicy = await this.getUserPolicy(username);
      if (userPolicy.success) {
        await this.minioAdmin.setBucketPolicy(fullBucketName, JSON.stringify(userPolicy.policy));
        console.log('Applied user policy to new bucket');
      }
      
      return { 
        success: true, 
        bucketName: fullBucketName
      };
    } catch (error) {
      console.log('Error creating user bucket:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = MinioAdmin; 