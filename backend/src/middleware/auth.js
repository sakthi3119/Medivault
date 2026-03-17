import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { AppError } from "../utils/appError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [, token] = header.startsWith("Bearer ") ? header.split(" ") : [];

  if (!token) return next(new AppError("Please log in to continue.", 401));
  if (!process.env.JWT_SECRET) return next(new AppError("Server auth is not configured.", 500));

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(new AppError("Your session has expired. Please log in again.", 401));
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) return next(new AppError("Account not found or inactive.", 401));

  req.user = user;
  next();
});

export const restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(new AppError("Not authenticated.", 401));
    if (!roles.includes(req.user.role)) return next(new AppError("You don't have permission to do that.", 403));
    next();
  };

export const patientOnly = restrictTo("patient");
export const doctorOnly = restrictTo("doctor");

