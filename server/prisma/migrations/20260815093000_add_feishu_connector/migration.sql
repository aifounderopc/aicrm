CREATE TABLE "integration_connections" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "encrypted_app_secret" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "last_error" TEXT,
    "last_connected_at" TIMESTAMP(3),
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_connections_provider_key" ON "integration_connections"("provider");

CREATE TABLE "feishu_messages" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "chat_name" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "sender_name" TEXT NOT NULL,
    "message_type" TEXT NOT NULL,
    "content_raw" TEXT NOT NULL,
    "content_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feishu_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feishu_messages_created_at_idx" ON "feishu_messages"("created_at");
CREATE INDEX "feishu_messages_chat_id_idx" ON "feishu_messages"("chat_id");
