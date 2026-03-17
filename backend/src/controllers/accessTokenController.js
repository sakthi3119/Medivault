import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { AccessToken } from "../models/AccessToken.js";
import { Record } from "../models/Record.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";

function requirePatient(user) {
  if (user?.role !== "patient") throw new AppError("This action is only available for patient accounts.", 403);
}

function parseExpiresIn(value) {
  const v = String(value || "").trim();
  if (!v) return null;
  const m = v.match(/^(\d+)\s*(h|d)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  if (!Number.isFinite(n) || n <= 0) return null;
  const hours = unit === "d" ? n * 24 : n;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function firstName(fullName) {
  const name = String(fullName || "").trim();
  return name ? name.split(/\s+/)[0] : "";
}

export const createAccessToken = asyncHandler(async (req, res, next) => {
  requirePatient(req.user);

  const { recordIds, allRecords = false, doctorEmail, label, expiresIn, expiresAt } = req.body || {};

  let exp = expiresAt ? new Date(expiresAt) : parseExpiresIn(expiresIn);
  if (!exp || Number.isNaN(exp.getTime())) return next(new AppError("Please choose a valid expiry duration.", 400));
  if (exp.getTime() <= Date.now()) return next(new AppError("Expiry time must be in the future.", 400));

  let validatedRecordIds = [];
  if (!allRecords) {
    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return next(new AppError("Select at least one record (or enable All Records).", 400));
    }
    const ids = recordIds.filter((id) => mongoose.isValidObjectId(id));
    if (ids.length !== recordIds.length) return next(new AppError("One or more selected records are invalid.", 400));

    const count = await Record.countDocuments({ _id: { $in: ids }, patient: req.user._id });
    if (count !== ids.length) return next(new AppError("One or more selected records weren't found.", 404));
    validatedRecordIds = ids;
  }

  const token = uuidv4();
  const doc = await AccessToken.create({
    patient: req.user._id,
    token,
    recordIds: allRecords ? [] : validatedRecordIds,
    allRecords: Boolean(allRecords),
    doctorEmail: doctorEmail ? String(doctorEmail).trim().toLowerCase() : undefined,
    label: label ? String(label).trim() : undefined,
    expiresAt: exp,
  });

  res.status(201).json({ token: doc });
});

export const getMyTokens = asyncHandler(async (req, res) => {
  requirePatient(req.user);
  const tokens = await AccessToken.find({ patient: req.user._id })
    .sort({ createdAt: -1 })
    .populate("recordIds", "title type recordDate doctorName hospitalName");

  res.json({ tokens });
});

export const revokeToken = asyncHandler(async (req, res, next) => {
  requirePatient(req.user);
  const { token } = req.params;
  if (!token) return next(new AppError("Invalid token.", 400));

  const doc = await AccessToken.findOneAndUpdate(
    { patient: req.user._id, token },
    { isRevoked: true },
    { new: true }
  );

  if (!doc) return next(new AppError("Share link not found.", 404));
  res.json({ token: doc });
});

export const accessSharedRecords = asyncHandler(async (req, res, next) => {
  const { token } = req.params;
  if (!token) return next(new AppError("Invalid share link.", 400));

  const doc = await AccessToken.findOne({ token }).populate("patient", "name email");
  if (!doc) return next(new AppError("This share link doesn't exist.", 404));
  if (!doc.isValid()) return next(new AppError("This share link has expired or was revoked.", 410));

  const recordFilter = doc.allRecords
    ? { patient: doc.patient._id }
    : { _id: { $in: doc.recordIds }, patient: doc.patient._id };

  const records = await Record.find(recordFilter).sort({ recordDate: -1 });

  doc.accessCount += 1;
  if (!doc.usedAt) doc.usedAt = new Date();
  await doc.save();

  res.json({
    patient: {
      name: firstName(doc.patient.name),
    },
    token: {
      expiresAt: doc.expiresAt,
      accessCount: doc.accessCount,
      label: doc.label || null,
    },
    records,
  });
});

