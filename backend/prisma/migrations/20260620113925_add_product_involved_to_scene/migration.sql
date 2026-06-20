-- AlterTable: store the productInvolved field from strategy scene breakdowns
ALTER TABLE "VideoScene" ADD COLUMN "productInvolved" TEXT NOT NULL DEFAULT '';
