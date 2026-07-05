-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'POSTED');

-- CreateTable
CREATE TABLE "GeneratedPost" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "occasionName" TEXT,
    "occasionEmoji" TEXT,
    "productImageId" TEXT,
    "creativeData" JSONB,
    "status" "PostStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedPost_brandId_idx" ON "GeneratedPost"("brandId");

-- CreateIndex
CREATE INDEX "GeneratedPost_userId_idx" ON "GeneratedPost"("userId");

-- AddForeignKey
ALTER TABLE "GeneratedPost" ADD CONSTRAINT "GeneratedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPost" ADD CONSTRAINT "GeneratedPost_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedPost" ADD CONSTRAINT "GeneratedPost_productImageId_fkey" FOREIGN KEY ("productImageId") REFERENCES "ProductImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
