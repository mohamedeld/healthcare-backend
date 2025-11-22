import { STATUS } from "../config/statusCodes.js";

export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(STATUS.NOT_FOUND);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  let statusCode =
    res.statusCode === STATUS.OK
      ? STATUS.INTERNAL_SERVER_ERROR
      : res.statusCode;
  let message = err.message;

  if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = STATUS.BAD_REQUEST;
    message = "Invalid ID format";
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = STATUS.BAD_REQUEST;
    const field = Object.keys(err.keyPattern)[0];
    message = `A user with this ${field} already exists`;
  }

  if (err.name === "ValidationError") {
    statusCode = STATUS.BAD_REQUEST;
    const errors = Object.values(err.errors).map((e) => e.message);
    message = errors.join(", ");
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = STATUS.UNAUTHORIZED;
    message = "Invalid token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = STATUS.UNAUTHORIZED;
    message = "Token expired";
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
