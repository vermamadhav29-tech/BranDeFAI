-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "brandBrief" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[];
