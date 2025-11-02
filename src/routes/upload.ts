import express from 'express';
import { uploadDocument, uploadGoldPhoto, uploadProfilePhoto, cloudinary } from '../config/cloudinary';
import { authenticateToken } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = express.Router();

// Apply authentication to all upload routes
router.use(authenticateToken);

/**
 * Upload customer document (Aadhar, PAN, etc.)
 * POST /api/upload/document
 */
router.post('/document', uploadDocument.single('file'), async (req: express.Request, res: express.Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
      return;
    }

    const file = req.file as any;
    
    const response: ApiResponse = {
      success: true,
      message: 'Document uploaded successfully',
      data: {
        url: file.path,
        publicId: file.filename,
        format: file.format,
        size: file.size,
        resourceType: file.resource_type,
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Document upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload document'
    });
  }
});

/**
 * Upload gold item photo
 * POST /api/upload/gold-photo
 */
router.post('/gold-photo', uploadGoldPhoto.single('photo'), async (req: express.Request, res: express.Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No photo uploaded'
      });
      return;
    }

    const file = req.file as any;
    
    const response: ApiResponse = {
      success: true,
      message: 'Gold item photo uploaded successfully',
      data: {
        url: file.path,
        publicId: file.filename,
        format: file.format,
        size: file.size,
        width: file.width,
        height: file.height,
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Gold photo upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload gold photo'
    });
  }
});

/**
 * Upload customer profile photo
 * POST /api/upload/profile-photo
 */
router.post('/profile-photo', uploadProfilePhoto.single('photo'), async (req: express.Request, res: express.Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No photo uploaded'
      });
      return;
    }

    const file = req.file as any;
    
    const response: ApiResponse = {
      success: true,
      message: 'Profile photo uploaded successfully',
      data: {
        url: file.path,
        publicId: file.filename,
        format: file.format,
        size: file.size,
        width: file.width,
        height: file.height,
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Profile photo upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload profile photo'
    });
  }
});

/**
 * Upload multiple files (batch upload)
 * POST /api/upload/multiple
 */
router.post('/multiple', uploadDocument.array('files', 10), async (req: express.Request, res: express.Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
      return;
    }

    const uploadedFiles = (req.files as any[]).map(file => ({
      url: file.path,
      publicId: file.filename,
      format: file.format,
      size: file.size,
    }));
    
    const response: ApiResponse = {
      success: true,
      message: `${uploadedFiles.length} files uploaded successfully`,
      data: {
        files: uploadedFiles,
        count: uploadedFiles.length,
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Multiple files upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload files'
    });
  }
});

/**
 * Delete file from Cloudinary
 * DELETE /api/upload/file/:publicId
 */
router.delete('/file/:publicId', async (req: express.Request, res: express.Response) => {
  try {
    const { publicId } = req.params;
    
    if (!publicId) {
      res.status(400).json({
        success: false,
        message: 'Public ID is required'
      });
      return;
    }

    // Replace URL-encoded slashes
    const decodedPublicId = decodeURIComponent(publicId);
    
    const result = await cloudinary.uploader.destroy(decodedPublicId);
    
    const response: ApiResponse = {
      success: result.result === 'ok',
      message: result.result === 'ok' ? 'File deleted successfully' : 'File not found or already deleted',
      data: result
    };

    res.json(response);
  } catch (error: any) {
    console.error('File deletion error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete file'
    });
  }
});

export default router;