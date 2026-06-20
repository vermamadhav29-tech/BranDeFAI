-- AlterTable
ALTER TABLE "GeneratedImage" ADD COLUMN     "postBriefId" TEXT;

-- AddForeignKey
ALTER TABLE "GeneratedImage" ADD CONSTRAINT "GeneratedImage_postBriefId_fkey" FOREIGN KEY ("postBriefId") REFERENCES "PostBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;
