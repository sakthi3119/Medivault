import express from "express";
import { protect } from "../middleware/auth.js";
import { upload, uploadToCloudinary } from "../config/cloudinaryStorage.js";
import {
  createRecord,
  deleteRecord,
  getRecordCipher,
  getMyRecords,
  getRecord,
  getStats,
  getTimeline,
  updateRecord,
} from "../controllers/recordController.js";

const router = express.Router();

router.use(protect);

router.get("/", getMyRecords);
router.get("/timeline", getTimeline);
router.get("/stats", getStats);
router.get("/:id/cipher", getRecordCipher);
router.get("/:id", getRecord);
router.post("/", upload.single("file"), uploadToCloudinary, createRecord);
router.put("/:id", updateRecord);
router.delete("/:id", deleteRecord);

export default router;

