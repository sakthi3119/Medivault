import admin from "firebase-admin";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "../utils/appError.js";

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

function initFirebase() {
  if (admin.apps.length) return admin.app();

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new AppError(
      "Firebase Storage is not configured. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
      500
    );
  }

  const privateKey = String(privateKeyRaw).replace(/\\n/g, "\n");

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    storageBucket,
  });
}

export function getBucket() {
  const app = initFirebase();
  const bucket = admin.storage(app).bucket();
  if (!bucket?.name) {
    throw new AppError(
      "Firebase bucket is not configured. Set FIREBASE_STORAGE_BUCKET to '<project-id>.appspot.com' (or your bucket name).",
      500
    );
  }
  return bucket;
}

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

function safeName(name) {
  return String(name || "file")
    .trim()
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 120);
}

export async function uploadToFirebase(req, res, next) {
  if (!req.file) return next();
  try {
    const bucket = getBucket();
    const userId = req.user?._id?.toString() || "anonymous";
    const ext = safeName(req.file.originalname).split(".").pop();
    const base = safeName(req.file.originalname).replace(/\.[^/.]+$/, "");
    const id = uuidv4();
    const filePath = `mediavault/${userId}/${base}-${id}${ext ? `.${ext}` : ""}`;

    const file = bucket.file(filePath);
    await file.save(req.file.buffer, {
      resumable: false,
      contentType: req.file.mimetype,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    const [url] = await file.getSignedUrl({
      action: "read",
      expires: "2099-01-01",
    });

    req.file.path = url; // keep controller contract
    req.file.filename = filePath; // store path in filePublicId field
    next();
  } catch (err) {
    console.error("Firebase upload failed:", err?.message || err);
    next(new AppError("Upload failed. Please try again.", 500));
  }
}

