import { ErrorRequestHandler } from "express";

type HttpError = Error & {
  status?: number;
  statusCode?: number;
};

export const errorHandler: ErrorRequestHandler = (error: HttpError, _req, res, _next) => {
  const statusCode = error.statusCode ?? error.status ?? 500;
  const safeStatusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 500;

  res.status(safeStatusCode).json({
    status: "error",
    message:
      safeStatusCode === 500
        ? "Internal server error"
        : error.message || "Request failed",
  });
};
