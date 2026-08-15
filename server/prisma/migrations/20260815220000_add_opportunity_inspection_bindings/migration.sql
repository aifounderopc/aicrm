CREATE TABLE "opportunity_inspection_bindings" (
    "id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "source_group_id" TEXT,
    "group_id" TEXT NOT NULL,
    "group_name" TEXT NOT NULL,
    "encrypted_secret" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_inspection_bindings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "opportunity_inspection_bindings_channel_group_id_key"
ON "opportunity_inspection_bindings"("channel", "group_id");

CREATE INDEX "opportunity_inspection_bindings_opportunity_id_idx"
ON "opportunity_inspection_bindings"("opportunity_id");

ALTER TABLE "opportunity_inspection_bindings"
ADD CONSTRAINT "opportunity_inspection_bindings_opportunity_id_fkey"
FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
