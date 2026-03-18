import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { AppError } from "../utils/appError.js";

// Allowed file types
const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream", // ciphertext uploads (E2EE)
]);

function isEncryptedUpload(req) {
  const v = req?.body?.isEncrypted;
  return v === true || v === "true" || v === "1";
}

function isAllowedOriginalMime(mimetype) {
  return (
    mimetype === "image/jpeg" ||
    mimetype === "image/png" ||
    mimetype === "application/pdf" ||
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

function fileFilter(req, file, cb) {
  if (!allowedMimeTypes.has(file.mimetype)) {
    cb(new AppError("Unsupported file type. Please upload PDF, JPG, PNG, or DOCX.", 400));
    return;
  }

  if (file.mimetype === "application/octet-stream") {
    if (!isEncryptedUpload(req)) {
      cb(new AppError("Invalid encrypted upload.", 400));
      return;
    }
    const originalMimeType = String(req?.body?.originalMimeType || "").trim();
    if (!isAllowedOriginalMime(originalMimeType)) {
      cb(new AppError("Invalid original file type for encrypted upload.", 400));
      return;
    }
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
  if (mimetype === "application/octet-stream") return "raw";
  return "image"; // jpeg / png
}

function fileExtFromName(fileName) {
  const name = String(fileName || "").trim();
  const idx = name.lastIndexOf(".");
  if (idx <= 0 || idx === name.length - 1) return "";
  return name.slice(idx + 1).toLowerCase();
}

function fileExtFromMime(mimetype) {
  switch (mimetype) {
    case "application/pdf":
      return "pdf";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "docx";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    default:
      return "";
  }
}

function computeExpiresAtSeconds(expiresInSeconds) {
  const ttl = Number(expiresInSeconds);
  const safeTtl = Number.isFinite(ttl) && ttl > 0 ? Math.min(Math.floor(ttl), 24 * 60 * 60) : 15 * 60;
  return Math.floor(Date.now() / 1000) + safeTtl;
}

export function getSignedCloudinaryUrl({ publicId, mimetype, originalName, expiresInSeconds, storageResourceType } = {}) {
  if (!publicId) return "";
  const cld = initCloudinary();
  const forcedStorageType = String(storageResourceType || "").trim();
  const resType = forcedStorageType === "raw" || forcedStorageType === "image" ? forcedStorageType : resourceType(mimetype || "image/jpeg");
  const expiresAt = computeExpiresAtSeconds(expiresInSeconds);

  if (resType === "raw") {
    const isImageOriginal = mimetype === "image/jpeg" || mimetype === "image/png";
    const ext = (isImageOriginal ? "bin" : fileExtFromName(originalName) || fileExtFromMime(mimetype)) || "bin";
    return cld.utils.private_download_url(publicId, ext, {
      resource_type: "raw",
      type: "private",
      expires_at: expiresAt,
      secure: true,
    });
  }

  return cld.url(publicId, {
    resource_type: "image",
    type: "private",
    sign_url: true,
    expires_at: expiresAt,
    secure: true,
  });
}

// Upload middleware — streams buffer to Cloudinary
export async function uploadToCloudinary(req, res, next) {
  if (!req.file) return next();
  try {
    const cld = initCloudinary();
    const userId = req.user?._id?.toString() || "anonymous";
    const resType = isEncryptedUpload(req) ? "raw" : resourceType(req.file.mimetype);

    const result = await new Promise((resolve, reject) => {
      const stream = cld.uploader.upload_stream(
        {
          folder: `medivault/${userId}`,
          resource_type: resType,
          type: "private",
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
    req.file._cloudinaryResourceType = resType;
    next();
  } catch (err) {
    console.error("Cloudinary upload failed:", err?.message || err);
    next(new AppError("Upload failed. Please try again.", 500));
  }
}

// Delete a file from Cloudinary (called on record delete)
export async function deleteFromCloudinary(publicId, mimetype, resourceTypeOverride) {
  if (!publicId) return;
  try {
    const cld = initCloudinary();
    const resType = resourceTypeOverride || resourceType(mimetype || "image/jpeg");
    await cld.uploader.destroy(publicId, { resource_type: resType });
  } catch (err) {
    console.error("Cloudinary delete failed:", err?.message || err);
  }
}
