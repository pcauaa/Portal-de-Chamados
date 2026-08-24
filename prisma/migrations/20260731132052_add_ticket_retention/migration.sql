-- DropIndex
DROP INDEX "users_name_trgm_idx";

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "purged_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "tickets_status_closed_at_idx" ON "tickets"("status", "closed_at");
