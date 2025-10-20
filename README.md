# AGV Gold Lending System - Backend API

A comprehensive Node.js backend API for the AGV Gold Lending System built with Express, TypeScript, Prisma, and PostgreSQL.

## 🚀 Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Customer Management**: Complete CRUD operations for customer data
- **Loan Management**: Loan applications, approvals, disbursements, and tracking
- **Payment Processing**: EMI payments, partial payments, and payment schedules
- **Gold Item Management**: Track gold items with weights, purity, and valuations
- **File Uploads**: Handle customer documents and gold item images
- **Dashboard Analytics**: Real-time statistics and charts
- **Gold Rate Management**: Dynamic gold rates with historical tracking
- **Audit Trail**: Complete tracking of user actions and changes

## 🛠️ Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Validation**: express-validator
- **Security**: Helmet, CORS, Rate Limiting
- **Logging**: Morgan

## 📦 Installation

1. **Clone and navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   ```bash
   copy .env.example .env
   ```
   Update the `.env` file with your configuration:
   - Database connection URL
   - JWT secret key
   - File upload settings
   - CORS origins

4. **Database Setup**:
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run database migrations
   npm run db:migrate
   
   # Seed the database with initial data
   npm run db:seed
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3001`

## 🏗️ Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts           # Database seeding
├── src/
│   ├── controllers/      # Route controllers (future expansion)
│   ├── middleware/       # Custom middleware
│   │   ├── auth.ts       # Authentication middleware
│   │   ├── validation.ts # Validation middleware
│   │   ├── errorHandler.ts # Error handling
│   │   └── upload.ts     # File upload middleware
│   ├── routes/           # API routes
│   │   ├── auth.ts       # Authentication routes
│   │   ├── customers.ts  # Customer management
│   │   ├── loans.ts      # Loan management
│   │   ├── payments.ts   # Payment processing
│   │   ├── goldRates.ts  # Gold rate management
│   │   ├── upload.ts     # File upload routes
│   │   └── dashboard.ts  # Dashboard analytics
│   ├── services/         # Business logic (future expansion)
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   └── app.ts           # Express app configuration
├── uploads/             # File upload directory
└── dist/               # Compiled JavaScript (generated)
```

## 🔑 Default Users

After seeding, you can use these credentials:

- **Admin**: `admin@agvgold.com` / `admin123`
- **Manager**: `manager@agvgold.com` / `manager123`
- **Employee**: `employee@agvgold.com` / `employee123`

## 📚 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Create new staff user
- `GET /api/auth/profile` - Get user profile

### Customers
- `GET /api/customers` - List customers with pagination
- `GET /api/customers/:id` - Get customer details
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Deactivate customer

### Loans
- `GET /api/loans` - List loans with filters
- `GET /api/loans/:id` - Get loan details
- `POST /api/loans` - Create loan application
- `PUT /api/loans/:id/approve` - Approve loan
- `PUT /api/loans/:id/reject` - Reject loan
- `PUT /api/loans/:id/disburse` - Disburse loan

### Payments
- `GET /api/payments` - List payments
- `GET /api/payments/:id` - Get payment details
- `POST /api/payments` - Record new payment
- `PUT /api/payments/:id/status` - Update payment status
- `GET /api/payments/loan/:loanId/schedule` - Get payment schedule

### Gold Rates
- `GET /api/gold-rates` - Get all gold rates
- `GET /api/gold-rates/current` - Get current rates
- `POST /api/gold-rates` - Update gold rates (Manager/Admin only)
- `PUT /api/gold-rates/:id` - Update specific rate
- `DELETE /api/gold-rates/:id` - Deactivate rate

### File Upload
- `POST /api/upload/single` - Upload single file
- `POST /api/upload/multiple` - Upload multiple files
- `POST /api/upload/customer-documents` - Upload customer documents
- `POST /api/upload/gold-images` - Upload gold item images

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/charts` - Get chart data

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access**: Different permissions for Admin, Manager, Employee
- **Rate Limiting**: Prevent API abuse
- **Input Validation**: Comprehensive request validation
- **File Upload Security**: Type and size restrictions
- **CORS Protection**: Configurable cross-origin requests
- **Security Headers**: Helmet.js security headers

## 📊 Database Schema

The system uses PostgreSQL with the following main entities:

- **Users**: Staff members with role-based access
- **Customers**: Customer information and KYC details
- **Loans**: Loan applications and details
- **GoldItems**: Individual gold items as collateral
- **Payments**: Payment records and transactions
- **GoldRates**: Historical gold rates by purity
- **Settings**: System configuration

## 🚀 Development Scripts

```bash
# Development
npm run dev          # Start development server with hot reload

# Building
npm run build        # Compile TypeScript to JavaScript
npm start           # Start production server

# Database
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run database migrations
npm run db:reset     # Reset database and run migrations
npm run db:seed      # Seed database with initial data
npm run db:studio    # Open Prisma Studio (database GUI)
```

## 🌐 Deployment

The backend is ready for deployment on various platforms:

- **Railway**: PostgreSQL + Node.js hosting
- **Heroku**: Easy deployment with PostgreSQL addon
- **AWS**: EC2 + RDS for production
- **Digital Ocean**: App Platform deployment

Make sure to:
1. Set production environment variables
2. Run database migrations on production
3. Configure file upload storage (consider cloud storage)
4. Set up proper logging and monitoring

## 🤝 API Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

Error responses:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

## 📈 Monitoring & Logging

- Request logging with Morgan
- Error handling with custom middleware
- Health check endpoint: `GET /health`
- Database connection monitoring
- File upload tracking

## 🔧 Configuration

Key configuration options in `.env`:

- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 3001)
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret
- `CORS_ORIGIN`: Allowed frontend origins
- `MAX_FILE_SIZE`: File upload limit
- `RATE_LIMIT_*`: Rate limiting configuration

---

Built with ❤️ for AGV Gold Lending System