import express from 'express';
import { body, param, query } from 'express-validator';
import { PrismaClient, DocumentType, DocumentStatus } from '@prisma/client';
import { handleValidationErrors, asyncHandler } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { upload, getFileUrl } from '../middleware/upload';
import { ApiResponse } from '../types';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const prisma = new PrismaClient();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/documents - Get all documents with filters
router.get('/', [
  query('customerId').optional().isString(),
  query('loanId').optional().isString(),
  query('documentType').optional().isString(),
  query('status').optional().isString()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { customerId, loanId, documentType, status } = req.query;

  const where: any = {};
  if (customerId) where.customerId = customerId as string;
  if (loanId) where.loanId = loanId as string;
  if (documentType) where.documentType = documentType as DocumentType;
  if (status) where.status = status as DocumentStatus;

  const documents = await prisma.document.findMany({
    where,
    orderBy: { uploadedAt: 'desc' }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Documents retrieved successfully',
    data: documents
  };

  res.json(response);
}));

// GET /api/documents/:id - Get single document
router.get('/:id', [
  param('id').isString().notEmpty()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;

  const document = await prisma.document.findUnique({
    where: { id }
  });

  if (!document) {
    const response: ApiResponse = {
      success: false,
      message: 'Document not found'
    };
    res.status(404).json(response);
    return;
  }

  const response: ApiResponse = {
    success: true,
    message: 'Document retrieved successfully',
    data: document
  };

  res.json(response);
}));

// GET /api/documents/customer/:customerId - Get all documents for a customer
router.get('/customer/:customerId', [
  param('customerId').isString().notEmpty()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { customerId } = req.params;

  const documents = await prisma.document.findMany({
    where: { customerId },
    orderBy: { uploadedAt: 'desc' }
  });

  // Group documents by type
  const grouped = documents.reduce((acc: any, doc) => {
    const type = doc.documentType;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(doc);
    return acc;
  }, {});

  const response: ApiResponse = {
    success: true,
    message: 'Customer documents retrieved successfully',
    data: {
      total: documents.length,
      documents,
      grouped
    }
  };

  res.json(response);
}));

// GET /api/documents/loan/:loanId - Get all documents for a loan
router.get('/loan/:loanId', [
  param('loanId').isString().notEmpty()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { loanId } = req.params;

  const documents = await prisma.document.findMany({
    where: { loanId },
    orderBy: { uploadedAt: 'desc' }
  });

  // Group documents by type
  const grouped = documents.reduce((acc: any, doc) => {
    const type = doc.documentType;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(doc);
    return acc;
  }, {});

  const response: ApiResponse = {
    success: true,
    message: 'Loan documents retrieved successfully',
    data: {
      total: documents.length,
      documents,
      grouped
    }
  };

  res.json(response);
}));

// POST /api/documents/upload - Upload a document
router.post('/upload', upload.single('file'), [
  body('documentType').isString().notEmpty().withMessage('Document type is required'),
  body('customerId').optional().isString(),
  body('loanId').optional().isString(),
  body('description').optional().isString()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  if (!req.file) {
    const response: ApiResponse = {
      success: false,
      message: 'No file uploaded'
    };
    res.status(400).json(response);
    return;
  }

  const { documentType, customerId, loanId, description } = req.body;

  // Validate document type
  if (!Object.values(DocumentType).includes(documentType)) {
    const response: ApiResponse = {
      success: false,
      message: 'Invalid document type'
    };
    res.status(400).json(response);
    return;
  }

  const document = await prisma.document.create({
    data: {
      documentType: documentType as DocumentType,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileUrl: getFileUrl(req.file.filename),
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      customerId: customerId || null,
      loanId: loanId || null,
      description: description || null,
      status: DocumentStatus.PENDING_VERIFICATION
    }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Document uploaded successfully',
    data: document
  };

  res.status(201).json(response);
}));

