import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../Config/cloudinary.js";

// Cloudinary storage for photos
const photoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "FamousData/photos",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 800, height: 800, crop: "limit" }],
  },
});

// Cloudinary storage for documents
const documentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "FamousData/documents",
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
  },
});

// Cloudinary storage for biometrics
const biometricStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "FamousData/biometrics",
    allowed_formats: ["jpg", "jpeg", "png"],
  },
});

// Upload middleware with Cloudinary storage
const upload = multer({
  storage: multer.diskStorage({}), // Placeholder, will use field-specific storage
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 50, // Max 50 files
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    }
  },
});

// Error handling middleware for multer
export const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "FILE_TOO_LARGE") {
      return res.status(400).json({
        success: false,
        message: "File size exceeds 10MB limit",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files uploaded",
      });
    }
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  next();
};

export default upload;
