CREATE TABLE "agent_configurations" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "provider" TEXT NOT NULL DEFAULT 'deepseek-harness',
    "model" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "encrypted_api_key" TEXT NOT NULL,
    "soul_prompt" TEXT NOT NULL,
    "business_prompt" TEXT NOT NULL,
    "response_prompt" TEXT NOT NULL,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_configurations_pkey" PRIMARY KEY ("id")
);
