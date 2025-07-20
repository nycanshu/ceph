const Minio = require('minio');

// Initialize MinIO client
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true' || false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123'
});

// Test MinIO connection
async function testMinioConnection() {
  try {
    console.log('🔍 Testing MinIO connection...');
    
    // List buckets
    const buckets = await minioClient.listBuckets();
    console.log('✅ MinIO connection successful!');
    console.log('📦 Available buckets:', buckets.map(bucket => bucket.name));
    
    // Test bucket creation
    const testBucketName = `test-bucket-${Date.now()}`;
    console.log(`\n🔧 Creating test bucket: ${testBucketName}`);
    
    await minioClient.makeBucket(testBucketName, 'us-east-1');
    console.log('✅ Test bucket created successfully!');
    
    // Test bucket deletion
    console.log(`\n🗑️  Cleaning up test bucket: ${testBucketName}`);
    await minioClient.removeBucket(testBucketName);
    console.log('✅ Test bucket deleted successfully!');
    
    console.log('\n🎉 All tests passed! MinIO is working correctly.');
    
  } catch (error) {
    console.error('❌ MinIO test failed:', error.message);
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Make sure Docker Desktop is running');
    console.log('2. Run: docker-compose up -d');
    console.log('3. Check if MinIO is accessible at http://localhost:9000');
    console.log('4. Verify credentials: minioadmin/minioadmin123');
  }
}

// Run the test
testMinioConnection(); 