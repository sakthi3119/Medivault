import mongoose from "mongoose";

const recordTypes = [
  "Lab Report",
  "Prescription",
  "Discharge Summary",
  "Radiology",
  "Vaccination",
  "Insurance",
  "Surgery Report",
  "Consultation Notes",
  "Other",
];

const recordSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    type: { type: String, enum: recordTypes, required: true, index: true },
    description: { type: String, trim: true, maxlength: 2000 },
    fileUrl: { type: String, required: true },
    filePublicId: { type: String, required: true },
    fileName: { type: String, required: true, trim: true, maxlength: 255 },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true, trim: true, maxlength: 120 },
    storageResourceType: { type: String, enum: ["image", "raw"], default: "raw" },

    // E2EE metadata (ciphertext stored on Cloudinary; plaintext never stored)
    isEncrypted: { type: Boolean, default: false, index: true },
    encryptionAlg: { type: String, default: "" },
    encryptionIv: { type: String, default: "" },
    wrappedKeyOwner: { type: String, default: "" },
    doctorName: { type: String, trim: true, maxlength: 180 },
    hospitalName: { type: String, trim: true, maxlength: 180 },
    recordDate: { type: Date, required: true, index: true },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    isArchived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

recordSchema.index({ patient: 1, recordDate: -1 });

export const Record = mongoose.model("Record", recordSchema);
export const RECORD_TYPES = recordTypes;

