import express from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body } from 'express-validator';
import prisma from '../utils/prisma';
import { handleValidationErrors, asyncHandler } from '../middleware/validation';
import { authenticateToken, requireAdmin } from '../middleware/auth';
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

  // Generate JWT tokens
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role
  };

  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET!,
    { expiresIn: '15m' } as jwt.SignOptions
  );

  const refreshToken = jwt.sign(
    payload,
    process.env.JWT_SECRET!,
    { expiresIn: '7d' } as jwt.SignOptions
  );

  // Store refresh token in DB
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt
    }
  });

  // Set HTTP-only cookies
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // 'none' is required for cross-domain cookies (Vercel frontend → Railway backend)
    // sameSite: 'none' requires secure: true (HTTPS), which is enforced in production above
    sameSite: process.env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const
  };

  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  const response: ApiResponse = {
    success: true,
    message: 'Login successful',
    data: {
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

// POST /api/auth/refresh
router.post('/refresh', asyncHandler(async (req: express.Request, res: express.Response) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    const response: ApiResponse = { success: false, message: 'Refresh token not found' };
    res.status(401).json(response);
    return;
  }

  // Find token in DB
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true }
  });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    // Basic protection against token reuse -> could also delete here
    if (storedToken) {
       await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    }
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    const response: ApiResponse = { success: false, message: 'Session expired. Please log in again.' };
    res.status(403).json(response);
    return;
  }

  // Verify token signature
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as JwtPayload;
    
    // Generate new Access Token
    const payload: JwtPayload = {
      userId: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role
    };

    const newAccessToken = jwt.sign(
      payload,
      process.env.JWT_SECRET!,
      { expiresIn: '15m' } as jwt.SignOptions
    );

    // Update Access Token cookie
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    const response: ApiResponse = { success: true, message: 'Token refreshed successfully' };
    res.json(response);
  } catch (error) {
    // Invalid signature on refresh token
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    const response: ApiResponse = { success: false, message: 'Invalid refresh token' };
    res.status(403).json(response);
  }
}));

// POST /api/auth/register — Admin-only: create new staff accounts
router.post('/register',
  authenticateToken,   // Must be logged in
  requireAdmin,        // Must be ADMIN role
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
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
  const refreshToken = req.cookies?.refreshToken;
  
  if (refreshToken) {
    // Remove token from database
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken }
    });
  }

  // Clear HTTP-only cookies
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  const response: ApiResponse = {
    success: true,
    message: 'Logged out successfully'
  };

  res.json(response);
}));

export default router;