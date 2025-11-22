import Visit from "../models/Visit.js";
import User from "../models/User.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { STATUS } from "../config/statusCodes.js";

/**
 * @desc    Create a new visit (Patient)
 * @route   POST /api/visits
 * @access  Private (Patient)
 */
export const createVisit = asyncHandler(async (req, res) => {
  const { doctorId, scheduledDate, chiefComplaint } = req.body;
  const patientId = req.user._id;

  // Verify doctor exists and is active
  const doctor = await User.findOne({
    _id: doctorId,
    role: "doctor",
    isActive: true,
  });

  if (!doctor) {
    return res.status(STATUS.NOT_FOUND).json({
      success: false,
      message: "Doctor not found or inactive",
    });
  }

  // Check if doctor already has an active visit
  const hasActive = await Visit.hasActiveVisit(doctorId);
  if (hasActive) {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      message:
        "This doctor already has an active visit scheduled. Please choose another time or doctor.",
    });
  }

  // Create visit
  const visit = await Visit.create({
    patient: patientId,
    doctor: doctorId,
    scheduledDate,
    chiefComplaint,
    status: "scheduled",
  });

  // Populate visit details
  const populatedVisit = await Visit.findById(visit._id)
    .populate("patient", "name email phone")
    .populate("doctor", "name email specialization");

  res.status(201).json({
    success: true,
    message: "Visit scheduled successfully",
    visit: populatedVisit,
  });
});

/**
 * @desc    Get user's visits
 * @route   GET /api/visits/my-visits
 * @access  Private (Patient/Doctor)
 */
export const getMyVisits = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const role = req.user.role;

  let query = {};
  if (role === "patient") {
    query.patient = userId;
  } else if (role === "doctor") {
    query.doctor = userId;
  } else {
    return res.status(403).json({
      success: false,
      message: "Only patients and doctors can access visits",
    });
  }

  const visits = await Visit.find(query)
    .populate("patient", "name email phone")
    .populate("doctor", "name email specialization")
    .sort({ scheduledDate: -1 });

  res.status(STATUS.OK).json({
    success: true,
    count: visits.length,
    visits,
  });
});

/**
 * @desc    Get visit by ID
 * @route   GET /api/visits/:id
 * @access  Private (Patient/Doctor/Finance)
 */
export const getVisitById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const role = req.user.role;

  const visit = await Visit.findById(id)
    .populate("patient", "name email phone")
    .populate("doctor", "name email specialization");

  if (!visit) {
    return res.status(STATUS.NOT_FOUND).json({
      success: false,
      message: "Visit not found",
    });
  }

  // Authorization check
  if (
    role === "patient" &&
    visit.patient._id.toString() !== userId.toString()
  ) {
    return res.status(403).json({
      success: false,
      message: "Not authorized to access this visit",
    });
  }

  if (role === "doctor" && visit.doctor._id.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: "Not authorized to access this visit",
    });
  }

  res.status(STATUS.OK).json({
    success: true,
    visit,
  });
});

/**
 * @desc    Start a visit (Doctor)
 * @route   POST /api/visits/:id/start
 * @access  Private (Doctor)
 */
export const startVisit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doctorId = req.user._id;

  const visit = await Visit.findOne({ _id: id, doctor: doctorId });

  if (!visit) {
    return res.status(STATUS.NOT_FOUND).json({
      success: false,
      message: "Visit not found",
    });
  }

  if (visit.status !== "scheduled") {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      message: `Cannot start visit with status: ${visit.status}`,
    });
  }

  visit.status = "in_progress";
  visit.startTime = new Date();
  await visit.save();

  const updatedVisit = await Visit.findById(id)
    .populate("patient", "name email phone")
    .populate("doctor", "name email specialization");

  res.status(STATUS.OK).json({
    success: true,
    message: "Visit started successfully",
    visit: updatedVisit,
  });
});

/**
 * @desc    Update visit details (Doctor)
 * @route   PUT /api/visits/:id
 * @access  Private (Doctor)
 */
export const updateVisit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doctorId = req.user._id;
  const { diagnosis, notes, chiefComplaint } = req.body;

  const visit = await Visit.findOne({ _id: id, doctor: doctorId });

  if (!visit) {
    return res.status(STATUS.NOT_FOUND).json({
      success: false,
      message: "Visit not found",
    });
  }

  if (visit.status === "completed" || visit.status === "cancelled") {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      message: `Cannot update visit with status: ${visit.status}`,
    });
  }

  // Update fields
  if (diagnosis !== undefined) visit.diagnosis = diagnosis;
  if (notes !== undefined) visit.notes = notes;
  if (chiefComplaint !== undefined) visit.chiefComplaint = chiefComplaint;

  await visit.save();

  const updatedVisit = await Visit.findById(id)
    .populate("patient", "name email phone")
    .populate("doctor", "name email specialization");

  res.status(STATUS.OK).json({
    success: true,
    message: "Visit updated successfully",
    visit: updatedVisit,
  });
});

/**
 * @desc    Add treatment to visit (Doctor)
 * @route   POST /api/visits/:id/treatments
 * @access  Private (Doctor)
 */
