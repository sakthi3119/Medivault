import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/appError.js";

function requirePatient(user) {
  if (user?.role !== "patient") throw new AppError("This action is only available for patient accounts.", 403);
}

export const listDoctors = asyncHandler(async (req, res) => {
  requirePatient(req.user);

  const doctors = await User.find({ role: "doctor", isActive: true })
    .select("name email specialization hospitalName")
    .sort({ name: 1 });

  res.json({ doctors });
});
