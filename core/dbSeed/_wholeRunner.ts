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
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { Prisma } from '@/prisma/generated/client';
import prisma from '@/core/helpers/prisma';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set.');
}

// ---------------------------------------------------------------------------
// Constants — stable role IDs defined in default.sql
// ---------------------------------------------------------------------------

const APP_ID             = 'neup.account';
const ROLE_INDIV_DEFAULT = 'individual-default-neup-account';
const ROLE_INDIV_ROOT    = 'root-full-neup-account';
const ACCOUNT_ID         = '';

// ---------------------------------------------------------------------------
// Logging helpers
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
// ACCOUNT_ID env var — if set, skip account creation and use this ID directly
// ---------------------------------------------------------------------------

const ENV_ACCOUNT_ID = process.env.ACCOUNT_ID?.trim() || null;

// ---------------------------------------------------------------------------
// Step 2 — Create master account (interactive prompt)
// ---------------------------------------------------------------------------

type MasterAccountInput = {
  firstName: string;
  lastName: string;
  neupId: string;
  dateOfBirth: string;
  countryOfResidence: string;
  password: string;
};

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

async function promptHidden(question: string): Promise<string> {
  output.write(question);

  return new Promise<string>((resolve) => {
    const chunks: string[] = [];
    const onData = (chunk: Buffer) => {
      const char = chunk.toString('utf8');

      if (char === '\r' || char === '\n') {
        input.off('data', onData);
        output.write('\n');
        resolve(chunks.join('').trim());
        return;
      }

      if (char === '\u0003') process.exit(130);

      if (char === '\u0008' || char === '\u007f') {
        chunks.pop();
        return;
      }

      chunks.push(char);
    };

    input.on('data', onData);
  });
}

async function promptMasterAccountInput(): Promise<MasterAccountInput> {
  const rl = createInterface({ input, output });

  try {
    const firstName          = (await rl.question('First name: ')).trim();
    const lastName           = (await rl.question('Last name: ')).trim();
    const neupId             = (await rl.question('NeupID: ')).trim();
    const dateOfBirth        = (await rl.question('Date of birth (YYYY-MM-DD): ')).trim();
    const countryOfResidence = (await rl.question('Country of residence: ')).trim();

    rl.close();

    if (!firstName || !lastName || !neupId || !dateOfBirth || !countryOfResidence) {
      throw new Error('All fields are required.');
    }

    if (!isValidIsoDate(dateOfBirth)) {
      throw new Error('Date of birth must be in YYYY-MM-DD format.');
    }

    const password = await promptHidden('Password: ');
    if (!password) throw new Error('Password is required.');

    return { firstName, lastName, neupId, dateOfBirth, countryOfResidence, password };
  } catch (error) {
    rl.close();
    throw error;
  }
}

async function createMasterAccount(): Promise<{ skipped: boolean; reason?: string; accountId?: string }> {
  const accountCount = await prisma.account.count();

  if (accountCount > 0) {
    return { skipped: true, reason: 'Accounts already exist in the database.' };
  }

  const inputData    = await promptMasterAccountInput();
  const passwordHash = await bcrypt.hash(inputData.password, 10);
  const dateOfBirth  = new Date(`${inputData.dateOfBirth}T00:00:00.000Z`);
  const displayName  = `${inputData.firstName} ${inputData.lastName}`.trim();

  const account = await prisma.account.create({
    data: {
      displayName,
      accountType: 'individual',
      status: 'active',
      isVerified: true,
      details: { role: 'master' } as Prisma.InputJsonValue,
      individualProfile: {
        create: {
          firstName: inputData.firstName,
          lastName: inputData.lastName,
          dateOfBirth,
          countryOfResidence: inputData.countryOfResidence,
        },
      },
      authMethods: {
        create: {
          type: 'password',
          value: passwordHash,
          order: 'primary',
          status: 'active',
        },
      },
      neupIds: {
        create: {
          id: inputData.neupId,
          neupId: inputData.neupId,
          isPrimary: true,
        },
      },
    },
  });

  return { skipped: false, accountId: account.id };
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

  // Step 1 — Run default.sql
  try {
    log(1, 'Running default.sql…');
    await runDefaultSql();
    log(1, 'default.sql applied', 'application, roles, capabilities, maps ready');
  } catch (error) {
    logError(1, 'default.sql', error);
    throw error;
  }

  // Step 2 — Create master account (or resolve existing via ACCOUNT_ID)
  let accountId: string | null = null;

  try {
    if (ENV_ACCOUNT_ID) {
      // ACCOUNT_ID is set — verify it exists and skip creation
      log(2, 'ACCOUNT_ID provided, verifying…');
      const existing = await prisma.account.findUnique({
        where: { id: ENV_ACCOUNT_ID },
        select: { id: true },
      });
      if (!existing) {
        throw new Error(`ACCOUNT_ID "${ENV_ACCOUNT_ID}" not found in the database.`);
      }
      accountId = ENV_ACCOUNT_ID;
      logSkipped(2, 'createMasterAccount', `using ACCOUNT_ID=${accountId}`);
    } else {
      log(2, 'Creating master account…');
      const result = await createMasterAccount();

      if (result.skipped) {
        logSkipped(2, 'createMasterAccount', result.reason ?? 'accounts already exist');
        const first = await prisma.account.findFirst({
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        accountId = first?.id ?? null;
      } else {
        accountId = result.accountId ?? null;
        log(2, 'Master account created', `accountId=${accountId}`);
      }
    }
  } catch (error) {
    logError(2, 'createMasterAccount', error);
    throw error;
  }

  // Step 3 — Assign roles
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
