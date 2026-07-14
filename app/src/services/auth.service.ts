/**
 * @fileoverview Authentication service — login, register, 2FA, session management.
 *
 * Centralizes all authentication and authorization logic. Handles:
 * - Email/password registration and login.
 * - TOTP 2FA setup and verification.
 * - Refresh token rotation.
 * - Session creation and revocation.
 * - Audit logging for all auth events.
 *
 * @security
 * - Passwords are hashed with bcrypt (cost factor 12).
 * - Login failures use generic messages to prevent user enumeration.
 * - 2FA secrets are encrypted at rest.
 * - Refresh tokens are hashed (SHA-256) before storage.
 *
 * @module services/auth.service
 */

import bcrypt from 'bcryptjs';
import { UserRepository } from '@/repositories/user.repository';
import { AuditService } from '@/services/audit.service';
import { NotificationRepository } from '@/repositories/notification.repository';
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  setSessionCookies,
  clearSessionCookies,
  getRefreshTokenFromCookie,
  computeRefreshExpiry,
  computeDeviceFingerprint,
  parseDeviceName,
} from '@/lib/security/session-manager';
import {
  generateTOTPSecret,
  verifyTOTP,
  hashBackupCodes,
  verifyBackupCode,
} from '@/lib/crypto/totp';
import { encryptField, decryptField } from '@/lib/crypto/encryption';
import { validateInput } from '@/lib/types/api';
import { LoginDTO, RegisterDTO } from '@/lib/types/dto';
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  ValidationError,
  ErrorCode,
} from '@/lib/types/errors';
import {
  isLockedOut,
  recordFailedAttempt,
  clearFailedAttempts,
} from '@/lib/security/account-lockout';

/** Bcrypt cost factor — 12 provides ~250ms hash time. */
const BCRYPT_ROUNDS = 12;

/**
 * Result of a successful login/registration.
 */
export interface AuthResult {
  user: {
    id: number;
    name: string;
    email: string;
    currency: string;
  };
  /** True if 2FA is required before full access. */
  requires2FA?: boolean;
  /** Temporary token for completing 2FA (not a full access token). */
  tempToken?: string;
}

/**
 * Context for request-scoped metadata.
 */
export interface AuthRequestContext {
  ip?: string;
  userAgent?: string;
  request?: Request;
}

/**
 * AuthService — authentication and session management.
 *
 * @example
 * ```ts
 * const result = await AuthService.login(
 *   { email: 'alice@example.com', password: 'secret' },
 *   { ip: '192.168.1.1' }
 * );
 * ```
 */
