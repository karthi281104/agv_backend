import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const isCloudinaryEnabled = !!process.env.CLOUDINARY_CLOUD_NAME && !!process.env.CLOUDINARY_API_KEY;

let storage: any;

if (isCloudinaryEnabled) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req: any, file: Express.Multer.File) => {
      const isPdf = file.mimetype === 'application/pdf';
      return {
        folder: 'agv_uploads',
        resource_type: isPdf ? 'raw' : 'auto',
        public_id: file.fieldname + '-' + Date.now()
      };
    }
  });
} else {
  // Configure fallback disk storage
  storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname);
      cb(null, file.fieldname + '-' + uniqueSuffix + extension);
    }
  });
}

// File filter
const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // Accept images and PDFs only
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'), false);
  }
};

// Configure multer
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
  },
  fileFilter: fileFilter
});

// Helper to get file URL
export const getFileUrl = (filename: string, file?: any): string => {
  if (file?.path && file.path.startsWith('http')) {
    return file.path; // Return Cloudinary URL directly
  }
  return `${process.env.BASE_URL || 'http://localhost:3001'}/uploads/${filename}`;
};