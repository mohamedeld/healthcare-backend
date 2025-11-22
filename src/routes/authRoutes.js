import express from "express";
import {
  register,
  login,
  getMe,
  getDoctors,
  updateProfile,
  changePassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import {
  loginValidation,
  registerValidation,
} from "../middleware/authValidation.js";

const router = express.Router();

// Public routes
router.post("/register", registerValidation, validate, register);
router.post("/login", loginValidation, validate, login);

// Protected routes
router.get("/me", protect, getMe);
router.get("/doctors", protect, getDoctors);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

export default router;
