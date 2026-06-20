import { PrismaClient, CreditType } from "@prisma/client";
import { createError } from "../middleware/errorHandler";

export async function deductCredits(
  prisma: PrismaClient,
  userId: string,
  amount: number,
  type: CreditType,
  referenceId?: string
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { creditsBalance: true },
    });

    if (!user || user.creditsBalance < amount) {
      throw createError("Insufficient credits", 402);
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: { creditsBalance: { decrement: amount } },
      select: { creditsBalance: true },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        amount: -amount,
        type,
        referenceId,
        balanceAfter: updated.creditsBalance,
      },
    });

    return updated.creditsBalance;
  });
}

export async function addCredits(
  prisma: PrismaClient,
  userId: string,
  amount: number,
  type: CreditType,
  referenceId?: string
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { creditsBalance: { increment: amount } },
      select: { creditsBalance: true },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        amount,
        type,
        referenceId,
        balanceAfter: updated.creditsBalance,
      },
    });

    return updated.creditsBalance;
  });
}
