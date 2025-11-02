import express from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body } from 'express-validator';
import prisma from '../utils/prisma';
import { handleValidationErrors, asyncHandler } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { ApiResponse, JwtPayload } from '../types';

const router = express.Router();

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { email, password } = req.body;

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      password: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true
    }
  });

  if (!user || !user.isActive) {
    const response: ApiResponse = {
      success: false,
      message: 'Invalid credentials'
    };
    res.status(401).json(response);
    return;
  }

  // Verify password
  const isValidPassword = await bcryptjs.compare(password, user.password);
  if (!isValidPassword) {
    const response: ApiResponse = {
      success: false,
      message: 'Invalid credentials'
    };
    res.status(401).json(response);
    return;
  }

  // Generate JWT token
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role
  };

  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' } as jwt.SignOptions
  );

  const response: ApiResponse = {
    success: true,
    message: 'Login successful',
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    }
  };

  res.json(response);
}));

// POST /api/auth/register (for creating new staff users)
router.post('/register', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('role').isIn(['ADMIN', 'EMPLOYEE', 'MANAGER']).withMessage('Valid role is required')
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { email, password, firstName, lastName, role } = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    const response: ApiResponse = {
      success: false,
      message: 'User with this email already exists'
    };
    res.status(409).json(response);
    return;
  }

  // Hash password
  const hashedPassword = await bcryptjs.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true
    }
  });

  const response: ApiResponse = {
    success: true,
    message: 'User created successfully',
    data: user
  };

  res.status(201).json(response);
}));

// GET /api/auth/profile
router.get('/profile', authenticateToken, asyncHandler(async (req: express.Request, res: express.Response) => {
  if (!req.user) {
    const response: ApiResponse = {
      success: false,
      message: 'User not found'
    };
    res.status(404).json(response);
    return;
  }

  const response: ApiResponse = {
    success: true,
    message: 'Profile retrieved successfully',
    data: {
      user: req.user
    }
  };

  res.json(response);
}));

// POST /api/auth/logout
router.post('/logout', authenticateToken, asyncHandler(async (req: express.Request, res: express.Response) => {
  // In a more advanced implementation, you might invalidate the token in a blacklist
  // For now, we just return success since JWT is stateless
  const response: ApiResponse = {
    success: true,
    message: 'Logged out successfully'
  };

  res.json(response);
}));

export default router;