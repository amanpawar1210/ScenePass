import mongoose from "mongoose";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function notFound(_req, _res, next) {
  next(new HttpError(404, "Not found"));
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ message: Object.values(err.errors)[0]?.message || "Invalid data" });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: `Invalid ${err.path}` });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON body" });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 ? "Something went wrong" : err.message });
}
