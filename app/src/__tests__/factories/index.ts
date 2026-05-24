/**
 * @fileoverview Mock data factories for test fixtures.
 *
 * Provides factory functions that create realistic test data for all
 * entities. Each factory generates unique, randomized data to prevent
 * test coupling.
 *
 * @module __tests__/factories
 */

let idCounter = 1;

/**
 * Generates a unique incrementing ID.
 */
function nextId(): number {
  return idCounter++;
}

/**
 * Resets the ID counter. Call in `beforeEach` to ensure deterministic IDs.
 */
export function resetFactories(): void {
  idCounter = 1;
}

/**
 * Creates a mock user record.
 *
 * @param overrides - Optional field overrides.
 * @returns A mock user matching the database schema.
 */
export function createMockUser(overrides: Record<string, unknown> = {}) {
  const id = nextId();
  return {
    id,
    name: `Test User ${id}`,
    email: `testuser${id}@example.com`,
    passwordHash: '$2a$12$mockHashedPasswordForTesting000000000000000000000',
    currency: 'BDT',
    notifyBudget: 1,
    notifyOverspend: 1,
    totpSecret: null,
    totpEnabled: 0,
    backupCodes: null,
    passwordUpdatedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock transaction record.
 *
 * @param userId - The owning user's ID.
 * @param overrides - Optional field overrides.
 * @returns A mock transaction matching the database schema.
 */
export function createMockTransaction(
  userId: number = 1,
  overrides: Record<string, unknown> = {}
) {
  const id = nextId();
  const types = ['expense', 'earning'] as const;
  const categories = ['Food', 'Transport', 'Entertainment', 'Salary', 'Freelance'];
  return {
    id,
    userId,
    type: types[id % 2],
    amount: Math.round(Math.random() * 500 * 100) / 100,
    encryptedAmount: null,
    category: categories[id % categories.length],
    description: `Test transaction ${id}`,
    encryptedDescription: null,
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock budget record.
 *
 * @param userId - The owning user's ID.
 * @param overrides - Optional field overrides.
 * @returns A mock budget matching the database schema.
 */
export function createMockBudget(
  userId: number = 1,
  overrides: Record<string, unknown> = {}
) {
  const id = nextId();
  const now = new Date();
  return {
    id,
    userId,
    category: 'Food',
    monthlyLimit: 500,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    createdAt: now.toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock net worth record.
 *
 * @param userId - The owning user's ID.
 * @param overrides - Optional field overrides.
 * @returns A mock net worth entry.
 */
export function createMockNetWorth(
  userId: number = 1,
  overrides: Record<string, unknown> = {}
) {
  const id = nextId();
  return {
    id,
    userId,
    amount: Math.round(Math.random() * 100000 * 100) / 100,
    encryptedAmount: null,
    note: `Net worth snapshot ${id}`,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock notification record.
 *
 * @param userId - The owning user's ID.
 * @param overrides - Optional field overrides.
 */
export function createMockNotification(
  userId: number = 1,
  overrides: Record<string, unknown> = {}
) {
  const id = nextId();
  return {
    id,
    userId,
    type: 'info',
    title: `Test Notification ${id}`,
    message: `This is test notification number ${id}`,
    read: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock savings goal record.
 *
 * @param userId - The owning user's ID.
 * @param overrides - Optional field overrides.
 */
export function createMockGoal(
  userId: number = 1,
  overrides: Record<string, unknown> = {}
) {
  const id = nextId();
  return {
    id,
    userId,
    name: `Goal ${id}`,
    targetAmount: 10000,
    savedAmount: Math.round(Math.random() * 5000),
    encryptedTargetAmount: null,
    encryptedSavedAmount: null,
    deadline: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock recurring transaction record.
 *
 * @param userId - The owning user's ID.
 * @param overrides - Optional field overrides.
 */
export function createMockRecurring(
  userId: number = 1,
  overrides: Record<string, unknown> = {}
) {
  const id = nextId();
  return {
    id,
    userId,
    name: `Recurring ${id}`,
    type: 'expense' as const,
    amount: 100,
    category: 'Subscription',
    frequency: 'monthly' as const,
    nextDate: new Date().toISOString().split('T')[0],
    active: 1,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock audit log entry.
 *
 * @param overrides - Optional field overrides.
 */
export function createMockAuditLog(
  overrides: Record<string, unknown> = {}
) {
  const id = nextId();
  return {
    id,
    userId: 1,
    action: 'CREATE',
    entityType: 'transaction',
    entityId: String(id),
    oldValue: null,
    newValue: JSON.stringify({ amount: 50, category: 'Food' }),
    ipAddress: '127.0.0.1',
    userAgent: 'Vitest/1.0',
    metadata: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock session record.
 *
 * @param userId - The owning user's ID.
 * @param overrides - Optional field overrides.
 */
export function createMockSession(
  userId: number = 1,
  overrides: Record<string, unknown> = {}
) {
  const id = nextId();
  return {
    id,
    userId,
    tokenHash: `mock-hash-${id}`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    revoked: 0,
    deviceFingerprint: `fp-${id}`,
    deviceName: 'Chrome on macOS',
    ipAddress: '127.0.0.1',
    userAgent: 'Vitest/1.0',
    lastUsedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
