import Visit from "../models/Visit.js";
import User from "../models/User.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import mongoose from "mongoose";

/**
 * @desc    Search and filter visits (Finance)
 * @route   GET /api/finance/visits
 * @access  Private (Finance)
 */
export const searchVisits = asyncHandler(async (req, res) => {
  const {
    visitId,
    doctorName,
    patientName,
    status,
    paymentStatus,
    startDate,
    endDate,
    page = 1,
    limit = 20,
    sortBy = "scheduledDate",
    sortOrder = "desc",
  } = req.query;

  // Build query
  let query = {};

  // Search by visit ID
  if (visitId) {
    if (mongoose.Types.ObjectId.isValid(visitId)) {
      query._id = visitId;
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid visit ID format",
      });
    }
  }

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Filter by payment status
  if (paymentStatus) {
    query.paymentStatus = paymentStatus;
  }

  // Date range filter
  if (startDate || endDate) {
    query.scheduledDate = {};
    if (startDate) {
      query.scheduledDate.$gte = new Date(startDate);
    }
    if (endDate) {
      query.scheduledDate.$lte = new Date(endDate);
    }
  }

  // Start building aggregation pipeline
  let pipeline = [];

  // Match initial query
  if (Object.keys(query).length > 0) {
    pipeline.push({ $match: query });
  }

  // Lookup patient details
  pipeline.push({
    $lookup: {
      from: "users",
      localField: "patient",
      foreignField: "_id",
      as: "patientDetails",
    },
  });

  // Lookup doctor details
  pipeline.push({
    $lookup: {
      from: "users",
      localField: "doctor",
      foreignField: "_id",
      as: "doctorDetails",
    },
  });

  // Unwind arrays
  pipeline.push({ $unwind: "$patientDetails" });
  pipeline.push({ $unwind: "$doctorDetails" });

  // Filter by patient name
  if (patientName) {
    pipeline.push({
      $match: {
        "patientDetails.name": {
          $regex: patientName,
          $options: "i",
        },
      },
    });
  }

  // Filter by doctor name
  if (doctorName) {
    pipeline.push({
      $match: {
        "doctorDetails.name": {
          $regex: doctorName,
          $options: "i",
        },
      },
    });
  }

  // Project fields
  pipeline.push({
    $project: {
      _id: 1,
      patient: {
        _id: "$patientDetails._id",
        name: "$patientDetails.name",
        email: "$patientDetails.email",
        phone: "$patientDetails.phone",
      },
      doctor: {
        _id: "$doctorDetails._id",
        name: "$doctorDetails.name",
        email: "$doctorDetails.email",
        specialization: "$doctorDetails.specialization",
      },
      status: 1,
      scheduledDate: 1,
      startTime: 1,
      endTime: 1,
      chiefComplaint: 1,
      diagnosis: 1,
      notes: 1,
      treatments: 1,
      totalAmount: 1,
      paymentStatus: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  });

  // Count total documents
  const countPipeline = [...pipeline, { $count: "total" }];
  const countResult = await Visit.aggregate(countPipeline);
  const total = countResult.length > 0 ? countResult[0].total : 0;

  // Sort
  const sortDirection = sortOrder === "asc" ? 1 : -1;
  pipeline.push({ $sort: { [sortBy]: sortDirection } });

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: parseInt(limit) });

  // Execute aggregation
  const visits = await Visit.aggregate(pipeline);

  // Calculate statistics
  const statsAggregation = await Visit.aggregate([
    ...(Object.keys(query).length > 0 ? [{ $match: query }] : []),
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totalAmount" },
        completedVisits: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        pendingPayments: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "pending"] }, 1, 0] },
        },
        partialPayments: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "partial"] }, 1, 0] },
        },
        paidVisits: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] },
        },
      },
    },
  ]);

  const statistics =
    statsAggregation.length > 0
      ? statsAggregation[0]
      : {
          totalRevenue: 0,
          completedVisits: 0,
          pendingPayments: 0,
          partialPayments: 0,
          paidVisits: 0,
        };

  res.status(200).json({
    success: true,
    count: visits.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    statistics: {
      totalRevenue: parseFloat(statistics.totalRevenue || 0).toFixed(2),
      completedVisits: statistics.completedVisits || 0,
      pendingPayments: statistics.pendingPayments || 0,
      partialPayments: statistics.partialPayments || 0,
      paidVisits: statistics.paidVisits || 0,
    },
    visits,
  });
});

