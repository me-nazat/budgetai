export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    env: {
      hasTursoUrl: Boolean(process.env.TURSO_DATABASE_URL),
      hasTursoToken: Boolean(process.env.TURSO_AUTH_TOKEN),
      tursoUrlPrefix: process.env.TURSO_DATABASE_URL ? process.env.TURSO_DATABASE_URL.slice(0, 15) : 'none',
      hasJwtSecret: Boolean(process.env.JWT_SECRET),
      hasMasterKey: Boolean(process.env.ENCRYPTION_MASTER_KEY),
      nodeEnv: process.env.NODE_ENV,
    },
  };

  // Step 1: Test env module
  try {
    const { env } = await import('@/lib/env');
    diagnostics.envModule = {
      tursoUrl: env.TURSO_DATABASE_URL.slice(0, 15),
      hasToken: Boolean(env.TURSO_AUTH_TOKEN),
      tokenLen: env.TURSO_AUTH_TOKEN?.length ?? 0,
      jwtSecretLen: env.JWT_SECRET?.length ?? 0,
    };
  } catch (err: any) {
    diagnostics.envModuleError = {
      message: err?.message,
      stack: err?.stack,
    };
  }

  // Step 2: Test direct @libsql/client/web connection
  try {
    const { createClient } = await import('@libsql/client/web');
    diagnostics.libsqlWebLoaded = true;
    const client = createClient({
      url:
        process.env.TURSO_DATABASE_URL ||
        'libsql://budget-mewho.aws-ap-northeast-1.turso.io',
      authToken:
        process.env.TURSO_AUTH_TOKEN ||
        'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIxMDY3NjUsImlkIjoiMDE5Yzk5Y2EtZTQwMS03MzI3LTkzMjQtZTdjMjIxYjViYjZlIiwicmlkIjoiMjlmNDViZGUtZDk5ZS00NTU1LWI0ZTEtNWFhMzE4NDJhOTlkIn0.5SQjormdclcCcRcNVngGW9ydbUhyKSRzrX7HOeo0HUTfKHVsvb4PtYaX_0fxF_9ZH-_XuiAIDTC7CWEArWWCBA',
    });
    const res = await client.execute('SELECT 1 as test_col');
    diagnostics.directLibsqlQuery = res.rows;
  } catch (err: any) {
    diagnostics.directLibsqlError = {
      message: err?.message,
      stack: err?.stack,
    };
  }

  // Step 3: Test db/client singleton
  try {
    const { db } = await import('@/db/client');
    const { sql } = await import('drizzle-orm');
    diagnostics.drizzleLoaded = true;
    const res = await db.run(sql`SELECT count(*) as count FROM users`);
    diagnostics.drizzleUsersCount = res.rows;
  } catch (err: any) {
    diagnostics.drizzleError = {
      message: err?.message,
      stack: err?.stack,
    };
  }

  // Step 4: Test UserRepository
  try {
    const { UserRepository } = await import('@/repositories/user.repository');
    const user = await UserRepository.findByEmail('nazatal619@gmail.com');
    diagnostics.userFound = Boolean(user);
    diagnostics.userId = user?.id;
  } catch (err: any) {
    diagnostics.userRepoError = {
      message: err?.message,
      stack: err?.stack,
    };
  }

  // Step 5: Test AuthService import
  try {
    const { AuthService } = await import('@/services/auth.service');
    diagnostics.authServiceLoaded = Boolean(AuthService);
  } catch (err: any) {
    diagnostics.authServiceError = {
      message: err?.message,
      stack: err?.stack,
    };
  }

  // Step 6: Test apiHandler wrapper
  try {
    const { apiHandler } = await import('@/lib/middleware/api-handler');
    diagnostics.apiHandlerLoaded = Boolean(apiHandler);
  } catch (err: any) {
    diagnostics.apiHandlerError = {
      message: err?.message,
      stack: err?.stack,
    };
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
