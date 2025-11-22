import express from "express";
import {
  searchVisits,
  updatePaymentStatus,
  getDashboardStats,
  getVisitDetails,
  exportVisits,
} from "../controllers/financeController.js";
import { protect, authorize } from "../middleware/auth.js";
import {
  updatePaymentValidation,
  searchValidation,
  mongoIdValidation,
  validate,
} from "../middleware/validation.js";

const router = express.Router();

// All routes are protected and only for finance role
router.use(protect);
router.use(authorize("finance"));

router.get("/visits", searchValidation, validate, searchVisits);
router.get("/visits/:id", mongoIdValidation, validate, getVisitDetails);
router.put(
  "/visits/:id/payment",
  mongoIdValidation,
  updatePaymentValidation,
  validate,
  updatePaymentStatus
);
router.get("/dashboard", getDashboardStats);
router.get("/export", exportVisits);

export default router;
