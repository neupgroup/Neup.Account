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
  const nationality = 'Nepal';
  const dob = new Date('2004-01-25T00:00:00.000Z');
  const passwordPlain = 'admin112';

  const existingNeupId = await prisma.neupId.findUnique({ where: { id: NEUP_ID } });
  let accountId: string | null = existingNeupId?.accountId ?? null;

  const nameDisplay = `${firstName} ${lastName}`.trim();
  const hashed = await bcrypt.hash(passwordPlain, 10);

  if (!accountId) {
    const created = await prisma.account.create({
      data: {
        accountType: 'individual',
        status: 'active',
        isVerified: false,
        displayName: nameDisplay,
        individualProfile: {
          create: {
            firstName,
            lastName,
            dateOfBirth: dob,
            countryOfResidence: nationality,
            authMethods: {
              create: {
                type: 'password',
                value: hashed,
                order: 'primary',
                status: 'active',
              },
            },
          },
        },
        neupIds: {
          create: {
            id: NEUP_ID,
            isPrimary: true,
          },
        },
      },
    });

    accountId = created.id;
  } else {
    await prisma.account.update({
      where: { id: accountId },
      data: {
        accountType: 'individual',
        status: 'active',
        displayName: nameDisplay,
        isVerified: false,
        individualProfile: {
          upsert: {
            update: {
              firstName,
              lastName,
              dateOfBirth: dob,
              countryOfResidence: nationality,
            },
            create: {
              firstName,
              lastName,
              dateOfBirth: dob,
              countryOfResidence: nationality,
            },
          },
        },
      },
    });

    const neupRecord = await prisma.neupId.findUnique({ where: { id: NEUP_ID } });
    if (!neupRecord) {
      await prisma.neupId.create({
        data: { id: NEUP_ID, accountId, isPrimary: true },
      });
    } else if (neupRecord.accountId === accountId && !neupRecord.isPrimary) {
      await prisma.neupId.update({
        where: { id: NEUP_ID },
        data: { isPrimary: true },
      });
    }

    await prisma.authMethod.upsert({
      where: {
        accountId_type_order: {
          accountId,
          type: 'password',
          order: 'primary',
        },
      },
      update: {
        status: 'active',
        value: hashed,
      },
      create: {
        accountId,
        type: 'password',
        value: hashed,
        order: 'primary',
        status: 'active',
      },
    });
  }

  if (accountId) {
    const existingRootPermit = await prisma.permit.findFirst({
      where: { accountId, isRoot: true, forSelf: false },
    });

    if (!existingRootPermit) {
      await prisma.permit.create({
        data: {
          accountId,
          forSelf: false,
          isRoot: true,
          permissions: [],
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
