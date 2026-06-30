-- CreateTable
CREATE TABLE "ContentQualityLog" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "needsImprovement" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentQualityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentQualityLog_contentId_idx" ON "ContentQualityLog"("contentId");

-- CreateIndex
CREATE INDEX "ContentQualityLog_brandId_idx" ON "ContentQualityLog"("brandId");
