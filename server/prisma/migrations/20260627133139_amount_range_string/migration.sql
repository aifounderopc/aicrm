/*
  Warnings:

  - Changed the type of `amount_range` on the `opportunities` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "opportunities" DROP COLUMN "amount_range",
ADD COLUMN     "amount_range" TEXT NOT NULL;

-- DropEnum
DROP TYPE "AmountRange";
