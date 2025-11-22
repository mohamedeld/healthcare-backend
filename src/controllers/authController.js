import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { STATUS } from "../config/statusCodes.js";

/**
 * Generate JWT Token
 */
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, specialization, phone } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      message: "A user with this email already exists",
    });
  }

  // Validate doctor-specific fields
  if (role === "doctor" && !specialization) {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      message: "Specialization is required for doctors",
    });
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    role: role || "patient",
    specialization: role === "doctor" ? specialization : null,
    phone,
  });

  // Generate token
  const token = signToken(user._id);

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      specialization: user.specialization,
      phone: user.phone,
    },
  });
});

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      message: "Please provide email and password",
    });
  }

  // Find user and include password
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  // Check if password matches
  const isPasswordMatch = await user.comparePassword(password);

  if (!isPasswordMatch) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  // Check if account is active
  if (!user.isActive) {
    return res.status(401).json({
      success: false,
      message: "Your account has been deactivated. Please contact support.",
    });
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  // Generate token
  const token = signToken(user._id);

  res.status(STATUS.OK).json({
    success: true,
    message: "Login successful",
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      specialization: user.specialization,
      phone: user.phone,
      lastLogin: user.lastLogin,
    },
  });
});

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  res.status(STATUS.OK).json({
    success: true,
    user,
  });
});

/**
 * @desc    Get all active doctors
 * @route   GET /api/auth/doctors
 * @access  Private
 */
export const getDoctors = asyncHandler(async (req, res) => {
  const doctors = await User.find({
    role: "doctor",
    isActive: true,
  }).select("name email specialization phone");

  res.status(STATUS.OK).json({
    success: true,
    count: doctors.length,
    doctors,
  });
});

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, specialization } = req.body;

  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  // Update fields
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (specialization && user.role === "doctor")
    user.specialization = specialization;

  await user.save();

  res.status(STATUS.OK).json({
    success: true,
    message: "Profile updated successfully",
    user,
  });
});

/**
 * @desc    Change password
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      message: "Please provide current and new password",
    });
  }

  const user = await User.findById(req.user._id).select("+password");

  // Check current password
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: "Current password is incorrect",
    });
  }

  // Update password
  user.password = newPassword;
  await user.save();

  res.status(STATUS.OK).json({
    success: true,
    message: "Password changed successfully",
  });
});
