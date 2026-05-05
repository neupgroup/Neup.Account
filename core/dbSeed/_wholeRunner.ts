/**
 * _wholeRunner.ts
 *
 * Master seed runner — fully self-contained, no manual prerequisites.
 *
 *   Step 1 — Execute default.sql  (application, roles, capabilities, maps)
 *   Step 2 — Create the master account  (interactive prompt)
 *   Step 3 — Assign neup.account roles to the master account
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json core/dbSeed/_wholeRunner.ts
 */

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import prisma from '@/core/helpers/prisma';
import { seedCreateMasterAccount } from './createAccount_master';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set.');
}

// ---------------------------------------------------------------------------
// Constants — stable role IDs defined in default.sql
// ---------------------------------------------------------------------------

const APP_ID             = 'neup.account';
const ROLE_INDIV_DEFAULT = 'role-indiv-default-0000-000000000001';
const ROLE_INDIV_ROOT    = 'role-indiv-root-00000-000000000002';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(step: number, label: string, detail?: string) {
  // eslint-disable-next-line no-console
  console.log(`[Step ${step}] ${label}${detail ? ` — ${detail}` : ''}`);
}

function logSkipped(step: number, label: string, reason: string) {
  // eslint-disable-next-line no-console
  console.log(`[Step ${step}] SKIPPED ${label} — ${reason}`);
}

function logError(step: number, label: string, error: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[Step ${step}] FAILED ${label}:`, error);
}

// ---------------------------------------------------------------------------
// Step 1 — Execute default.sql via a raw pg pool
// Prisma doesn't support multi-statement SQL, so we use pg directly.
// ---------------------------------------------------------------------------

async function runDefaultSql(): Promise<void> {
  const sqlPath = resolve(process.cwd(), 'core/dbSeed/default.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(sql);
  } finally {
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// Step 3 — Grant neup.account roles to the master account
// ---------------------------------------------------------------------------

async function assignApplicationToAccount(accountId: string): Promise<void> {
  for (const roleId of [ROLE_INDIV_DEFAULT, ROLE_INDIV_ROOT]) {
    const existing = await prisma.authzAccountAccessGrant.findFirst({
      where: { ownerAccountId: accountId, targetAccountId: accountId, appId: APP_ID, roleId },
      select: { id: true },
    });

    if (!existing) {
      await prisma.authzAccountAccessGrant.create({
        data: { ownerAccountId: accountId, targetAccountId: accountId, appId: APP_ID, roleId },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // eslint-disable-next-line no-console
  console.log('\n=== neup.account seed runner ===\n');

  // ------------------------------------------------------------------
  // Step 1 — Run default.sql (application + roles + capabilities)
  // ------------------------------------------------------------------
  try {
    log(1, 'Running default.sql…');
    await runDefaultSql();
    log(1, 'default.sql applied', 'application, roles, capabilities, maps ready');
  } catch (error) {
    logError(1, 'default.sql', error);
    throw error;
  }

  // ------------------------------------------------------------------
  // Step 2 — Create master account
  // ------------------------------------------------------------------
  let accountId: string | null = null;

  try {
    log(2, 'Creating master account…');
    const result = await seedCreateMasterAccount();

    if (result.skipped) {
      logSkipped(2, 'createAccount_master', result.reason ?? 'accounts already exist');
      const first = await prisma.account.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      accountId = first?.id ?? null;
    } else {
      accountId = result.accountId ?? null;
      log(2, 'Master account created', `accountId=${accountId}`);
    }
  } catch (error) {
    logError(2, 'createAccount_master', error);
    throw error;
  }

  // ------------------------------------------------------------------
  // Step 3 — Assign neup.account roles to the master account
  // ------------------------------------------------------------------
  if (!accountId) {
    // eslint-disable-next-line no-console
    console.warn('[Step 3] SKIPPED — no accountId available.');
  } else {
    try {
      log(3, 'Assigning neup.account roles to master account…');
      await assignApplicationToAccount(accountId);
      log(3, 'Roles assigned', `accountId=${accountId} → individual.default + individual.root`);
    } catch (error) {
      logError(3, 'assignApplicationToAccount', error);
      throw error;
    }
  }

  // eslint-disable-next-line no-console
  console.log('\n=== Seed complete ===\n');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error('\nSeed runner failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
