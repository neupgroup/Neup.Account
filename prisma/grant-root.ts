import 'dotenv/config';
import prisma from '../core/helpers/prisma';
import { ROOT_PERMISSIONS } from '../services/permissions-config';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set.');
}

// Usage:
//   tsx prisma/grant-root.ts <accountId>
//   tsx prisma/grant-root.ts --neupid <neupId>

async function main() {
  const args = process.argv.slice(2);

  let accountId: string | null = null;

  const neupidFlag = args.indexOf('--neupid');
  if (neupidFlag !== -1) {
    const neupId = args[neupidFlag + 1];
    if (!neupId) throw new Error('--neupid requires a value.');
    const record = await prisma.neupId.findUnique({ where: { id: neupId.toLowerCase() } });
    if (!record) throw new Error(`NeupID "${neupId}" not found.`);
    accountId = record.accountId;
  } else if (args[0]) {
    accountId = args[0];
  } else {
    throw new Error('Usage: tsx prisma/grant-root.ts <accountId>  OR  tsx prisma/grant-root.ts --neupid <neupId>');
  }

  const account = await prisma.account.findUnique({ where: { id: accountId }, select: { id: true, displayName: true } });
  if (!account) throw new Error(`Account "${accountId}" not found.`);

  const existing = await prisma.permit.findFirst({
    where: { accountId, isRoot: true, forSelf: false },
  });

  if (!existing) {
    await prisma.permit.create({
      data: {
        accountId,
        forSelf: false,
        isRoot: true,
        permissions: ROOT_PERMISSIONS,
        restrictions: [],
      },
    });
    console.log(`Root permit created for account "${account.displayName}" (${accountId}).`);
  } else {
    await prisma.permit.update({
      where: { id: existing.id },
      data: { permissions: ROOT_PERMISSIONS, restrictions: [] },
    });
    console.log(`Root permit updated for account "${account.displayName}" (${accountId}).`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('grant-root failed:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
