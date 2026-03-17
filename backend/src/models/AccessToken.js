import mongoose from "mongoose";

const accessTokenSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    recordIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Record" }],
    allRecords: { type: Boolean, default: false },
    doctorEmail: { type: String, trim: true, lowercase: true, maxlength: 190 },
    label: { type: String, trim: true, maxlength: 120 },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date },
    isRevoked: { type: Boolean, default: false, index: true },
    accessCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

accessTokenSchema.methods.isValid = function isValid() {
  if (this.isRevoked) return false;
  if (!this.expiresAt) return false;
  return new Date(this.expiresAt).getTime() > Date.now();
};

export const AccessToken = mongoose.model("AccessToken", accessTokenSchema);