/**
 * @desc    Update payment status (Finance)
 * @route   PUT /api/finance/visits/:id/payment
 * @access  Private (Finance)
 */
export const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;

  if (!["pending", "partial", "paid"].includes(paymentStatus)) {
    return res.status(400).json({
      success: false,
      message: "Invalid payment status. Must be: pending, partial, or paid",
    });
  }

  const visit = await Visit.findById(id)
    .populate("patient", "name email phone")
    .populate("doctor", "name email specialization");

  if (!visit) {
    return res.status(404).json({
      success: false,
      message: "Visit not found",
    });
  }

  visit.paymentStatus = paymentStatus;
  await visit.save();

  res.status(200).json({
    success: true,
    message: "Payment status updated successfully",
    visit,
  });
});

/**
 * @desc    Get dashboard statistics (Finance)
 * @route   GET /api/finance/dashboard
 * @access  Private (Finance)
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  // Get date ranges
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  // Overall statistics
  const overallStats = await Visit.aggregate([
    {
      $group: {
        _id: null,
        totalVisits: { $sum: 1 },
        completedVisits: {
          $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
        },
        scheduledVisits: {
          $sum: { $cond: [{ $eq: ["$status", "scheduled"] }, 1, 0] },
        },
        inProgressVisits: {
          $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] },
        },
        cancelledVisits: {
          $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
        },
        totalRevenue: {
          $sum: {
            $cond: [{ $eq: ["$status", "completed"] }, "$totalAmount", 0],
          },
        },
        pendingPayments: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "completed"] },
                  { $eq: ["$paymentStatus", "pending"] },
                ],
              },
              "$totalAmount",
              0,
            ],
          },
        },
        paidAmount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "completed"] },
                  { $eq: ["$paymentStatus", "paid"] },
                ],
              },
              "$totalAmount",
              0,
            ],
          },
        },
      },
    },
  ]);

  // Today's statistics
  const todayStats = await Visit.aggregate([
    { $match: { createdAt: { $gte: startOfToday } } },
    {
      $group: {
        _id: null,
        visitsToday: { $sum: 1 },
        revenueToday: {
          $sum: {
            $cond: [{ $eq: ["$status", "completed"] }, "$totalAmount", 0],
          },
        },
      },
    },
  ]);

  // This month's statistics
  const monthStats = await Visit.aggregate([
    { $match: { createdAt: { $gte: startOfMonth } } },
    {
      $group: {
        _id: null,
        visitsThisMonth: { $sum: 1 },
        revenueThisMonth: {
          $sum: {
            $cond: [{ $eq: ["$status", "completed"] }, "$totalAmount", 0],
          },
        },
      },
    },
  ]);

  // Revenue by doctor
  const revenueByDoctor = await Visit.aggregate([
    { $match: { status: "completed" } },
    {
      $lookup: {
        from: "users",
        localField: "doctor",
        foreignField: "_id",
        as: "doctorDetails",
      },
    },
    { $unwind: "$doctorDetails" },
    {
      $group: {
        _id: "$doctor",
        doctorName: { $first: "$doctorDetails.name" },
        specialization: { $first: "$doctorDetails.specialization" },
        totalVisits: { $sum: 1 },
        totalRevenue: { $sum: "$totalAmount" },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 10 },
  ]);

  // Payment status breakdown
  const paymentBreakdown = await Visit.aggregate([
    { $match: { status: "completed" } },
    {
      $group: {
        _id: "$paymentStatus",
        count: { $sum: 1 },
        amount: { $sum: "$totalAmount" },
      },
    },
  ]);

  // Recent visits
  const recentVisits = await Visit.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("patient", "name email")
    .populate("doctor", "name specialization");

  // Treatment categories breakdown
  const treatmentStats = await Visit.aggregate([
    { $match: { status: "completed" } },
    { $unwind: "$treatments" },
    {
      $group: {
        _id: "$treatments.category",
        count: { $sum: 1 },
        totalRevenue: { $sum: "$treatments.totalPrice" },
      },
    },
    { $sort: { totalRevenue: -1 } },
  ]);

  const stats = overallStats[0] || {};
  const today = todayStats[0] || {};
  const month = monthStats[0] || {};

  res.status(200).json({
    success: true,
    dashboard: {
      overall: {
        totalVisits: stats.totalVisits || 0,
        completedVisits: stats.completedVisits || 0,
        scheduledVisits: stats.scheduledVisits || 0,
        inProgressVisits: stats.inProgressVisits || 0,
        cancelledVisits: stats.cancelledVisits || 0,
        totalRevenue: parseFloat(stats.totalRevenue || 0).toFixed(2),
        pendingPayments: parseFloat(stats.pendingPayments || 0).toFixed(2),
        paidAmount: parseFloat(stats.paidAmount || 0).toFixed(2),
        collectionRate:
          stats.totalRevenue > 0
            ? ((stats.paidAmount / stats.totalRevenue) * 100).toFixed(2) + "%"
            : "0%",
      },
      today: {
        visits: today.visitsToday || 0,
        revenue: parseFloat(today.revenueToday || 0).toFixed(2),
      },
      thisMonth: {
        visits: month.visitsThisMonth || 0,
        revenue: parseFloat(month.revenueThisMonth || 0).toFixed(2),
      },
      revenueByDoctor: revenueByDoctor.map((doc) => ({
        doctorId: doc._id,
        doctorName: doc.doctorName,
        specialization: doc.specialization,
        totalVisits: doc.totalVisits,
        totalRevenue: parseFloat(doc.totalRevenue).toFixed(2),
      })),
      paymentBreakdown: paymentBreakdown.map((pb) => ({
        status: pb._id,
        count: pb.count,
        amount: parseFloat(pb.amount).toFixed(2),
      })),
      treatmentCategories: treatmentStats.map((ts) => ({
        category: ts._id,
        count: ts.count,
        revenue: parseFloat(ts.totalRevenue).toFixed(2),
      })),
      recentVisits,
    },
  });
});

/**
 * @desc    Get visit details for finance review
 * @route   GET /api/finance/visits/:id
 * @access  Private (Finance)
 */
