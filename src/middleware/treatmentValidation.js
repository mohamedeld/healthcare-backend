import { body } from "express-validator";

export const addTreatmentValidation = [
  body("name").trim().notEmpty().withMessage("Treatment name is required"),

  body("description").optional().trim(),

  body("quantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),

  body("unitPrice")
    .notEmpty()
    .withMessage("Unit price is required")
    .isFloat({ min: 0 })
    .withMessage("Unit price must be a positive number"),

  body("category")
    .optional()
    .isIn([
      "consultation",
      "medication",
      "procedure",
      "lab_test",
      "imaging",
      "other",
    ])
    .withMessage("Invalid category"),
];

export const updateTreatmentValidation = [
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Treatment name cannot be empty"),

  body("description").optional().trim(),

  body("quantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),

  body("unitPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Unit price must be a positive number"),

  body("category")
    .optional()
    .isIn([
      "consultation",
      "medication",
      "procedure",
      "lab_test",
      "imaging",
      "other",
    ])
    .withMessage("Invalid category"),
];
