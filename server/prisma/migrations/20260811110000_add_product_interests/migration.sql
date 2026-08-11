ALTER TABLE "opportunities"
ADD COLUMN "product_interests" TEXT[] NOT NULL DEFAULT ARRAY['JM 声访']::TEXT[];
