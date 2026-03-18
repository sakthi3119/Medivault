import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { AccessToken } from "../models/AccessToken.js";
import { Record } from "../models/Record.js";
import { User } from "../models/User.js";
import { getSignedCloudinaryUrl } from "../config/cloudinaryStorage.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";

function requirePatient(user) {
  if (user?.role !== "patient") throw new AppError("This action is only available for patient accounts.", 403);
}

function requireDoctor(user) {
  if (user?.role !== "doctor") throw new AppError("This action is only available for doctor accounts.", 403);
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

  const { recordIds, allRecords = false, doctorId, doctorEmail, label, expiresIn, expiresAt, recordKeys } = req.body || {};

  let exp = expiresAt ? new Date(expiresAt) : parseExpiresIn(expiresIn);
  if (!exp || Number.isNaN(exp.getTime())) return next(new AppError("Please choose a valid expiry duration.", 400));
  if (exp.getTime() <= Date.now()) return next(new AppError("Expiry time must be in the future.", 400));

  let validatedRecordIds = [];
  if (!Array.isArray(recordIds)) {
    if (!allRecords) return next(new AppError("Select at least one record (or enable All Records).", 400));
  } else if (recordIds.length > 0) {
    const ids = recordIds.filter((id) => mongoose.isValidObjectId(id));
    if (ids.length !== recordIds.length) return next(new AppError("One or more selected records are invalid.", 400));

    const count = await Record.countDocuments({ _id: { $in: ids }, patient: req.user._id });
    if (count !== ids.length) return next(new AppError("One or more selected records weren't found.", 404));
    validatedRecordIds = ids;
  } else if (!allRecords) {
    return next(new AppError("Select at least one record (or enable All Records).", 400));
  }

  let selectedDoctorId;
  if (doctorId != null && String(doctorId).trim() !== "") {
    const id = String(doctorId).trim();
    if (!mongoose.isValidObjectId(id)) return next(new AppError("Invalid doctor selected.", 400));
    const doctor = await User.findOne({ _id: id, role: "doctor", isActive: true }).select("_id");
    if (!doctor) return next(new AppError("Selected doctor was not found.", 404));
    selectedDoctorId = doctor._id;
  }

  const normalizedDoctorEmail = doctorEmail ? String(doctorEmail).trim().toLowerCase() : "";
  if (!selectedDoctorId && !normalizedDoctorEmail) {
    return next(new AppError("Please select a doctor to share with.", 400));
  }

  // If records are specified, validate E2EE wrapped keys for encrypted records
  let normalizedRecordKeys = [];
  if (validatedRecordIds.length > 0) {
    const records = await Record.find({ _id: { $in: validatedRecordIds }, patient: req.user._id }).select(
      "_id isEncrypted"
    );
    const encryptedIds = records.filter((r) => r.isEncrypted).map((r) => r._id.toString());

    if (encryptedIds.length > 0) {
      if (!Array.isArray(recordKeys) || recordKeys.length === 0) {
        return next(
          new AppError(
            "Encrypted records require per-record keys for the selected doctor. Please re-create the link.",
            400
          )
        );
      }

      const keyMap = new Map();
      for (const entry of recordKeys) {
        const rid = String(entry?.recordId || "").trim();
        const wk = String(entry?.wrappedKey || "").trim();
        if (!rid || !wk) continue;
        if (!mongoose.isValidObjectId(rid)) continue;
        keyMap.set(rid, wk);
      }

      for (const rid of encryptedIds) {
        if (!keyMap.has(rid)) {
          return next(new AppError("Missing encrypted key for one or more records.", 400));
        }
      }

      normalizedRecordKeys = encryptedIds.map((rid) => ({ recordId: rid, wrappedKey: keyMap.get(rid) }));
    }
  } else if (allRecords) {
    // All-records link without explicit record IDs cannot support E2EE safely.
    // Client should send explicit recordIds + recordKeys snapshot.
    if (Array.isArray(recordKeys) && recordKeys.length > 0) {
      return next(new AppError("All-records links must include recordIds when providing recordKeys.", 400));
    }

    const hasEncrypted = await Record.exists({ patient: req.user._id, isEncrypted: true });
    if (hasEncrypted) {
      return next(
        new AppError(
          "You have encrypted records. Please share a snapshot (recordIds) so per-record keys can be included.",
          400
        )
      );
    }
  }

  const token = uuidv4();
  const doc = await AccessToken.create({
    patient: req.user._id,
    doctor: selectedDoctorId,
    token,
    recordIds: allRecords ? validatedRecordIds : validatedRecordIds,
    recordKeys: normalizedRecordKeys,
    allRecords: Boolean(allRecords),
    doctorEmail: normalizedDoctorEmail || undefined,
    label: label ? String(label).trim() : undefined,
    expiresAt: exp,
  });

  res.status(201).json({ token: doc });
});

