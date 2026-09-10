-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'channel_admin', 'sales_admin', 'sales', 'channel');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('reporting', 'signing', 'delivery', 'signed', 'released');

-- CreateEnum
CREATE TYPE "CustomerSource" AS ENUM ('direct', 'channel');

-- CreateEnum
CREATE TYPE "AmountRange" AS ENUM ('under5', '5to10', '10to20', '20to50', 'above50');

-- CreateEnum
CREATE TYPE "ChannelStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "RenewalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "channel_id" TEXT,
    "is_jd_manager" BOOLEAN NOT NULL DEFAULT false,
    "group_name" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "must_change_pwd" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "full_name" TEXT,
    "contact_name" TEXT NOT NULL,
    "phone" TEXT,
    "jd_manager_name" TEXT,
    "status" "ChannelStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_name_norm" TEXT NOT NULL,
    "company_name" TEXT,
    "industry" TEXT NOT NULL,
    "source" "CustomerSource" NOT NULL,
    "channel_id" TEXT,
    "channel_name" TEXT,
    "channel_manager_name" TEXT,
    "sa_owner_id" TEXT NOT NULL,
    "sa_owner_name" TEXT NOT NULL,
    "sales_owner_id" TEXT NOT NULL,
    "sales_owner_name" TEXT NOT NULL,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'reporting',
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "release_at" TIMESTAMP(3) NOT NULL,
    "locked_permanently" BOOLEAN NOT NULL DEFAULT false,
    "amount_range" "AmountRange" NOT NULL,
    "first_contact_date" TIMESTAMP(3),
    "requirement_description" TEXT NOT NULL,
    "contract_no" TEXT,
    "signed_date" TIMESTAMP(3),
    "signed_amount" INTEGER,
    "contract_file_key" TEXT,
    "is_frozen" BOOLEAN NOT NULL DEFAULT false,
    "frozen_reason" TEXT,
    "release_reason" TEXT,
    "released_by" TEXT,
    "released_at" TIMESTAMP(3),
    "is_subsidiary" BOOLEAN NOT NULL DEFAULT false,
    "parent_company_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_contacts" (
    "opportunity_id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "contact_types" TEXT[],
    "enc_name" TEXT,
    "enc_contact" TEXT,
    "phone_hash" TEXT,

    CONSTRAINT "opportunity_contacts_pkey" PRIMARY KEY ("opportunity_id")
);

-- CreateTable
CREATE TABLE "evidence_files" (
    "id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "oss_key" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'pending',
    "reject_reason" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_reports" (
    "id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "last_contact_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "estimated_sign_date" TIMESTAMP(3),
    "needs_support" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renewal_requests" (
    "id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "status" "RenewalStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "processed_by" TEXT,

    CONSTRAINT "renewal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "opportunity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "ip" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_channel_id_idx" ON "users"("channel_id");

-- CreateIndex
CREATE INDEX "opportunities_customer_name_norm_industry_idx" ON "opportunities"("customer_name_norm", "industry");

-- CreateIndex
CREATE INDEX "opportunities_sales_owner_id_idx" ON "opportunities"("sales_owner_id");

-- CreateIndex
CREATE INDEX "opportunities_stage_idx" ON "opportunities"("stage");

-- CreateIndex
CREATE INDEX "opportunities_release_at_idx" ON "opportunities"("release_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");

-- CreateIndex
CREATE INDEX "operation_logs_actor_id_idx" ON "operation_logs"("actor_id");

-- CreateIndex
CREATE INDEX "operation_logs_action_idx" ON "operation_logs"("action");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_sales_owner_id_fkey" FOREIGN KEY ("sales_owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_contacts" ADD CONSTRAINT "opportunity_contacts_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_files" ADD CONSTRAINT "evidence_files_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_reports" ADD CONSTRAINT "progress_reports_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renewal_requests" ADD CONSTRAINT "renewal_requests_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
