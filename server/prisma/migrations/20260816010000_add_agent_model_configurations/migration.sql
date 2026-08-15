CREATE TABLE "agent_model_configurations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "encrypted_api_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "last_status" TEXT,
    "last_error" TEXT,
    "last_checked_at" TIMESTAMP(3),
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_model_configurations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_model_configurations_enabled_is_default_priority_idx"
ON "agent_model_configurations"("enabled", "is_default", "priority");

INSERT INTO "agent_model_configurations" (
    "id", "name", "model", "base_url", "encrypted_api_key", "enabled", "is_default", "priority", "created_at", "updated_at"
)
SELECT
    'legacy-default', '原默认模型', "model", "base_url", "encrypted_api_key", true, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "agent_configurations"
WHERE "id" = 'default';
