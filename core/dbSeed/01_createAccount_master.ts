import prisma from '@/core/helpers/prisma';
import bcrypt from 'bcryptjs';
import { Prisma } from '@/prisma/generated/client';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

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

  return await new Promise<string>((resolve) => {
    const chunks: string[] = [];
    const onData = (chunk: Buffer) => {
      const char = chunk.toString('utf8');

      if (char === '\r' || char === '\n') {
        input.off('data', onData);
        output.write('\n');
        resolve(chunks.join('').trim());
        return;
      }

      if (char === '\u0003') {
        process.exit(130);
      }

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
    const firstName = (await rl.question('First name: ')).trim();
    const lastName = (await rl.question('Last name: ')).trim();
    const neupId = (await rl.question('NeupID: ')).trim();
    const dateOfBirth = (await rl.question('Date of birth (YYYY-MM-DD): ')).trim();
    const countryOfResidence = (await rl.question('Country of residence: ')).trim();

    rl.close();

    if (!firstName || !lastName || !neupId || !dateOfBirth || !countryOfResidence) {
      throw new Error('All fields are required.');
    }

    if (!isValidIsoDate(dateOfBirth)) {
      throw new Error('Date of birth must be in YYYY-MM-DD format.');
    }

    const password = await promptHidden('Password: ');

    if (!password) {
      throw new Error('Password is required.');
    }

    return {
      firstName,
      lastName,
      neupId,
      dateOfBirth,
      countryOfResidence,
      password,
    };
  } catch (error) {
    rl.close();
    throw error;
  }
}

export async function seedCreateMasterAccount() {
  const accountCount = await prisma.account.count();

  if (accountCount > 0) {
    return {
      skipped: true,
      reason: 'Accounts already exist in the database.',
      accountCount,
    };
  }

  const inputData = await promptMasterAccountInput();
  const passwordHash = await bcrypt.hash(inputData.password, 10);
  const dateOfBirth = new Date(`${inputData.dateOfBirth}T00:00:00.000Z`);
  const displayName = `${inputData.firstName} ${inputData.lastName}`.trim();

  const account = await prisma.account.create({
    data: {
      displayName,
      accountType: 'individual',
      status: 'active',
      isVerified: true,
      details: {
        role: 'master',
      } as Prisma.InputJsonValue,
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

  return {
    skipped: false,
    accountId: account.id,
    accountCount: 1,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedCreateMasterAccount()
    .then((result) => {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(async (error) => {
      // eslint-disable-next-line no-console
      console.error('Seed failed:', error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
