import express from "express";
import { protect } from "../middleware/auth.js";
import { listDoctors } from "../controllers/doctorController.js";

const router = express.Router();

router.use(protect);
router.get("/", listDoctors);

export default router;
