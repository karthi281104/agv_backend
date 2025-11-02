import { PrismaClient } from '@prisma/client';

// Ensure a single PrismaClient instance across the app (important for pooled DBs)
// In dev with hot-reload, reuse the instance via globalThis to avoid too many connections
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? [] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
