import { body } from "express-validator";

export const createVisitValidation = [
  body("doctorId")
    .notEmpty()
    .withMessage("Doctor ID is required")
    .isMongoId()
    .withMessage("Invalid doctor ID"),

  body("scheduledDate")
    .notEmpty()
    .withMessage("Scheduled date is required")
    .isISO8601()
    .withMessage("Invalid date format")
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      if (date < now) {
        throw new Error("Scheduled date cannot be in the past");
      }
      return true;
    }),

  body("chiefComplaint")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Chief complaint cannot exceed 1000 characters"),
];

export const updateVisitValidation = [
  body("diagnosis")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Diagnosis cannot exceed 2000 characters"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Notes cannot exceed 5000 characters"),

  body("chiefComplaint")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Chief complaint cannot exceed 1000 characters"),
];