export const getMyTokens = asyncHandler(async (req, res) => {
  requirePatient(req.user);
  const tokens = await AccessToken.find({ patient: req.user._id })
    .sort({ createdAt: -1 })
    .populate("recordIds", "title type recordDate doctorName hospitalName")
    .populate("doctor", "name email specialization hospitalName");

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

  const doc = await AccessToken.findOne({ token })
    .populate("patient", "name email")
    .populate("doctor", "_id email");
  if (!doc) return next(new AppError("This share link doesn't exist.", 404));
  if (!doc.isValid()) return next(new AppError("This share link has expired or was revoked.", 410));

  const viewer = req.user;
  const viewerId = viewer?._id?.toString();
  const patientId = doc.patient?._id?.toString();
  const assignedDoctorId = doc.doctor?._id?.toString();
  const assignedDoctorEmail = doc.doctorEmail ? String(doc.doctorEmail).trim().toLowerCase() : "";

  const isOwnerPatient = viewer?.role === "patient" && viewerId && patientId && viewerId === patientId;
  const isAssignedDoctor =
    viewer?.role === "doctor" &&
    viewerId &&
    ((assignedDoctorId && viewerId === assignedDoctorId) ||
      (assignedDoctorEmail && String(viewer.email || "").toLowerCase() === assignedDoctorEmail));

  if (!isOwnerPatient && !isAssignedDoctor) {
    return next(new AppError("You don't have permission to view these records.", 403));
  }

  const hasSnapshotIds = Array.isArray(doc.recordIds) && doc.recordIds.length > 0;
  const recordFilter = doc.allRecords && !hasSnapshotIds
    ? { patient: doc.patient._id }
    : { _id: { $in: doc.recordIds }, patient: doc.patient._id };

  const records = await Record.find(recordFilter).sort({ recordDate: -1 });

  doc.accessCount += 1;
  if (!doc.usedAt) doc.usedAt = new Date();
  await doc.save();

  const keyMap = new Map(
    Array.isArray(doc.recordKeys)
      ? doc.recordKeys.map((k) => [k.recordId?.toString?.() || String(k.recordId), k.wrappedKey])
      : []
  );

  res.json({
    patient: {
      name: firstName(doc.patient.name),
    },
    token: {
      expiresAt: doc.expiresAt,
      accessCount: doc.accessCount,
      label: doc.label || null,
    },
    records: records.map((r) => {
      const obj = r.toObject();
      const isEncrypted = Boolean(obj.isEncrypted);
      const viewerWrappedKey =
        isEncrypted && viewer?.role === "doctor" ? keyMap.get(String(obj._id)) || "" : isEncrypted ? obj.wrappedKeyOwner || "" : "";
      const { wrappedKeyOwner, ...safeObj } = obj;
      return {
        ...safeObj,
        fileUrl:
          getSignedCloudinaryUrl({
            publicId: obj.filePublicId,
            mimetype: obj.mimeType,
            originalName: obj.fileName,
            storageResourceType: obj.storageResourceType,
            expiresInSeconds: 15 * 60,
          }) || obj.fileUrl,
        ...(isEncrypted
          ? {
              isEncrypted: true,
              encryptionAlg: obj.encryptionAlg || "AES-256-GCM",
              encryptionIv: obj.encryptionIv,
              wrappedKey: viewerWrappedKey,
            }
          : { isEncrypted: false }),
      };
    }),
  });
});

export const getAssignedTokens = asyncHandler(async (req, res) => {
  requireDoctor(req.user);

  const now = new Date();
  const tokens = await AccessToken.find({
    doctor: req.user._id,
    isRevoked: false,
    expiresAt: { $gt: now },
  })
    .sort({ createdAt: -1 })
    .populate("patient", "name")
    .populate("recordIds", "title type recordDate");

  res.json({ tokens });
});

export const getSharedRecordCipher = asyncHandler(async (req, res, next) => {
  const { token, recordId } = req.params;
  if (!token || !recordId) return next(new AppError("Invalid request.", 400));
  if (!mongoose.isValidObjectId(recordId)) return next(new AppError("Invalid record id.", 400));

  const doc = await AccessToken.findOne({ token })
    .populate("patient", "_id email")
    .populate("doctor", "_id email");
  if (!doc) return next(new AppError("This share link doesn't exist.", 404));
  if (!doc.isValid()) return next(new AppError("This share link has expired or was revoked.", 410));

  const viewer = req.user;
  const viewerId = viewer?._id?.toString();
  const patientId = doc.patient?._id?.toString();
  const assignedDoctorId = doc.doctor?._id?.toString();
  const assignedDoctorEmail = doc.doctorEmail ? String(doc.doctorEmail).trim().toLowerCase() : "";

  const isOwnerPatient = viewer?.role === "patient" && viewerId && patientId && viewerId === patientId;
  const isAssignedDoctor =
    viewer?.role === "doctor" &&
    viewerId &&
    ((assignedDoctorId && viewerId === assignedDoctorId) ||
      (assignedDoctorEmail && String(viewer.email || "").toLowerCase() === assignedDoctorEmail));

  if (!isOwnerPatient && !isAssignedDoctor) {
    return next(new AppError("You don't have permission to view these records.", 403));
  }

  const hasSnapshotIds = Array.isArray(doc.recordIds) && doc.recordIds.length > 0;
  const restrictToSnapshot = !doc.allRecords || hasSnapshotIds;
  if (restrictToSnapshot && hasSnapshotIds) {
    const allowed = new Set(doc.recordIds.map((x) => x.toString()));
    if (!allowed.has(String(recordId))) {
      return next(new AppError("Record not included in this share link.", 403));
    }
  }

  const record = await Record.findOne({ _id: recordId, patient: doc.patient._id });
  if (!record) return next(new AppError("Record not found.", 404));

  const url =
    getSignedCloudinaryUrl({
      publicId: record.filePublicId,
      mimetype: record.mimeType,
      originalName: record.fileName,
      storageResourceType: record.storageResourceType,
      expiresInSeconds: 15 * 60,
    }) ||
    record.fileUrl;

  if (!url) return next(new AppError("File not available.", 404));

  const resp = await fetch(url);
  if (!resp.ok) return next(new AppError("Failed to download file.", 502));
  const ab = await resp.arrayBuffer();
  const buf = Buffer.from(ab);

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Cache-Control", "no-store");
  res.send(buf);
});

