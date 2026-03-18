import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { AppError } from "../utils/appError.js";

// Allowed file types
const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function fileFilter(req, file, cb) {
  if (!allowedMimeTypes.has(file.mimetype)) {
    cb(new AppError("Unsupported file type. Please upload PDF, JPG, PNG, or DOCX.", 400));
    return;
  }
  cb(null, true);
}

// Configure Cloudinary from env vars
function initCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError(
      "Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
      500
    );
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  return cloudinary;
}

// Multer — store file in memory, then stream to Cloudinary
export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// Determine the Cloudinary resource_type based on mime
function resourceType(mimetype) {
  if (mimetype === "application/pdf") return "raw";
  if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    return "raw";
  return "image"; // jpeg / png
}

// Upload middleware — streams buffer to Cloudinary
export async function uploadToCloudinary(req, res, next) {
  if (!req.file) return next();
  try {
    const cld = initCloudinary();
    const userId = req.user?._id?.toString() || "anonymous";
    const resType = resourceType(req.file.mimetype);

    const result = await new Promise((resolve, reject) => {
      const stream = cld.uploader.upload_stream(
        {
          folder: `medivault/${userId}`,
          resource_type: resType,
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    // Keep the same interface the controller expects
    req.file.path = result.secure_url;       // fileUrl
    req.file.filename = result.public_id;    // filePublicId  (used for deletion)
    next();
  } catch (err) {
    console.error("Cloudinary upload failed:", err?.message || err);
    next(new AppError("Upload failed. Please try again.", 500));
  }
}

// Delete a file from Cloudinary (called on record delete)
export async function deleteFromCloudinary(publicId, mimetype) {
  if (!publicId) return;
  try {
    const cld = initCloudinary();
    const resType = resourceType(mimetype || "image/jpeg");
    await cld.uploader.destroy(publicId, { resource_type: resType });
  } catch (err) {
    console.error("Cloudinary delete failed:", err?.message || err);
  }
}
