import jwt from "jsonwebtoken";
import { config } from "../config/env";

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  companyId?: string;
}

export class TokenError extends Error {
  constructor(
    message: string,
    public readonly code: "EXPIRED" | "INVALID" | "MALFORMED",
  ) {
    super(message);
    this.name = "TokenError";
  }
}

export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, config.jwtSecret) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenError("Token has expired", "EXPIRED");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      if (
        error.message.includes("malformed") ||
        error.message.includes("invalid")
      ) {
        throw new TokenError("Invalid token format", "MALFORMED");
      }
      throw new TokenError("Invalid token", "INVALID");
    }
    throw new TokenError("Token verification failed", "INVALID");
  }
};
