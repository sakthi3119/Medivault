import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 190,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ["patient", "doctor"], default: "patient" },
    specialization: { type: String, trim: true, maxlength: 120 },
    hospitalName: { type: String, trim: true, maxlength: 180 },
    dateOfBirth: { type: Date },
    bloodGroup: { type: String, trim: true, maxlength: 10 },
    phone: { type: String, trim: true, maxlength: 32 },
    address: { type: String, trim: true, maxlength: 300 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  return obj;
};

export const User = mongoose.model("User", userSchema);

