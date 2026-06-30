-- AlterTable
ALTER TABLE "GeneratedContent" ADD COLUMN     "captionAltIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "captionAlternates" JSONB,
ADD COLUMN     "captionSelected" JSONB,
ADD COLUMN     "seoKeywords" JSONB;
