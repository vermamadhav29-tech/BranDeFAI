-- Add rich creative package fields to CalendarEntry
ALTER TABLE "CalendarEntry" ADD COLUMN "hashtags"     TEXT[]  NOT NULL DEFAULT '{}';
ALTER TABLE "CalendarEntry" ADD COLUMN "keywords"     TEXT[]  NOT NULL DEFAULT '{}';
ALTER TABLE "CalendarEntry" ADD COLUMN "suggestedTime" TEXT;
ALTER TABLE "CalendarEntry" ADD COLUMN "assetUrl"     TEXT;
