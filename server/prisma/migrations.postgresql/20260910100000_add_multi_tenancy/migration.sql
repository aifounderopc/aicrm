CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_code_key" ON "tenants"("code");

INSERT INTO "tenants" ("id", "name", "code", "status", "is_default")
VALUES ('tenant_joymarketing', 'JoyMarketing 声访', 'joymarketing', 'active', true);

ALTER TABLE "users" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'tenant_joymarketing';
ALTER TABLE "users" ADD COLUMN "is_platform_admin" BOOLEAN NOT NULL DEFAULT false;
UPDATE "users" SET "is_platform_admin" = true WHERE "role" = 'admin';

ALTER TABLE "channels" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'tenant_joymarketing';
ALTER TABLE "opportunities" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'tenant_joymarketing';
ALTER TABLE "opportunity_inspection_bindings" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'tenant_joymarketing';
ALTER TABLE "operation_logs" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'tenant_joymarketing';
ALTER TABLE "integration_connections" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'tenant_joymarketing';
ALTER TABLE "feishu_messages" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'tenant_joymarketing';
ALTER TABLE "agent_configurations" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'tenant_joymarketing';
ALTER TABLE "agent_model_configurations" ADD COLUMN "tenant_id" TEXT NOT NULL DEFAULT 'tenant_joymarketing';

DROP INDEX "integration_connections_provider_key";
DROP INDEX "opportunity_inspection_bindings_channel_group_id_key";

CREATE UNIQUE INDEX "integration_connections_tenant_id_provider_key" ON "integration_connections"("tenant_id", "provider");
CREATE UNIQUE INDEX "opportunity_inspection_bindings_tenant_id_channel_group_id_key" ON "opportunity_inspection_bindings"("tenant_id", "channel", "group_id");
CREATE UNIQUE INDEX "agent_configurations_tenant_id_key" ON "agent_configurations"("tenant_id");

CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");
CREATE INDEX "channels_tenant_id_idx" ON "channels"("tenant_id");
CREATE INDEX "opportunities_tenant_id_idx" ON "opportunities"("tenant_id");
CREATE INDEX "opportunity_inspection_bindings_tenant_id_idx" ON "opportunity_inspection_bindings"("tenant_id");
CREATE INDEX "operation_logs_tenant_id_idx" ON "operation_logs"("tenant_id");
CREATE INDEX "integration_connections_tenant_id_idx" ON "integration_connections"("tenant_id");
CREATE INDEX "feishu_messages_tenant_id_idx" ON "feishu_messages"("tenant_id");
CREATE INDEX "agent_model_configurations_tenant_id_idx" ON "agent_model_configurations"("tenant_id");

ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channels" ADD CONSTRAINT "channels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opportunity_inspection_bindings" ADD CONSTRAINT "opportunity_inspection_bindings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "feishu_messages" ADD CONSTRAINT "feishu_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_configurations" ADD CONSTRAINT "agent_configurations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_model_configurations" ADD CONSTRAINT "agent_model_configurations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
