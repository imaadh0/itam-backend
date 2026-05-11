import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedUser } from "../types/auth";

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : undefined;

  if (!token) {
    return res.status(401).json({ message: "Authentication token is required" });
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    return res.status(500).json({ message: "JWT secret is not configured" });
  }

  try {
    req.user = jwt.verify(token, jwtSecret) as AuthenticatedUser;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