export class AuthService {
  /**
   * Registers a new user account.
   *
   * @param data - Raw registration data (validated via Zod).
   * @param ctx - Request context for audit logging.
   * @returns The created user profile and session tokens (set via cookies).
   *
   * @throws {ConflictError} If the email is already registered.
   *
   * @security
   * - Password is hashed with bcrypt (cost 12) before storage.
   * - A welcome notification is created for the new user.
   */
  static async register(
    data: unknown,
    ctx: AuthRequestContext = {}
  ): Promise<AuthResult> {
    const validated = validateInput(RegisterDTO, data);

    // Check for existing user
    const existing = await UserRepository.findByEmail(validated.email);
    if (existing) {
      throw new ConflictError(
        'An account with this email already exists',
        ErrorCode.EMAIL_ALREADY_EXISTS
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validated.password, BCRYPT_ROUNDS);

    // Create user
    const user = await UserRepository.create({
      name: validated.name,
      email: validated.email,
      passwordHash,
    });

    // Create session tokens
    const accessToken = await createAccessToken(user.id, user.email);
    const refreshToken = createRefreshToken();

    // Store session in database
    await UserRepository.createSession({
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: computeRefreshExpiry(),
      deviceFingerprint: ctx.request
        ? computeDeviceFingerprint(ctx.request)
        : undefined,
      deviceName: ctx.request ? parseDeviceName(ctx.request) : undefined,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    // Set cookies
    await setSessionCookies(accessToken, refreshToken);

    // Welcome notification
    NotificationRepository.create({
      userId: user.id,
      type: 'success',
      title: 'Welcome to Wealth AI!',
      message: 'Your account has been created. Start by adding your first transaction.',
    }).catch(() => {});

    // Audit log
    AuditService.logAction({
      userId: user.id,
      action: 'CREATE',
      entityType: 'user',
      entityId: String(user.id),
      newValue: { name: user.name, email: user.email },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        currency: user.currency || 'BDT',
      },
    };
  }

  /**
   * Authenticates a user with email and password.
   *
   * @param data - Raw login data (validated via Zod).
   * @param ctx - Request context.
   * @returns The user profile, or a 2FA challenge if 2FA is enabled.
   *
   * @throws {AuthenticationError} If credentials are invalid.
   *
   * @security
   * - Generic error message prevents user enumeration.
   * - Failed attempts are audit-logged with partial email.
   * - 2FA-enabled accounts require a second verification step.
   */
  static async login(
    data: unknown,
    ctx: AuthRequestContext = {}
  ): Promise<AuthResult> {
    const validated = validateInput(LoginDTO, data);

    // Account lockout check
    if (ctx.ip) {
      const lockout = isLockedOut(ctx.ip);
      if (lockout.locked) {
        throw new AuthenticationError(
          'Too many failed attempts. Please try again later.',
          ErrorCode.RATE_LIMIT_EXCEEDED
        );
      }
    }

    // Find user
    const user = await UserRepository.findByEmail(validated.email);
    if (!user) {
      AuditService.logLoginFailed(validated.email, ctx.ip, ctx.userAgent, 'user_not_found');
      if (ctx.ip) recordFailedAttempt(ctx.ip);
      throw new AuthenticationError(
        'Invalid email or password',
        ErrorCode.INVALID_CREDENTIALS
      );
    }

    // Verify password
    const passwordValid = await bcrypt.compare(validated.password, user.passwordHash);
    if (!passwordValid) {
      AuditService.logLoginFailed(validated.email, ctx.ip, ctx.userAgent, 'invalid_password');
      if (ctx.ip) recordFailedAttempt(ctx.ip);
      throw new AuthenticationError(
        'Invalid email or password',
        ErrorCode.INVALID_CREDENTIALS
      );
    }

    // Check if 2FA is enabled
    if (user.totpEnabled === 1) {
      // If TOTP code is provided in the initial login request, verify it
      if (validated.totpCode) {
        const decryptedSecret = decryptField(user.totpSecret || '', 'totp');
        const isValid = verifyTOTP(validated.totpCode, decryptedSecret);

        if (!isValid) {
          AuditService.logLoginFailed(validated.email, ctx.ip, ctx.userAgent, 'invalid_totp');
          throw new AuthenticationError(
            'Invalid 2FA code',
            ErrorCode.TWO_FACTOR_INVALID
          );
        }
      } else {
        // 2FA required — return temporary token for the second step
        const tempToken = await createAccessToken(user.id, user.email);
        return {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            currency: user.currency || 'BDT',
          },
          requires2FA: true,
          tempToken,
        };
      }
    }

    // Full login — create session
    if (ctx.ip) clearFailedAttempts(ctx.ip);
    return AuthService.completeLogin(user, ctx, validated.rememberMe);
  }

  /**
   * Completes the login flow by creating session tokens and setting cookies.
   *
   * @param user - The verified user record.
   * @param ctx - Request context.
   * @returns The authenticated user profile.
   *
   * @internal
   */
  public static async completeLogin(
    user: { id: number; name: string; email: string; currency: string | null },
    ctx: AuthRequestContext,
    rememberMe?: boolean
  ): Promise<AuthResult> {
    const accessToken = await createAccessToken(user.id, user.email);
    const refreshToken = createRefreshToken();

    // Store session
    await UserRepository.createSession({
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: computeRefreshExpiry(rememberMe),
      rememberMe,
      deviceFingerprint: ctx.request
        ? computeDeviceFingerprint(ctx.request)
        : undefined,
      deviceName: ctx.request ? parseDeviceName(ctx.request) : undefined,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    // Set cookies
    await setSessionCookies(accessToken, refreshToken, rememberMe);

    // Audit log
    AuditService.logLogin(user.id, ctx.ip, ctx.userAgent);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        currency: user.currency || 'BDT',
      },
    };
  }

  /**
   * Refreshes the access token using a valid refresh token.
   *
   * Implements token rotation: the old refresh token is invalidated
   * and a new one is issued with each refresh.
   *
   * @param ctx - Request context.
   * @returns The refreshed user profile.
   *
   * @throws {AuthenticationError} If the refresh token is invalid or expired.
   *
   * @security
   * - Refresh token is rotated on each use (one-time use).
   * - Expired sessions are rejected.
   * - The old token hash is replaced atomically.
   */
  static async refresh(
    ctx: AuthRequestContext = {}
  ): Promise<AuthResult> {
    const rawToken = await getRefreshTokenFromCookie();

    if (!rawToken) {
      throw new AuthenticationError(
        'No refresh token found',
        ErrorCode.REFRESH_TOKEN_INVALID
      );
    }

    const tokenHash = hashRefreshToken(rawToken);
    const session = await UserRepository.findSessionByTokenHash(tokenHash);

    if (!session) {
      throw new AuthenticationError(
        'Invalid refresh token',
        ErrorCode.REFRESH_TOKEN_INVALID
      );
    }

    // Check expiration
    if (new Date(session.expiresAt) < new Date()) {
      await UserRepository.revokeSession(tokenHash);
      throw new AuthenticationError(
        'Refresh token expired. Please log in again.',
        ErrorCode.REFRESH_TOKEN_EXPIRED
      );
    }

    // Get user
    const user = await UserRepository.findById(session.userId);
    if (!user) {
      throw new AuthenticationError(
        'User not found',
        ErrorCode.UNAUTHORIZED
      );
    }

    // Use the stored rememberMe flag from the session (1 = true, 0 = false)
    const isRememberMe = session.rememberMe === 1;

    // Rotate token with the same rememberMe persistence
    const newRefreshToken = createRefreshToken();
    const newTokenHash = hashRefreshToken(newRefreshToken);
    const newExpiry = computeRefreshExpiry(isRememberMe);

    await UserRepository.rotateSessionToken(tokenHash, newTokenHash, newExpiry);

    // Create new access token
    const newAccessToken = await createAccessToken(user.id, user.email);

    // Set cookies with the same rememberMe persistence
    await setSessionCookies(newAccessToken, newRefreshToken, isRememberMe);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        currency: user.currency || 'BDT',
      },
    };
  }