// POST /api/documents/upload-multiple - Upload multiple documents
router.post('/upload-multiple', upload.array('files', 10), [
  body('documentType').isString().notEmpty().withMessage('Document type is required'),
  body('customerId').optional().isString(),
  body('loanId').optional().isString(),
  body('description').optional().isString()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const files = req.files as Express.Multer.File[];
  
  if (!files || files.length === 0) {
    const response: ApiResponse = {
      success: false,
      message: 'No files uploaded'
    };
    res.status(400).json(response);
    return;
  }

  const { documentType, customerId, loanId, description } = req.body;

  // Validate document type
  if (!Object.values(DocumentType).includes(documentType)) {
    const response: ApiResponse = {
      success: false,
      message: 'Invalid document type'
    };
    res.status(400).json(response);
    return;
  }

  const documents = await Promise.all(
    files.map(file => 
      prisma.document.create({
        data: {
          documentType: documentType as DocumentType,
          fileName: file.filename,
          originalName: file.originalname,
          filePath: file.path,
          fileUrl: getFileUrl(file.filename),
          mimeType: file.mimetype,
          fileSize: file.size,
          customerId: customerId || null,
          loanId: loanId || null,
          description: description || null,
          status: DocumentStatus.PENDING_VERIFICATION
        }
      })
    )
  );

  const response: ApiResponse = {
    success: true,
    message: `${documents.length} documents uploaded successfully`,
    data: documents
  };

  res.status(201).json(response);
}));

// PUT /api/documents/:id/verify - Verify a document
router.put('/:id/verify', [
  param('id').isString().notEmpty(),
  body('status').isIn(['VERIFIED', 'REJECTED']).withMessage('Status must be VERIFIED or REJECTED'),
  body('rejectionReason').optional().isString()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const { status, rejectionReason } = req.body;
  const userId = (req as any).user.userId;

  const document = await prisma.document.findUnique({
    where: { id }
  });

  if (!document) {
    const response: ApiResponse = {
      success: false,
      message: 'Document not found'
    };
    res.status(404).json(response);
    return;
  }

  const updatedDocument = await prisma.document.update({
    where: { id },
    data: {
      status: status as DocumentStatus,
      verifiedById: userId,
      verifiedAt: new Date(),
      rejectionReason: status === 'REJECTED' ? rejectionReason : null
    }
  });

  const response: ApiResponse = {
    success: true,
    message: `Document ${status.toLowerCase()} successfully`,
    data: updatedDocument
  };

  res.json(response);
}));

// PUT /api/documents/:id - Update document metadata
router.put('/:id', [
  param('id').isString().notEmpty(),
  body('description').optional().isString(),
  body('expiryDate').optional().isISO8601()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const { description, expiryDate } = req.body;

  const document = await prisma.document.update({
    where: { id },
    data: {
      description: description !== undefined ? description : undefined,
      expiryDate: expiryDate !== undefined ? new Date(expiryDate) : undefined
    }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Document updated successfully',
    data: document
  };

  res.json(response);
}));

// DELETE /api/documents/:id - Delete a document
router.delete('/:id', [
  param('id').isString().notEmpty()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;

  const document = await prisma.document.findUnique({
    where: { id }
  });

  if (!document) {
    const response: ApiResponse = {
      success: false,
      message: 'Document not found'
    };
    res.status(404).json(response);
    return;
  }

  // Delete file from filesystem
  try {
    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }

  // Delete from database
  await prisma.document.delete({
    where: { id }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Document deleted successfully'
  };

  res.json(response);
}));

// GET /api/documents/:id/download - Download a document
router.get('/:id/download', [
  param('id').isString().notEmpty()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;

  const document = await prisma.document.findUnique({
    where: { id }
  });

  if (!document) {
    const response: ApiResponse = {
      success: false,
      message: 'Document not found'
    };
    res.status(404).json(response);
    return;
  }

  if (!fs.existsSync(document.filePath)) {
    const response: ApiResponse = {
      success: false,
      message: 'File not found on server'
    };
    res.status(404).json(response);
    return;
  }

  res.download(document.filePath, document.originalName);
}));

export default router;
