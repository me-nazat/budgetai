import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '@/services/auth.service';
import { UserRepository } from '@/repositories/user.repository';
import { AuthenticationError, ErrorCode } from '@/lib/types/errors';
import bcrypt from 'bcryptjs';

vi.mock('@/repositories/user.repository');
vi.mock('@/services/audit.service', () => ({
  AuditService: {
    logLoginFailed: vi.fn(),
    logLogin: vi.fn(),
    logRegister: vi.fn(),
  },
}));
vi.mock('@/repositories/notification.repository', () => ({
  NotificationRepository: {
    create: vi.fn(),
  },
}));

describe('AuthService unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('throws AuthenticationError when user is not found', async () => {
      vi.mocked(UserRepository.findByEmail).mockResolvedValue(undefined);

      await expect(
        AuthService.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
      ).rejects.toThrow(AuthenticationError);

      await expect(
        AuthService.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
      ).rejects.toMatchObject({
        code: ErrorCode.INVALID_CREDENTIALS,
      });
    });

    it('throws AuthenticationError when password is invalid', async () => {
      const mockHash = await bcrypt.hash('correctPassword', 10);
      vi.mocked(UserRepository.findByEmail).mockResolvedValue({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: mockHash,
        currency: 'BDT',
        locale: 'en',
        preferredLocale: 'en',
        notifyBudget: 1,
        notifyOverspend: 1,
        totpSecret: null,
        totpEnabled: 0,
        backupCodes: null,
        passwordUpdatedAt: null,
        dashboardLayout: null,
        mobileWidgetOrder: null,
        benchmarkOptIn: 0,
        demographicAgeTier: null,
        demographicRegion: null,
        createdAt: new Date().toISOString(),
      });

      await expect(
        AuthService.login({
          email: 'test@example.com',
          password: 'wrongPassword',
        })
      ).rejects.toThrow(AuthenticationError);
    });

    it('successfully authenticates with valid credentials', async () => {
      const password = 'SecretPassword123!';
      const mockHash = await bcrypt.hash(password, 10);
      vi.mocked(UserRepository.findByEmail).mockResolvedValue({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: mockHash,
        currency: 'BDT',
        locale: 'en',
        preferredLocale: 'en',
        notifyBudget: 1,
        notifyOverspend: 1,
        totpSecret: null,
        totpEnabled: 0,
        backupCodes: null,
        passwordUpdatedAt: null,
        dashboardLayout: null,
        mobileWidgetOrder: null,
        benchmarkOptIn: 0,
        demographicAgeTier: null,
        demographicRegion: null,
        createdAt: new Date().toISOString(),
      });

      const result = await AuthService.login({
        email: 'test@example.com',
        password,
      });

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.requires2FA).toBeUndefined();
    });
  });
});
