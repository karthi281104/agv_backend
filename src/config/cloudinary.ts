import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Define allowed file types
const ALLOWED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];
const ALLOWED_DOCUMENT_FORMATS = ['jpg', 'jpeg', 'png', 'pdf'];

// Storage configuration for customer documents (Aadhar, PAN, etc.)
const documentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req: any, file: any) => {
    return {
      folder: 'agv-loans/documents',
      allowed_formats: ALLOWED_DOCUMENT_FORMATS,
      public_id: `doc-${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, '')}`,
      resource_type: 'auto',
    };
  },
});

// Storage configuration for gold item photos
const goldItemStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req: any, file: any) => {
    return {
      folder: 'agv-loans/gold-items',
      allowed_formats: ALLOWED_IMAGE_FORMATS,
      public_id: `gold-${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, '')}`,
      transformation: [
        { width: 1200, height: 1200, crop: 'limit', quality: 'auto' }
      ],
    };
  },
});

// Storage configuration for customer profile photos
const profilePhotoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req: any, file: any) => {
    return {
      folder: 'agv-loans/profiles',
      allowed_formats: ALLOWED_IMAGE_FORMATS,
      public_id: `profile-${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, '')}`,
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto' }
      ],
    };
  },
});

// Multer upload configurations with file size limits
export const uploadDocument = multer({
  storage: documentStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for documents
  },
  fileFilter: (req, file, cb) => {
    const ext = file.mimetype.split('/')[1];
    if (ALLOWED_DOCUMENT_FORMATS.includes(ext) || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and PDF are allowed.'));
    }
  },
});

export const uploadGoldPhoto = multer({
  storage: goldItemStorage,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB limit for photos
  },
  fileFilter: (req, file, cb) => {
    const ext = file.mimetype.split('/')[1];
    if (ALLOWED_IMAGE_FORMATS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and WEBP images are allowed.'));
    }
  },
});

export const uploadProfilePhoto = multer({
  storage: profilePhotoStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for profile photos
  },
  fileFilter: (req, file, cb) => {
    const ext = file.mimetype.split('/')[1];
    if (ALLOWED_IMAGE_FORMATS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and WEBP images are allowed.'));
    }
  },
});

export { cloudinary };
