-- Switch default currency from CLP (Chilean peso, leftover from the initial
-- scaffolding) to UYU (Uruguayan peso), matching the project's actual market.
ALTER TABLE "Plan" ALTER COLUMN "currency" SET DEFAULT 'UYU';
ALTER TABLE "Payment" ALTER COLUMN "currency" SET DEFAULT 'UYU';

-- Backfill any existing rows that were created with the old CLP default.
UPDATE "Plan" SET "currency" = 'UYU' WHERE "currency" = 'CLP';
UPDATE "Payment" SET "currency" = 'UYU' WHERE "currency" = 'CLP';
