-- CreateTable
CREATE TABLE "PostBrief" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productImageId" TEXT NOT NULL,
    "briefJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostBrief_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PostBrief" ADD CONSTRAINT "PostBrief_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostBrief" ADD CONSTRAINT "PostBrief_productImageId_fkey" FOREIGN KEY ("productImageId") REFERENCES "ProductImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
