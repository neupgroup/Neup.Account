import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../prisma/generated/client/client'

const connectionString = process.env.DATABASE_URL

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prismaClientSingleton = () => {
  return new PrismaClient({ adapter })
}

function hasRequiredDelegates(client: ReturnType<typeof prismaClientSingleton> | undefined): boolean {
  if (!client) return false

  const candidate = client as any
  return Boolean(
    candidate.assetGroupInfo &&
    candidate.assetGroupMember &&
    candidate.assetMemberRole &&
    candidate.appProfile,
  )
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = hasRequiredDelegates(globalThis.prisma)
  ? globalThis.prisma!
  : prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
