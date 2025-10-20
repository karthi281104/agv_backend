import express from 'express';
import { upload, getFileUrl } from '../middleware/upload';
import { authenticateToken } from '../middleware/auth';
import { ApiResponse, FileUploadResponse } from '../types';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// POST /api/upload/single
router.post('/single', upload.single('file'), (req: express.Request, res: express.Response) => {
  if (!req.file) {
    const response: ApiResponse = {
      success: false,
      message: 'No file uploaded'
    };
    res.status(400).json(response);
    return;
  }

  const fileResponse: FileUploadResponse = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    url: getFileUrl(req.file.filename)
  };

  const response: ApiResponse<FileUploadResponse> = {
    success: true,
    message: 'File uploaded successfully',
    data: fileResponse
  };

  res.json(response);
});

// POST /api/upload/multiple
router.post('/multiple', upload.array('files', 10), (req: express.Request, res: express.Response) => {
  const files = req.files as Express.Multer.File[];
  
  if (!files || files.length === 0) {
    const response: ApiResponse = {
      success: false,
      message: 'No files uploaded'
    };
    res.status(400).json(response);
    return;
  }

  const fileResponses: FileUploadResponse[] = files.map(file => ({
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    url: getFileUrl(file.filename)
  }));

  const response: ApiResponse<FileUploadResponse[]> = {
    success: true,
    message: `${files.length} files uploaded successfully`,
    data: fileResponses
  };

  res.json(response);
});

// POST /api/upload/customer-documents
router.post('/customer-documents', 
  upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'aadharImage', maxCount: 1 },
    { name: 'panImage', maxCount: 1 },
    { name: 'incomeProof', maxCount: 1 }
  ]), 
  (req: express.Request, res: express.Response) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (!files || Object.keys(files).length === 0) {
      const response: ApiResponse = {
        success: false,
        message: 'No files uploaded'
      };
      res.status(400).json(response);
      return;
    }

    const uploadedFiles: { [key: string]: FileUploadResponse } = {};

    Object.keys(files).forEach(fieldName => {
      const file = files[fieldName][0];
      uploadedFiles[fieldName] = {
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url: getFileUrl(file.filename)
      };
    });

    const response: ApiResponse = {
      success: true,
      message: 'Customer documents uploaded successfully',
      data: uploadedFiles
    };

    res.json(response);
  }
);

// POST /api/upload/gold-images
router.post('/gold-images', upload.array('goldImages', 20), (req: express.Request, res: express.Response) => {
  const files = req.files as Express.Multer.File[];
  
  if (!files || files.length === 0) {
    const response: ApiResponse = {
      success: false,
      message: 'No gold images uploaded'
    };
    res.status(400).json(response);
    return;
  }

  const imageResponses: FileUploadResponse[] = files.map(file => ({
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    url: getFileUrl(file.filename)
  }));

  const response: ApiResponse<FileUploadResponse[]> = {
    success: true,
    message: `${files.length} gold images uploaded successfully`,
    data: imageResponses
  };

  res.json(response);
});

export default router;