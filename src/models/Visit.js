import mongoose from "mongoose";
import { treatmentSchema } from "./Treatment.js";

const visitSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Patient is required"],
      index: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Doctor is required"],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ["scheduled", "in_progress", "completed", "cancelled"],
        message:
          "Status must be scheduled, in_progress, completed, or cancelled",
      },
      default: "scheduled",
      index: true,
    },
    scheduledDate: {
      type: Date,
      required: [true, "Scheduled date is required"],
      index: true,
    },
    startTime: {
      type: Date,
      default: null,
    },
    endTime: {
      type: Date,
      default: null,
    },
    chiefComplaint: {
      type: String,
      trim: true,
      maxlength: [1000, "Chief complaint cannot exceed 1000 characters"],
    },
    diagnosis: {
      type: String,
      trim: true,
      maxlength: [2000, "Diagnosis cannot exceed 2000 characters"],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [5000, "Notes cannot exceed 5000 characters"],
    },
    treatments: [treatmentSchema],
    totalAmount: {
      type: Number,
      default: 0,
      min: [0, "Total amount cannot be negative"],
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ["pending", "partial", "paid"],
        message: "Payment status must be pending, partial, or paid",
      },
      default: "pending",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for better query performance
visitSchema.index({ patient: 1, status: 1 });
visitSchema.index({ doctor: 1, status: 1 });
visitSchema.index({ scheduledDate: 1, status: 1 });
visitSchema.index({ paymentStatus: 1, status: 1 });

// Text index for searching
visitSchema.index({
  chiefComplaint: "text",
  diagnosis: "text",
  notes: "text",
});

// Method to calculate total amount from treatments
visitSchema.methods.calculateTotalAmount = function () {
  this.totalAmount = this.treatments.reduce((sum, treatment) => {
    return sum + (treatment.totalPrice || 0);
  }, 0);
  return this.totalAmount;
};

// Pre-save middleware to auto-calculate total amount
visitSchema.pre("save", function (next) {
  if (this.isModified("treatments")) {
    this.calculateTotalAmount();
  }
  next();
});

// Virtual for visit duration
visitSchema.virtual("duration").get(function () {
  if (this.startTime && this.endTime) {
    return Math.round((this.endTime - this.startTime) / 1000 / 60); // Duration in minutes
  }
  return null;
});

// Static method to check if doctor has active visit
visitSchema.statics.hasActiveVisit = async function (doctorId) {
  const activeVisit = await this.findOne({
    doctor: doctorId,
    status: { $in: ["scheduled", "in_progress"] },
  });
  return !!activeVisit;
};

// Static method to get doctor's active visit
visitSchema.statics.getActiveVisit = async function (doctorId) {
  return await this.findOne({
    doctor: doctorId,
    status: { $in: ["scheduled", "in_progress"] },
  }).populate("patient", "name email phone");
};

const Visit = mongoose.model("Visit", visitSchema);

export default Visit;
