# MinIO Express Server - User Authentication & Bucket Management

A simplified Express.js server for MinIO operations with user authentication and bucket management. Users can sign up, login, and create their own buckets with proper isolation.

## 🏗️ Architecture

This project follows a **simplified MVC pattern** with authentication:

```
backend/
├── prisma/
│   └── schema.prisma          # Database schema (User & Bucket models)
├── middleware/
│   └── auth.js               # JWT authentication middleware
├── controllers/
│   ├── userController.js     # User signup & login
│   └── bucketController.js   # Bucket creation & listing
├── routes/
│   ├── userRoutes.js         # Authentication routes
│   └── bucketRoutes.js       # Bucket routes (protected)
├── server.js                 # Main server file
├── package.json              # Dependencies and scripts
└── README.md                # This file
```

### Key Components:

- **Prisma Schema**: PostgreSQL database models for User and Bucket
- **Authentication**: JWT-based auth with bcrypt password hashing
- **MinIO Integration**: Admin-level operations for user and bucket management
- **Controllers**: Handle HTTP requests and responses
- **Routes**: Define API endpoints with authentication

## Features

- **User Authentication**: Signup and login with JWT tokens
- **MinIO IAM Integration**: Automatic user creation in MinIO with policies
- **Bucket Management**: Users can create and list their own buckets
- **Database Integration**: PostgreSQL with Prisma ORM
- **Input Validation**: Using express-validator
- **Error Handling**: Comprehensive error handling and logging

## Prerequisites

- Node.js (v14 or higher)
- Docker and Docker Compose (for MinIO and PostgreSQL)
- npm or yarn
- MinIO Client (mc) installed

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   Create a `.env` file in the backend directory:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Database Configuration
   DATABASE_URL="postgresql://devuser:devpass@localhost:5432/devdb"

   # JWT Configuration
   JWT_SECRET=your-secret-key-here
   JWT_EXPIRES_IN=24h

   # MinIO Admin Configuration
   MINIO_ENDPOINT=localhost
   MINIO_PORT=9000
   MINIO_USE_SSL=false
   MINIO_ADMIN_KEY=minioadmin
   MINIO_ADMIN_SECRET=minioadmin123
   ```

3. **Setup MinIO Client**
   ```bash
   # Install MinIO Client (mc)
   # Windows: Download from https://min.io/download
   # Linux/Mac: wget https://dl.min.io/client/mc/release/linux-amd64/mc

   # Configure MinIO alias
   mc alias set local http://localhost:9000 minioadmin minioadmin123
   ```

4. **Start Services (using Docker Compose)**
   ```bash
   # From the root directory
   docker-compose up -d
   ```

5. **Setup Database**
   ```bash
   # Generate Prisma client
   npx prisma generate

   # Push schema to database
   npx prisma db push
   ```

6. **Start the Server**
   ```bash
   # Development mode with auto-reload
   npm run dev

   # Production mode
   npm start
   ```

## API Endpoints

### Health Check
- `GET /health` - Server health status
- `GET /` - API information and available endpoints

### Authentication

#### User Signup
```http
POST /api/users/signup
Content-Type: application/json

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
```http
POST /api/users/login
Content-Type: application/json

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
```http
GET /api/buckets
Authorization: Bearer <jwt_token>
```

#### Create Bucket
```http
POST /api/buckets
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "my-bucket"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bucket 'my-bucket' created successfully",
  "data": {
    "id": "uuid",
    "name": "my-bucket",
    "userId": "user_uuid",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "user": {
      "id": "user_uuid",
      "email": "user@example.com"
    }
  }
}
```

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

### Using JavaScript/Fetch

```javascript
// Sign up
const signup = async (email, password) => {
  const response = await fetch('http://localhost:3000/api/users/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password })
  });
  return response.json();
};

// Login
const login = async (email, password) => {
  const response = await fetch('http://localhost:3000/api/users/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password })
  });
  return response.json();
};

// Create bucket (requires auth)
const createBucket = async (token, bucketName) => {
  const response = await fetch('http://localhost:3000/api/buckets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name: bucketName })
  });
  return response.json();
};

// List buckets (requires auth)
const listBuckets = async (token) => {
  const response = await fetch('http://localhost:3000/api/buckets', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
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
  - Custom policy for bucket access
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
2. **MinIO IAM Integration**: Automatic user and policy creation
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