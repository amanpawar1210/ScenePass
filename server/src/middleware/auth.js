import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { User } from "../models/user.js";
import { HttpError } from "./errors.js";

export function signToken(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

async function userFromRequest(req) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, "Session expired, please sign in again");
  }
  const user = await User.findById(payload.sub);
  if (!user) throw new HttpError(401, "Account not found");
  return user;
}

export async function requireAuth(req, _res, next) {
  req.user = await userFromRequest(req);
  if (!req.user) throw new HttpError(401, "Sign in required");
  next();
}

/** Attaches req.user when a valid token is present, but never rejects anonymous visitors. */
export async function optionalAuth(req, _res, next) {
  try {
    req.user = await userFromRequest(req);
  } catch {
    req.user = null;
  }
  next();
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== "admin") throw new HttpError(403, "Organizer access only");
  next();
}
