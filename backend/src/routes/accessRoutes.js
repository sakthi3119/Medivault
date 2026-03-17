import express from "express";
import { protect } from "../middleware/auth.js";
import { accessSharedRecords, createAccessToken, getMyTokens, revokeToken } from "../controllers/accessTokenController.js";

const router = express.Router();

router.get("/shared/:token", accessSharedRecords);

router.use(protect);
router.post("/", createAccessToken);
router.get("/", getMyTokens);
router.patch("/:token/revoke", revokeToken);

export default router;

