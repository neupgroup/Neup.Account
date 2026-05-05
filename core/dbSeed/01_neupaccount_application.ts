import prisma from '@/core/helpers/prisma';
import { Prisma } from '@/prisma/generated/client';

const APPLICATION_ID = 'neup.account';

export async function seedNeupaccountApplication() {
  const payload = {
    id: APPLICATION_ID,
    name: 'neup.account',
    description: 'Offical NeupAccount Application.',
    icon: 'https://neupcdn.com/neupaccount/assets/logo.png',
    website: 'https://neupgroup.com/account',
    developer: null as string | null,
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
      developer: payload.developer,
      appSecret: payload.appSecret,
      endpoints: payload.endpoints,
      status: payload.status,
      isInternal: payload.isInternal,
      details: payload.details,
    },
    create: payload,
  });

  return { id: APPLICATION_ID };
}
