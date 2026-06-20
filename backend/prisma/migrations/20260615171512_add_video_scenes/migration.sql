-- CreateEnum
CREATE TYPE "SceneStatus" AS ENUM ('PENDING', 'GENERATING', 'DONE', 'FAILED');

-- AlterEnum
ALTER TYPE "CreditType" ADD VALUE 'VIDEO_SCENE';

-- AlterTable
ALTER TABLE "VideoProject" ADD COLUMN     "strategyIdeaIndex" INTEGER,
ALTER COLUMN "timelineData" SET DEFAULT '{}';

-- CreateTable
CREATE TABLE "VideoScene" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 5,
    "imageUrl" TEXT,
    "clipUrl" TEXT,
    "status" "SceneStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoScene_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VideoScene" ADD CONSTRAINT "VideoScene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
