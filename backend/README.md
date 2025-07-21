# MinIO Express Server - Secure User-Specific Bucket Access

A secure Express.js backend for MinIO that provides multi-user authentication, user-specific bucket management, and strict bucket-level access control. Each user can only access their own buckets, enforced by MinIO bucket policies. The backend uses JWT authentication, PostgreSQL (via Prisma), and MinIO admin credentials for all operations.

## 🏗️ Architecture

```
backend/
├── prisma/
│   └── schema.prisma          # Database schema (User & Bucket models)
├── middleware/
│   └── auth.js               # JWT authentication middleware
├── controllers/
│   ├── userController.js     # User signup & login
│   └── bucketController.js   # Bucket creation, deletion, listing, policy
├── routes/
│   ├── userRoutes.js         # Authentication routes
│   └── bucketRoutes.js       # Bucket routes (protected)
├── server.js                 # Main server file
├── package.json              # Dependencies and scripts
└── README.md                # This file
```

### Key Components:
- **Prisma Schema**: PostgreSQL models for User and Bucket
- **Authentication**: JWT-based auth with bcrypt password hashing
- **MinIO Integration**: Admin-level operations for user and bucket management
- **Bucket Policies**: Each bucket has a policy allowing only the owner's MinIO access key
- **Controllers/Routes**: Handle HTTP requests and responses

## Features
- **User Authentication**: Signup and login with JWT tokens
- **User-Specific Bucket Access**: Each user can only access their own buckets, enforced by MinIO bucket policies
- **Bucket Management**: Users can create, list, and delete their own buckets
- **Bucket Policy Inspection**: Users can view the policy for any bucket they own
- **Database Integration**: PostgreSQL with Prisma ORM
- **Input Validation**: Using express-validator
- **Error Handling**: Comprehensive error handling and logging

## User Isolation Model
- Each user is assigned a unique MinIO access key and secret key at signup.
- When a user creates a bucket, a policy is set on that bucket allowing only their access key.
- No other user can access or list another user's buckets.
- The global MinIO admin can access all buckets (for system administration only).

## API Documentation

### Health Check
- `GET /health` - Server health status
- `GET /` - API information and available endpoints

### Authentication

#### User Signup
`POST /api/users/signup`
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "minioAccessKey": "user_1234567890_abc123",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### User Login
`POST /api/users/login`
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "minioAccessKey": "user_1234567890_abc123",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Bucket Operations (Requires Authentication)

#### List User's Buckets
`GET /api/buckets`
- **Headers:** `Authorization: Bearer <jwt_token>`
- **Response:** List of buckets owned by the authenticated user.

#### Create Bucket
`POST /api/buckets`
- **Headers:** `Authorization: Bearer <jwt_token>`
- **Body:**
```json
{
  "name": "my-bucket"
}
```
- **Response:**
```json
{
  "success": true,
  "message": "Bucket 'my-bucket' created successfully",
  "data": { ...bucket info... }
}
```
- **Note:** The bucket policy is set so only the creator's MinIO access key can access this bucket.

#### Delete Bucket
`DELETE /api/buckets`
- **Headers:** `Authorization: Bearer <jwt_token>`
- **Body:**
```json
{
  "name": "my-bucket"
}
```
- **Response:**
```json
{
  "success": true,
  "message": "Bucket 'my-bucket' deleted successfully"
}
```

#### Get Bucket Policy
`GET /api/buckets/:name/policy`
- **Headers:** `Authorization: Bearer <jwt_token>`
- **Response:**
```json
{
  "success": true,
  "bucket": "my-bucket",
  "policy": { ...bucket policy JSON... }
}
```
- **Note:** Only the bucket owner (or admin) can view the policy.

## Usage Examples

### Using cURL

1. **Sign up a new user:**
   ```bash
   curl -X POST http://localhost:3000/api/users/signup \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "password123"}'
   ```

2. **Login:**
   ```bash
   curl -X POST http://localhost:3000/api/users/login \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "password123"}'
   ```

3. **Create a bucket (with auth token):**
   ```bash
   curl -X POST http://localhost:3000/api/buckets \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{"name": "my-test-bucket"}'
   ```

4. **List user's buckets:**
   ```bash
   curl -X GET http://localhost:3000/api/buckets \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

5. **Delete a bucket:**
   ```bash
   curl -X DELETE http://localhost:3000/api/buckets \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{"name": "my-test-bucket"}'
   ```

6. **Get a bucket's policy:**
   ```bash
   curl -X GET http://localhost:3000/api/buckets/my-test-bucket/policy \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

## Database Schema

### User Model
```prisma
model User {
  id              String  @id @default(uuid())
  email           String  @unique
  passwordHash    String
  minioAccessKey  String  @unique
  minioSecretKey  String
  createdAt       DateTime @default(now())
  buckets         Bucket[]
}
```

### Bucket Model
```prisma
model Bucket {
  id         String  @id @default(uuid())
  name       String  @unique
  userId     String
  user       User    @relation(fields: [userId], references: [id])
  createdAt  DateTime @default(now())
}
```

## System Overview

### 🔐 Global Admin
- Server connects to MinIO using admin credentials
- Admin can create IAM users and assign policies
- Admin creates buckets on behalf of users

### 👤 Normal Users
- Each user gets a record in PostgreSQL
- Each user gets a MinIO IAM user with:
  - Unique accessKey and secretKey
- When a user creates a bucket, a policy is set on that bucket allowing only their access key
- Users can only access their own buckets

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "error": "Error description",
  "message": "Detailed error message"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `404` - Not Found
- `409` - Conflict (resource already exists)
- `500` - Internal Server Error

## Development

### Available Scripts
- `npm start` - Start the server in production mode
- `npm run dev` - Start the server in development mode with auto-reload
- `npm run db:push` - Push Prisma schema to database
- `npm run db:generate` - Generate Prisma client

### Key Features

1. **User Isolation**: Each user can only access their own buckets
2. **MinIO Bucket Policy Enforcement**: Each bucket is protected by a policy allowing only the owner's access key
3. **JWT Authentication**: Secure token-based authentication
4. **Database Integration**: PostgreSQL with Prisma ORM
5. **Input Validation**: Comprehensive validation using express-validator

## Security Considerations

1. **Environment Variables**: Never commit sensitive information to version control
2. **Password Hashing**: Passwords are hashed using bcrypt
3. **JWT Security**: Use strong JWT secrets in production
4. **Input Validation**: All inputs are validated
5. **CORS**: Configure CORS settings for production use
6. **MinIO Policies**: Users can only access their own buckets

## Production Deployment

1. Set `NODE_ENV=production`
2. Use strong JWT secrets
3. Configure SSL/TLS for MinIO
4. Set up proper logging
5. Implement rate limiting
6. Use environment-specific configuration
7. Secure database connections

## Troubleshooting

### MinIO Connection Issues
- Ensure MinIO is running: `docker-compose ps`
- Check MinIO logs: `docker-compose logs minio`
- Verify MinIO client configuration: `mc admin info local`
- Check environment variables in `.env` file

### Database Issues
- Ensure PostgreSQL is running: `docker-compose ps`
- Check database logs: `docker-compose logs postgres`
- Run Prisma commands: `npx prisma db push`

### Authentication Issues
- Verify JWT token format
- Check token expiration
- Ensure user exists in database

### Common Errors
- `User already exists`: Email is already registered
- `Bucket name already taken`: Choose a different bucket name
- `Invalid credentials`: Check email and password
- `Access token required`: Include Authorization header

## License

ISC License
