import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../core/helpers/prisma';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Please configure your database connection.');
}

async function main() {
  const NEUP_ID = 'neupkishor';
  const firstName = 'Kishor';
  const lastName = 'Neupane';
  const gender = 'male';
  const nationality = 'Nepal';
  const dob = new Date('2004-01-25T00:00:00.000Z');
  const passwordPlain = 'admin112';

  // Find existing account by NeupID
  const existingNeupId = await prisma.neupId.findUnique({ where: { id: NEUP_ID } });
  let accountId: string | null = existingNeupId?.accountId ?? null;

  // Fallback: search by primary neupid
  if (!accountId) {
    const existingByPrimary = await prisma.account.findFirst({
      where: { neupIdPrimary: NEUP_ID },
      select: { id: true },
    });
    if (existingByPrimary) accountId = existingByPrimary.id;
  }

  const nameDisplay = `${firstName} ${lastName}`.trim();
  const hashed = await bcrypt.hash(passwordPlain, 10);

  if (!accountId) {
    // Create fresh account with NeupID and Password
    const created = await prisma.account.create({
      data: {
        accountType: 'individual',
        accountStatus: 'active',
        verified: false,
        nameDisplay,
        nameFirst: firstName,
        nameLast: lastName,
        dateBirth: dob,
        gender,
        nationality,
        neupIdPrimary: NEUP_ID,
        neupIds: {
          create: {
            id: NEUP_ID,
            isPrimary: true,
          },
        },
        password: {
          create: {
            hash: hashed,
          },
        },
        permit: 'root.full',
      },
    });
    accountId = created.id;
  } else {
    // Update existing account and ensure neupid + password
    await prisma.account.update({
      where: { id: accountId },
      data: {
        accountType: 'individual',
        accountStatus: 'active',
        nameDisplay,
        nameFirst: firstName,
        nameLast: lastName,
        dateBirth: dob,
        gender,
        nationality,
        neupIdPrimary: NEUP_ID,
        permit: 'root.full',
      },
    });

    // Ensure NeupID record exists and is primary
    const neupRecord = await prisma.neupId.findUnique({ where: { id: NEUP_ID } });
    if (!neupRecord) {
      await prisma.neupId.create({
        data: { id: NEUP_ID, accountId, isPrimary: true },
      });
    } else if (!neupRecord.isPrimary || neupRecord.accountId !== accountId) {
      // If NeupID exists but not primary or linked, keep ownership and mark primary if owned by this account
      if (neupRecord.accountId === accountId) {
        await prisma.neupId.update({
          where: { id: NEUP_ID },
          data: { isPrimary: true },
        });
      }
    }

    // Upsert password
    await prisma.password.upsert({
      where: { accountId },
      update: { hash: hashed },
      create: { accountId, hash: hashed },
    });
  }

  // Ensure root permit attached
  if (accountId) {
    // Update account permit type to root.full for seed data
    await prisma.account.update({
      where: { id: accountId },
      data: { permit: 'root.full' },
    });

    const existingRootPermit = await prisma.permit.findFirst({
      where: { accountId, isRoot: true, forSelf: false },
    });

    if (!existingRootPermit) {
      await prisma.permit.create({
        data: {
          accountId,
          forSelf: false,
          isRoot: true,
          permissions: [], // Handled by PERMISSION_SET in user.ts
          restrictions: [],
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    // eslint-disable-next-line no-console
    console.log('Seed completed for NeupID "neupkishor".');
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    if ((e as any)?.code === 'ECONNREFUSED') {
      console.error('Seed failed: cannot connect to the database (ECONNREFUSED).');
      console.error('Check that your Postgres server is running and DATABASE_URL is correct.');
      console.error(`Current DATABASE_URL: ${process.env.DATABASE_URL || '(not set)'}`);
    } else {
      console.error('Seed failed:', e);
    }
    await prisma.$disconnect();
    process.exit(1);
  });
