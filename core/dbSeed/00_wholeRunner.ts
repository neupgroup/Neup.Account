/**
 * 00_wholeRunner.ts
 *
 * Master seed runner. Executes all seeders in dependency order:
 *
 *   Step 1 — Create the neup.account application (no account grant yet)
 *   Step 2 — Seed application.owner role + capabilities
 *   Step 3 — Seed individual.default role + capabilities
 *   Step 4 — Seed individual.root role + capabilities (admin-only)
 *   Step 5 — Create the master account (prompts for input)
 *   Step 6 — Assign neup.account application to the master account
 *             (individual.default + individual.root grants)
 *
 * Usage:
 *   tsx core/dbSeed/00_wholeRunner.ts
 */

import 'dotenv/config';
import prisma from '@/core/helpers/prisma';
import { seedNeupaccountApplication } from './neupaccount_application';
import { seedApplicationOwnerRole } from './neupaccount_applicationRole';
import { seedIndividualDefaultRoleCapability } from './indivDefault_roleCapability';
import { seedIndividualRootRoleCapability } from './indivRoot_roleCapability';
import { seedCreateMasterAccount } from './createAccount_master';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set.');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(step: number, label: string, detail?: string) {
  const prefix = `[Step ${step}]`;
  // eslint-disable-next-line no-console
  console.log(detail ? `${prefix} ${label} — ${detail}` : `${prefix} ${label}`);
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
// Step 6 — Assign neup.account to the master account
// ---------------------------------------------------------------------------

async function assignApplicationToAccount(accountId: string): Promise<void> {
  const APP_ID = 'neup.account';

  // Resolve the two roles we want to grant
  const [defaultRole, rootRole] = await Promise.all([
    prisma.authzRole.findFirst({
      where: { name: 'individual.default', appId: APP_ID, scope: 'default' },
      select: { id: true },
    }),
    prisma.authzRole.findFirst({
      where: { name: 'individual.root', appId: APP_ID, scope: 'root' },
      select: { id: true },
    }),
  ]);

  if (!defaultRole) throw new Error('individual.default role not found — run Step 3 first.');
  if (!rootRole) throw new Error('individual.root role not found — run Step 4 first.');

  const rolesToGrant = [defaultRole.id, rootRole.id];

  for (const roleId of rolesToGrant) {
    const existing = await prisma.authzAccountAccessGrant.findFirst({
      where: {
        ownerAccountId: accountId,
        targetAccountId: accountId,
        appId: APP_ID,
        roleId,
      },
      select: { id: true },
    });

    if (!existing) {
      await prisma.authzAccountAccessGrant.create({
        data: {
          ownerAccountId: accountId,
          targetAccountId: accountId,
          appId: APP_ID,
          roleId,
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

async function main() {
  // eslint-disable-next-line no-console
  console.log('\n=== neup.account seed runner ===\n');

  // ------------------------------------------------------------------
  // Step 1 — Create the neup.account application
  // Note: we pass no creatorAccountId here — the account doesn't exist
  // yet. The grant is handled in Step 6 after the account is created.
  // ------------------------------------------------------------------
  try {
    log(1, 'Creating neup.account application…');
    const appResult = await seedNeupaccountApplication();
    log(1, 'neup.account application ready', `id=${appResult.id}`);
  } catch (error) {
    logError(1, 'seedNeupaccountApplication', error);
    throw error;
  }

  // ------------------------------------------------------------------
  // Step 2 — Seed application.owner role + capabilities
  // ------------------------------------------------------------------
  try {
    log(2, 'Seeding application.owner role…');
    const result = await seedApplicationOwnerRole();
    log(2, 'application.owner role ready', `roleId=${result.roleId}, capabilities=${result.capabilityCount}`);
  } catch (error) {
    logError(2, 'seedApplicationOwnerRole', error);
    throw error;
  }

  // ------------------------------------------------------------------
  // Step 3 — Seed individual.default role + capabilities
  // ------------------------------------------------------------------
  try {
    log(3, 'Seeding individual.default role…');
    const result = await seedIndividualDefaultRoleCapability();
    log(3, 'individual.default role ready', `roleId=${result.roleId}, capabilities=${result.capabilityCount}`);
  } catch (error) {
    logError(3, 'seedIndividualDefaultRoleCapability', error);
    throw error;
  }

  // ------------------------------------------------------------------
  // Step 4 — Seed individual.root role + capabilities (admin-only)
  // ------------------------------------------------------------------
  try {
    log(4, 'Seeding individual.root role…');
    const result = await seedIndividualRootRoleCapability();
    log(4, 'individual.root role ready', `roleId=${result.roleId}, capabilities=${result.capabilityCount}`);
  } catch (error) {
    logError(4, 'seedIndividualRootRoleCapability', error);
    throw error;
  }

  // ------------------------------------------------------------------
  // Step 5 — Create the master account (interactive prompt)
  // ------------------------------------------------------------------
  let accountId: string | null = null;

  try {
    log(5, 'Creating master account…');
    const result = await seedCreateMasterAccount();

    if (result.skipped) {
      logSkipped(5, 'seedCreateMasterAccount', result.reason ?? 'accounts already exist');
      // Fetch the first existing account so we can still do Step 6
      const firstAccount = await prisma.account.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      accountId = firstAccount?.id ?? null;
    } else {
      accountId = result.accountId ?? null;
      log(5, 'Master account created', `accountId=${accountId}`);
    }
  } catch (error) {
    logError(5, 'seedCreateMasterAccount', error);
    throw error;
  }

  // ------------------------------------------------------------------
  // Step 6 — Assign neup.account application to the master account
  // ------------------------------------------------------------------
  if (!accountId) {
    // eslint-disable-next-line no-console
    console.warn('[Step 6] SKIPPED — no accountId available, cannot assign application.');
  } else {
    try {
      log(6, 'Assigning neup.account to master account…');
      await assignApplicationToAccount(accountId);
      log(6, 'Application assigned', `accountId=${accountId} → individual.default + individual.root`);
    } catch (error) {
      logError(6, 'assignApplicationToAccount', error);
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
