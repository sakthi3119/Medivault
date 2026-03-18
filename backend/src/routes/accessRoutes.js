import express from "express";
import { doctorOnly, protect } from "../middleware/auth.js";
import { accessSharedRecords, createAccessToken, getAssignedTokens, getMyTokens, getSharedRecordCipher, revokeToken } from "../controllers/accessTokenController.js";

const router = express.Router();

router.get("/shared/:token", protect, accessSharedRecords);
router.get("/shared/:token/cipher/:recordId", protect, getSharedRecordCipher);

router.use(protect);
router.get("/assigned", doctorOnly, getAssignedTokens);
router.post("/", createAccessToken);
router.get("/", getMyTokens);
router.patch("/:token/revoke", revokeToken);

export default router;

