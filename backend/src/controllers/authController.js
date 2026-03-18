import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";
import { signJwt } from "../utils/jwt.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export const register = asyncHandler(async (req, res, next) => {
  const {
    name,
    email,
    password,
    role = "patient",
    specialization,
    hospitalName,
    dateOfBirth,
    bloodGroup,
    phone,
    address,
  } = req.body || {};

  if (!name || !email || !password) return next(new AppError("Please provide name, email, and password.", 400));
  if (!["patient", "doctor"].includes(role)) return next(new AppError("Invalid role selected.", 400));
  if (role === "doctor" && !specialization) {
    return next(new AppError("Doctors must provide a specialization.", 400));
  }
  if (role === "doctor" && !hospitalName) {
    return next(new AppError("Doctors must provide a hospital / clinic name.", 400));
  }

  const cleanEmail = normalizeEmail(email);
  const existing = await User.findOne({ email: cleanEmail });
  if (existing) return next(new AppError("An account with this email already exists.", 409));

  const user = await User.create({
    name: String(name).trim(),
    email: cleanEmail,
    password: String(password),
    role,
    specialization: role === "doctor" ? String(specialization).trim() : undefined,
    hospitalName: role === "doctor" ? String(hospitalName).trim() : undefined,
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    bloodGroup: bloodGroup ? String(bloodGroup).trim() : undefined,
    phone: phone ? String(phone).trim() : undefined,
    address: address ? String(address).trim() : undefined,
  });

  const token = signJwt({ id: user._id.toString() });
  res.status(201).json({ token, user });
});

export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body || {};
  if (!email || !password) return next(new AppError("Please provide email and password.", 400));

  const user = await User.findOne({ email: normalizeEmail(email) }).select("+password");
  if (!user || !user.isActive) return next(new AppError("Invalid email or password.", 401));

  const ok = await user.comparePassword(String(password));
  if (!ok) return next(new AppError("Invalid email or password.", 401));

  const token = signJwt({ id: user._id.toString() });
  res.json({ token, user: user.toJSON() });
});

export const getMe = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

export const updateProfile = asyncHandler(async (req, res, next) => {
  const allowed = ["name", "phone", "address", "bloodGroup", "dateOfBirth", "specialization", "hospitalName"];
  const updates = {};

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) updates[key] = req.body[key];
  }

  if (updates.name != null) updates.name = String(updates.name).trim();
  if (updates.phone != null) updates.phone = String(updates.phone).trim();
  if (updates.address != null) updates.address = String(updates.address).trim();
  if (updates.bloodGroup != null) updates.bloodGroup = String(updates.bloodGroup).trim();
  if (updates.specialization != null) updates.specialization = String(updates.specialization).trim();
  if (updates.hospitalName != null) updates.hospitalName = String(updates.hospitalName).trim();
  if (updates.dateOfBirth != null) updates.dateOfBirth = updates.dateOfBirth ? new Date(updates.dateOfBirth) : null;

  if (req.user.role !== "doctor") {
    delete updates.specialization;
    delete updates.hospitalName;
  }
  if (req.user.role === "doctor") {
    if (updates.specialization === "") return next(new AppError("Specialization can't be empty for doctor accounts.", 400));
    if (updates.hospitalName === "") return next(new AppError("Hospital / clinic name can't be empty for doctor accounts.", 400));
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  res.json({ user });
});

export const setE2eeKeys = asyncHandler(async (req, res, next) => {
  const {
    publicKeyJwk,
    encryptedPrivateKey,
    kdfSalt,
    kdfIterations,
    privateKeyIv,
    version,
  } = req.body || {};

  if (!publicKeyJwk || typeof publicKeyJwk !== "object") {
    return next(new AppError("Invalid public key.", 400));
  }
  if (!encryptedPrivateKey || typeof encryptedPrivateKey !== "string") {
    return next(new AppError("Invalid encrypted private key.", 400));
  }
  if (!kdfSalt || typeof kdfSalt !== "string") {
    return next(new AppError("Invalid key derivation salt.", 400));
  }
  const iters = Number(kdfIterations);
  if (!Number.isFinite(iters) || iters < 10000 || iters > 2000000) {
    return next(new AppError("Invalid key derivation iterations.", 400));
  }
  if (!privateKeyIv || typeof privateKeyIv !== "string") {
    return next(new AppError("Invalid private key IV.", 400));
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      e2eePublicKeyJwk: publicKeyJwk,
      e2eeEncryptedPrivateKey: encryptedPrivateKey,
      e2eeKdfSalt: kdfSalt,
      e2eeKdfIterations: Math.floor(iters),
      e2eePrivateKeyIv: privateKeyIv,
      e2eeVersion: version ? String(version).trim() : "E2EE-v1",
    },
    { new: true, runValidators: true }
  );

  res.json({ user });
});

