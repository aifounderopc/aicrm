ALTER TABLE "opportunities"
ALTER COLUMN "signed_amount" TYPE DOUBLE PRECISION
USING "signed_amount"::DOUBLE PRECISION;