export const addTreatment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doctorId = req.user._id;
  const { name, description, quantity, unitPrice, category } = req.body;

  const visit = await Visit.findOne({ _id: id, doctor: doctorId });

  if (!visit) {
    return res.status(STATUS.NOT_FOUND).json({
      success: false,
      message: "Visit not found",
    });
  }

  if (visit.status === "completed" || visit.status === "cancelled") {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      message: `Cannot add treatment to visit with status: ${visit.status}`,
    });
  }

  // Calculate total price
  const qty = quantity || 1;
  const totalPrice = unitPrice * qty;

  // Add treatment
  visit.treatments.push({
    name,
    description,
    quantity: qty,
    unitPrice,
    totalPrice,
    category: category || "other",
  });

  // Auto-calculate total amount
  visit.calculateTotalAmount();
  await visit.save();

  const updatedVisit = await Visit.findById(id)
    .populate("patient", "name email phone")
    .populate("doctor", "name email specialization");

  res.status(201).json({
    success: true,
    message: "Treatment added successfully",
    visit: updatedVisit,
  });
});

/**
 * @desc    Update treatment in visit (Doctor)
 * @route   PUT /api/visits/:id/treatments/:treatmentId
 * @access  Private (Doctor)
 */
export const updateTreatment = asyncHandler(async (req, res) => {
  const { id, treatmentId } = req.params;
  const doctorId = req.user._id;
  const { name, description, quantity, unitPrice, category } = req.body;

  const visit = await Visit.findOne({ _id: id, doctor: doctorId });

  if (!visit) {
    return res.status(STATUS.NOT_FOUND).json({
      success: false,
      message: "Visit not found",
    });
  }

  if (visit.status === "completed" || visit.status === "cancelled") {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      message: `Cannot update treatment in visit with status: ${visit.status}`,
    });
  }

  // Find treatment
  const treatment = visit.treatments.id(treatmentId);
  if (!treatment) {
    return res.status(STATUS.NOT_FOUND).json({
      success: false,
      message: "Treatment not found",
    });
  }

  // Update treatment fields
  if (name !== undefined) treatment.name = name;
  if (description !== undefined) treatment.description = description;
  if (quantity !== undefined) treatment.quantity = quantity;
  if (unitPrice !== undefined) treatment.unitPrice = unitPrice;
  if (category !== undefined) treatment.category = category;

  // Recalculate total price
  treatment.totalPrice = treatment.unitPrice * treatment.quantity;

  // Recalculate visit total
  visit.calculateTotalAmount();
  await visit.save();

  const updatedVisit = await Visit.findById(id)
    .populate("patient", "name email phone")
    .populate("doctor", "name email specialization");

  res.status(STATUS.OK).json({
    success: true,
    message: "Treatment updated successfully",
    visit: updatedVisit,
  });
});

/**
 * @desc    Delete treatment from visit (Doctor)
 * @route   DELETE /api/visits/:id/treatments/:treatmentId
 * @access  Private (Doctor)
 */
export const deleteTreatment = asyncHandler(async (req, res) => {
  const { id, treatmentId } = req.params;
  const doctorId = req.user._id;

  const visit = await Visit.findOne({ _id: id, doctor: doctorId });

  if (!visit) {
    return res.status(STATUS.NOT_FOUND).json({
      success: false,
      message: "Visit not found",
    });
  }

  if (visit.status === "completed" || visit.status === "cancelled") {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      message: `Cannot delete treatment from visit with status: ${visit.status}`,
    });
  }

  // Remove treatment
  visit.treatments.pull(treatmentId);

  // Recalculate total
  visit.calculateTotalAmount();
  await visit.save();

  const updatedVisit = await Visit.findById(id)
    .populate("patient", "name email phone")
    .populate("doctor", "name email specialization");

  res.status(STATUS.OK).json({
    success: true,
    message: "Treatment deleted successfully",
    visit: updatedVisit,
  });
});

/**
 * @desc    Complete a visit (Doctor)
 * @route   POST /api/visits/:id/complete
 * @access  Private (Doctor)
 */
export const completeVisit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doctorId = req.user._id;

  const visit = await Visit.findOne({ _id: id, doctor: doctorId });

  if (!visit) {
    return res.status(STATUS.NOT_FOUND).json({
      success: false,
      message: "Visit not found",
    });
  }

  if (visit.status === "completed") {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      message: "Visit is already completed",
    });
  }

  if (visit.status === "cancelled") {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      message: "Cannot complete a cancelled visit",
    });
  }

  visit.status = "completed";
  visit.endTime = new Date();
  await visit.save();

  const updatedVisit = await Visit.findById(id)
    .populate("patient", "name email phone")
    .populate("doctor", "name email specialization");

  res.status(STATUS.OK).json({
    success: true,
    message: "Visit completed successfully",
    visit: updatedVisit,
  });
});

/**
 * @desc    Cancel a visit (Patient/Doctor)
 * @route   POST /api/visits/:id/cancel
 * @access  Private (Patient/Doctor)
 */
export const cancelVisit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const role = req.user.role;

  let query = { _id: id };
  if (role === "patient") {
    query.patient = userId;
  } else if (role === "doctor") {
    query.doctor = userId;
  } else {
    return res.status(403).json({
      success: false,
      message: "Not authorized to cancel visits",
    });
  }

  const visit = await Visit.findOne(query);

  if (!visit) {
    return res.status(STATUS.NOT_FOUND).json({
      success: false,
      message: "Visit not found",
    });
  }

  if (visit.status === "completed") {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      message: "Cannot cancel a completed visit",
    });
  }

  if (visit.status === "cancelled") {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      message: "Visit is already cancelled",
    });
  }

  visit.status = "cancelled";
  await visit.save();

  const updatedVisit = await Visit.findById(id)
    .populate("patient", "name email phone")
    .populate("doctor", "name email specialization");

  res.status(STATUS.OK).json({
    success: true,
    message: "Visit cancelled successfully",
    visit: updatedVisit,
  });
});
