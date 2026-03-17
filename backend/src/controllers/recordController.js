import mongoose from "mongoose";
import { Record, RECORD_TYPES } from "../models/Record.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";
import { getBucket } from "../config/firebaseStorage.js";

function requirePatient(user) {
  if (user?.role !== "patient") throw new AppError("This action is only available for patient accounts.", 403);
}

function pickRecordUpdate(body) {
  const allowed = ["title", "type", "description", "doctorName", "hospitalName", "recordDate", "tags", "isArchived"];
  const out = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body || {}, key)) out[key] = body[key];
  }
  if (out.title != null) out.title = String(out.title).trim();
  if (out.type != null && !RECORD_TYPES.includes(out.type)) throw new AppError("Invalid record type.", 400);
  if (out.description != null) out.description = String(out.description).trim();
  if (out.doctorName != null) out.doctorName = String(out.doctorName).trim();
  if (out.hospitalName != null) out.hospitalName = String(out.hospitalName).trim();
  if (out.recordDate != null) out.recordDate = out.recordDate ? new Date(out.recordDate) : null;
  if (out.tags != null) {
    if (Array.isArray(out.tags)) out.tags = out.tags.map((t) => String(t).trim()).filter(Boolean);
    else out.tags = String(out.tags).split(",").map((t) => t.trim()).filter(Boolean);
  }
  return out;
}

export const getMyRecords = asyncHandler(async (req, res) => {
  requirePatient(req.user);

  const {
    type,
    search,
    sort = "-recordDate",
    page = "1",
    limit = "12",
    archived,
  } = req.query || {};

  const filter = { patient: req.user._id };
  if (archived === "true") filter.isArchived = true;
  if (archived === "false") filter.isArchived = false;
  if (type && type !== "All") filter.type = type;

  if (search) {
    const q = String(search).trim();
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { doctorName: { $regex: q, $options: "i" } },
        { hospitalName: { $regex: q, $options: "i" } },
        { tags: { $in: [new RegExp(q, "i")] } },
      ];
    }
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    Record.find(filter).sort(String(sort)).skip(skip).limit(limitNum),
    Record.countDocuments(filter),
  ]);

  res.json({
    items,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 1,
    },
  });
});

export const getRecord = asyncHandler(async (req, res, next) => {
  requirePatient(req.user);
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return next(new AppError("Invalid record id.", 400));

  const record = await Record.findOne({ _id: id, patient: req.user._id });
  if (!record) return next(new AppError("Record not found.", 404));
  res.json({ record });
});

export const createRecord = asyncHandler(async (req, res, next) => {
  requirePatient(req.user);

  const { title, type, description, doctorName, hospitalName, recordDate, tags } = req.body || {};
  if (!title || !type || !recordDate) return next(new AppError("Please provide title, type, and record date.", 400));
  if (!RECORD_TYPES.includes(type)) return next(new AppError("Invalid record type.", 400));
  if (!req.file) return next(new AppError("Please upload a file (PDF, image, or DOCX).", 400));

  const fileUrl = req.file.path;
  const filePublicId = req.file.filename;
  const fileName = req.file.originalname;
  const fileSize = req.file.size;
  const mimeType = req.file.mimetype;

  const record = await Record.create({
    patient: req.user._id,
    title: String(title).trim(),
    type,
    description: description ? String(description).trim() : undefined,
    fileUrl,
    filePublicId,
    fileName,
    fileSize,
    mimeType,
    doctorName: doctorName ? String(doctorName).trim() : undefined,
    hospitalName: hospitalName ? String(hospitalName).trim() : undefined,
    recordDate: new Date(recordDate),
    tags: Array.isArray(tags)
      ? tags.map((t) => String(t).trim()).filter(Boolean)
      : String(tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
  });

  res.status(201).json({ record });
});

export const updateRecord = asyncHandler(async (req, res, next) => {
  requirePatient(req.user);
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return next(new AppError("Invalid record id.", 400));

  const updates = pickRecordUpdate(req.body);
  const record = await Record.findOneAndUpdate({ _id: id, patient: req.user._id }, updates, {
    new: true,
    runValidators: true,
  });
  if (!record) return next(new AppError("Record not found.", 404));
  res.json({ record });
});

async function deleteStoredFile(record) {
  if (!record?.filePublicId) return;
  try {
    const bucket = getBucket();
    await bucket.file(record.filePublicId).delete({ ignoreNotFound: true });
  } catch (err) {
    console.error("Storage delete failed:", err?.message || err);
  }
}

export const deleteRecord = asyncHandler(async (req, res, next) => {
  requirePatient(req.user);
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return next(new AppError("Invalid record id.", 400));

  const record = await Record.findOne({ _id: id, patient: req.user._id });
  if (!record) return next(new AppError("Record not found.", 404));

  await deleteStoredFile(record);
  await record.deleteOne();

  res.status(204).send();
});

export const getTimeline = asyncHandler(async (req, res) => {
  requirePatient(req.user);

  const rows = await Record.aggregate([
    { $match: { patient: req.user._id } },
    {
      $project: {
        title: 1,
        type: 1,
        doctorName: 1,
        hospitalName: 1,
        recordDate: 1,
        fileUrl: 1,
        year: { $year: "$recordDate" },
        month: { $month: "$recordDate" },
      },
    },
    { $sort: { recordDate: -1 } },
    {
      $group: {
        _id: { year: "$year", month: "$month" },
        records: { $push: "$$ROOT" },
      },
    },
    { $sort: { "_id.year": -1, "_id.month": -1 } },
  ]);

  const byYear = new Map();
  for (const r of rows) {
    const year = r._id.year;
    const month = r._id.month;
    if (!byYear.has(year)) byYear.set(year, new Map());
    byYear.get(year).set(month, r.records);
  }

  const timeline = Array.from(byYear.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, monthsMap]) => ({
      year,
      months: Array.from(monthsMap.entries())
        .sort(([a], [b]) => b - a)
        .map(([month, records]) => ({ month, records })),
    }));

  res.json({ timeline });
});

export const getStats = asyncHandler(async (req, res) => {
  requirePatient(req.user);

  const [byType, recent] = await Promise.all([
    Record.aggregate([
      { $match: { patient: req.user._id } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Record.find({ patient: req.user._id }).sort({ recordDate: -1 }).limit(5),
  ]);

  res.json({
    byType: byType.map((x) => ({ type: x._id, count: x.count })),
    recent,
  });
});