export const getVisitDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const visit = await Visit.findById(id)
    .populate("patient", "name email phone")
    .populate("doctor", "name email specialization");

  if (!visit) {
    return res.status(404).json({
      success: false,
      message: "Visit not found",
    });
  }

  res.status(200).json({
    success: true,
    visit,
  });
});

/**
 * @desc    Export visits data (Finance)
 * @route   GET /api/finance/export
 * @access  Private (Finance)
 */
export const exportVisits = asyncHandler(async (req, res) => {
  const { startDate, endDate, status } = req.query;

  let query = {};

  if (status) query.status = status;

  if (startDate || endDate) {
    query.scheduledDate = {};
    if (startDate) query.scheduledDate.$gte = new Date(startDate);
    if (endDate) query.scheduledDate.$lte = new Date(endDate);
  }

  const visits = await Visit.find(query)
    .populate("patient", "name email phone")
    .populate("doctor", "name email specialization")
    .sort({ scheduledDate: -1 });

  // Format data for export
  const exportData = visits.map((visit) => ({
    visitId: visit._id,
    patientName: visit.patient.name,
    patientEmail: visit.patient.email,
    doctorName: visit.doctor.name,
    doctorSpecialization: visit.doctor.specialization,
    scheduledDate: visit.scheduledDate,
    status: visit.status,
    diagnosis: visit.diagnosis,
    totalAmount: visit.totalAmount,
    paymentStatus: visit.paymentStatus,
    treatmentsCount: visit.treatments.length,
  }));

  res.status(200).json({
    success: true,
    count: exportData.length,
    data: exportData,
  });
});
