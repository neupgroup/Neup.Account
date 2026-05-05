import prisma from '@/core/helpers/prisma';
import { Prisma } from '@/prisma/generated/client';
import { seedApplicationOwnerRole } from './neupaccount_applicationRole';

const APPLICATION_ID = 'neup.account';

export async function seedNeupaccountApplication(creatorAccountId?: string) {
  // First, ensure the application.owner role exists
  await seedApplicationOwnerRole();

  const payload = {
    id: APPLICATION_ID,
    name: 'neup.account',
    description: 'Offical NeupAccount Application.',
    icon: 'https://neupcdn.com/neupaccount/assets/logo.png',
    website: 'https://neupgroup.com/account',
    appSecret: null as string | null,
    createdAt: new Date(),
    endpoints: 'https://neupgroup.com/account' as Prisma.InputJsonValue,
    status: 'active',
    isInternal: true,
    details: [] as Prisma.InputJsonValue,
  };

  await prisma.application.upsert({
    where: { id: APPLICATION_ID },
    update: {
      name: payload.name,
      description: payload.description,
      icon: payload.icon,
      website: payload.website,
      appSecret: payload.appSecret,
      endpoints: payload.endpoints,
      status: payload.status,
      isInternal: payload.isInternal,
      details: payload.details,
    },
    create: payload,
  });

  // If a creator account ID is provided, create an access grant
  // This allows the creator to own/manage the application
  if (creatorAccountId) {
    const ownerRole = await prisma.authzRole.findFirst({
      where: {
        name: 'application.owner',
        appId: APPLICATION_ID,
        scope: 'creator',
      },
      select: { id: true },
    });

    if (ownerRole) {
      const existingGrant = await prisma.authzAccountAccessGrant.findFirst({
        where: {
          ownerAccountId: creatorAccountId,
          targetAccountId: creatorAccountId,
          appId: APPLICATION_ID,
          roleId: ownerRole.id,
        },
        select: { id: true },
      });

      if (!existingGrant) {
        await prisma.authzAccountAccessGrant.create({
          data: {
            ownerAccountId: creatorAccountId,
            targetAccountId: creatorAccountId,
            appId: APPLICATION_ID,
            roleId: ownerRole.id,
          },
        });
      }
    }
  }

  return { id: APPLICATION_ID };
}
