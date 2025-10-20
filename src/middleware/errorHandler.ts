import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', error);

  // Prisma errors
  if (error.code === 'P2002') {
    const response: ApiResponse = {
      success: false,
      message: 'Duplicate entry found',
      error: 'A record with this information already exists'
    };
    res.status(409).json(response);
    return;
  }

  if (error.code === 'P2025') {
    const response: ApiResponse = {
      success: false,
      message: 'Record not found',
      error: 'The requested record does not exist'
    };
    res.status(404).json(response);
    return;
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    const response: ApiResponse = {
      success: false,
      message: 'Validation failed',
      error: error.message
    };
    res.status(400).json(response);
    return;
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    const response: ApiResponse = {
      success: false,
      message: 'Invalid token',
      error: 'Authentication failed'
    };
    res.status(401).json(response);
    return;
  }

  if (error.name === 'TokenExpiredError') {
    const response: ApiResponse = {
      success: false,
      message: 'Token expired',
      error: 'Please login again'
    };
    res.status(401).json(response);
    return;
  }

  // Default error
  const response: ApiResponse = {
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  };

  res.status(500).json(response);
};