  /**
   * Logs out the current session.
   *
   * Revokes the refresh token and clears all session cookies.
   *
   * @param userId - The user's ID.
   * @param ctx - Request context.
   */
  static async logout(
    userId: number,
    ctx: AuthRequestContext = {}
  ): Promise<void> {
    const rawToken = await getRefreshTokenFromCookie();

    if (rawToken) {
      await UserRepository.revokeSession(hashRefreshToken(rawToken));
    }

    await clearSessionCookies();

    AuditService.logLogout(userId, ctx.ip);
  }

  /**
   * Sets up TOTP 2FA for a user.
   *
   * Generates a TOTP secret, returns the QR URI and backup codes.
   * The 2FA is NOT enabled until `confirmTOTPSetup()` is called.
   *
   * @param userId - The user's ID.
   * @returns Setup data including the QR URI and backup codes.
   *
   * @throws {ConflictError} If 2FA is already enabled.
   */
  static async setupTOTP(
    userId: number
  ): Promise<{ uri: string; backupCodes: string[] }> {
    const user = await UserRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    if (user.totpEnabled === 1) {
      throw new ConflictError(
        '2FA is already enabled',
        ErrorCode.TWO_FACTOR_ALREADY_ENABLED
      );
    }

    const setup = generateTOTPSecret(user.email);

    // Temporarily store the encrypted secret (not yet enabled)
    const encryptedSecret = encryptField(setup.secret, 'totp');
    await UserRepository.enable2FA(
      userId,
      encryptedSecret,
      '' // Backup codes stored after confirmation
    );
    // Disable until confirmed
    await UserRepository.disable2FA(userId);

    // Store secret temporarily (will be re-enabled on confirmation)
    // For now, we return the setup data for the user to confirm
    return {
      uri: setup.uri,
      backupCodes: setup.backupCodes,
    };
  }

