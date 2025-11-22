import express from "express";
import {
  createVisit,
  getMyVisits,
  getVisitById,
  startVisit,
  updateVisit,
  addTreatment,
  updateTreatment,
  deleteTreatment,
  completeVisit,
  cancelVisit,
} from "../controllers/visitController.js";
import { protect, authorize } from "../middleware/auth.js";
import { mongoIdValidation, validate } from "../middleware/validation.js";
import {
  createVisitValidation,
  updateVisitValidation,
} from "../middleware/visitValidation.js";
import {
  addTreatmentValidation,
  updateTreatmentValidation,
} from "../middleware/treatmentValidation.js";

const router = express.Router();

// Patient routes
router.post(
  "/",
  protect,
  authorize("patient"),
  createVisitValidation,
  validate,
  createVisit
);

// Common routes (Patient/Doctor)
router.get("/my-visits", protect, authorize("patient", "doctor"), getMyVisits);
router.get("/:id", protect, mongoIdValidation, validate, getVisitById);
router.post(
  "/:id/cancel",
  protect,
  authorize("patient", "doctor"),
  mongoIdValidation,
  validate,
  cancelVisit
);

// Doctor routes
router.post(
  "/:id/start",
  protect,
  authorize("doctor"),
  mongoIdValidation,
  validate,
  startVisit
);

router.put(
  "/:id",
  protect,
  authorize("doctor"),
  mongoIdValidation,
  updateVisitValidation,
  validate,
  updateVisit
);

router.post(
  "/:id/treatments",
  protect,
  authorize("doctor"),
  mongoIdValidation,
  addTreatmentValidation,
  validate,
  addTreatment
);

router.put(
  "/:id/treatments/:treatmentId",
  protect,
  authorize("doctor"),
  updateTreatmentValidation,
  validate,
  updateTreatment
);

router.delete(
  "/:id/treatments/:treatmentId",
  protect,
  authorize("doctor"),
  deleteTreatment
);

router.post(
  "/:id/complete",
  protect,
  authorize("doctor"),
  mongoIdValidation,
  validate,
  completeVisit
);

export default router;
