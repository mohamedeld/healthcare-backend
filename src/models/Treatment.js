import mongoose from "mongoose";

export const treatmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Treatment name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
      default: 1,
    },
    unitPrice: {
      type: Number,
      required: [true, "Unit price is required"],
      min: [0, "Unit price cannot be negative"],
    },
    totalPrice: {
      type: Number,
      required: true,
      min: [0, "Total price cannot be negative"],
    },
    category: {
      type: String,
      enum: [
        "consultation",
        "medication",
        "procedure",
        "lab_test",
        "imaging",
        "other",
      ],
      default: "other",
    },
  },
  {
    timestamps: true,
  }
);

// Auto-calculate total price before saving treatment
treatmentSchema.pre("save", function (next) {
  this.totalPrice = this.unitPrice * this.quantity;
  next();
});
