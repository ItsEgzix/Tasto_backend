import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { users, refreshTokens } from "../db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET: string =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_REFRESH_SECRET: string =
  process.env.JWT_REFRESH_SECRET ||
  "your-refresh-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
}

export class AuthService {
  // Hash password
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  // Verify password
  static async verifyPassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  // Generate access token
  static generateAccessToken(payload: TokenPayload): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as any);
  }

  // Generate refresh token
  static generateRefreshToken(payload: TokenPayload): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    } as any);
  }

  // Verify access token
  static verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  }

  // Verify refresh token
  static verifyRefreshToken(token: string): TokenPayload {
    return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
  }

  // Register new user
  static async register(
    email: string,
    password: string,
    name: string
  ): Promise<AuthTokens> {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error("User with this email already exists");
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        name,
        password: hashedPassword,
      })
      .returning();

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: newUser.id,
      email: newUser.email,
    };

    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(tokenPayload);

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await db.insert(refreshTokens).values({
      userId: newUser.id,
      token: refreshToken,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  // Login user
  static async login(email: string, password: string): Promise<AuthTokens> {
    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      throw new Error("Invalid email or password");
    }

    if (!user.isActive) {
      throw new Error("Account is deactivated");
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(password, user.password);
    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
    };

    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(tokenPayload);

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await db.insert(refreshTokens).values({
      userId: user.id,
      token: refreshToken,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  // Refresh access token
  static async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    // Verify refresh token
    let payload: TokenPayload;
    try {
      payload = this.verifyRefreshToken(refreshToken);
    } catch (error) {
      throw new Error("Invalid refresh token");
    }

    // Check if refresh token exists in database
    const [storedToken] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, refreshToken))
      .limit(1);

    if (!storedToken) {
      throw new Error("Refresh token not found");
    }

    // Check if token is expired
    if (new Date() > storedToken.expiresAt) {
      // Delete expired token
      await db
        .delete(refreshTokens)
        .where(eq(refreshTokens.token, refreshToken));
      throw new Error("Refresh token expired");
    }

    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user || !user.isActive) {
      throw new Error("User not found or inactive");
    }

    // Generate new tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
    };

    const newAccessToken = this.generateAccessToken(tokenPayload);
    const newRefreshToken = this.generateRefreshToken(tokenPayload);

    // Update refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db
      .update(refreshTokens)
      .set({
        token: newRefreshToken,
        expiresAt,
      })
      .where(eq(refreshTokens.id, storedToken.id));

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  // Logout (revoke refresh token)
  static async logout(refreshToken: string): Promise<void> {
    await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
  }

  // Logout all devices (revoke all refresh tokens for user)
  static async logoutAll(userId: string): Promise<void> {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  }
}