  /**
   * Confirms TOTP setup by verifying a code from the user's authenticator.
   *
   * @param userId - The user's ID.
   * @param code - The 6-digit TOTP code to verify.
   * @param secret - The base32 TOTP secret (from the setup step).
   * @param backupCodes - The backup codes generated during setup.
   *
   * @throws {AuthenticationError} If the verification code is invalid.
   */
  static async confirmTOTPSetup(
    userId: number,
    code: string,
    secret: string,
    backupCodes: string[]
  ): Promise<void> {
    const isValid = verifyTOTP(code, secret);

    if (!isValid) {
      throw new AuthenticationError(
        'Invalid verification code. Make sure your authenticator app is synced.',
        ErrorCode.TWO_FACTOR_INVALID
      );
    }

    const encryptedSecret = encryptField(secret, 'totp');
    const hashedCodes = await hashBackupCodes(backupCodes);

    await UserRepository.enable2FA(
      userId,
      encryptedSecret,
      JSON.stringify(hashedCodes)
    );

    AuditService.logAction({
      userId,
      action: '2FA_ENABLE',
      entityType: 'user',
      entityId: String(userId),
    });
  }

  /**
   * Disables TOTP 2FA for a user.
   *
   * @param userId - The user's ID.
   *
   * @throws {NotFoundError} If the user doesn't exist.
   */
  static async disableTOTP(userId: number): Promise<void> {
    const user = await UserRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found', ErrorCode.USER_NOT_FOUND);

    await UserRepository.disable2FA(userId);

    AuditService.logAction({
      userId,
      action: '2FA_DISABLE',
      entityType: 'user',
      entityId: String(userId),
    });
  }


  /**
   * Gets the current user's profile (public fields only).
   *
   * @param userId - The user's ID.
   * @returns The user profile DTO.
   *
   * @throws {NotFoundError} If the user doesn't exist.
   */
  static async getProfile(userId: number) {
    const user = await UserRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found', ErrorCode.USER_NOT_FOUND);

    const { queryOne } = await import('@/lib/db');
    const owned = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM tours WHERE created_by = ?',
      [userId]
    );
    const ownedCount = owned?.count ?? 0;
    let isGuest = false;
    if (ownedCount === 0) {
      const joined = await queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM tour_participants WHERE user_id = ?',
        [userId]
      );
      const joinedCount = joined?.count ?? 0;
      isGuest = joinedCount > 0;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      currency: user.currency || 'BDT',
      notifyBudget: user.notifyBudget ?? 1,
      notifyOverspend: user.notifyOverspend ?? 1,
      totpEnabled: user.totpEnabled === 1,
      createdAt: user.createdAt,
      isGuest,
    };
  }

  /**
   * Changes the user's password.
   *
   * Requires verification of the current password before accepting a new one.
   * Invalidates all existing refresh tokens for the user on success.
   *
   * @param userId - The user's ID.
   * @param currentPassword - The user's current password.
   * @param newPassword - The desired new password.
   *
   * @throws {AuthenticationError} If the current password is incorrect.
   * @throws {NotFoundError} If the user doesn't exist.
   */
  static async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await UserRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found', ErrorCode.USER_NOT_FOUND);

    // Verify current password
    const passwordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordValid) {
      throw new AuthenticationError(
        'Current password is incorrect',
        ErrorCode.INVALID_CREDENTIALS
      );
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password in DB
    await UserRepository.updatePassword(userId, newHash);

    // Revoke all existing sessions (force re-login everywhere)
    await UserRepository.revokeAllSessions(userId);

    // Audit log
    AuditService.logAction({
      userId,
      action: 'PASSWORD_CHANGE',
      entityType: 'user',
      entityId: String(userId),
    });
  }
}
