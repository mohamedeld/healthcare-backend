import { body, param, query, validationResult } from "express-validator";

export const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }

  next();
};

export const updatePaymentValidation = [
  body("paymentStatus")
    .notEmpty()
    .withMessage("Payment status is required")
    .isIn(["pending", "partial", "paid"])
    .withMessage("Invalid payment status"),
];

export const mongoIdValidation = [
  param("id").isMongoId().withMessage("Invalid ID format"),
];

export const searchValidation = [
  query("visitId").optional().isMongoId().withMessage("Invalid visit ID"),

  query("status")
    .optional()
    .isIn(["scheduled", "in_progress", "completed", "cancelled"])
    .withMessage("Invalid status"),

  query("paymentStatus")
    .optional()
    .isIn(["pending", "partial", "paid"])
    .withMessage("Invalid payment status"),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid start date format"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid end date format"),
];
