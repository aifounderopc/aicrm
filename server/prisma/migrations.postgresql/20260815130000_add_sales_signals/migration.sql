-- CreateTable
CREATE TABLE "sales_signals" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'feishu',
    "source_message_id" TEXT NOT NULL,
    "opportunity_id" TEXT,
    "signal_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "extracted_data" JSONB NOT NULL,
    "processing_source" TEXT NOT NULL DEFAULT 'rules',
    "opportunity_updated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_signals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_signals_source_message_id_key" ON "sales_signals"("source_message_id");
CREATE INDEX "sales_signals_created_at_idx" ON "sales_signals"("created_at");
CREATE INDEX "sales_signals_opportunity_id_idx" ON "sales_signals"("opportunity_id");

ALTER TABLE "sales_signals" ADD CONSTRAINT "sales_signals_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "feishu_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_signals" ADD CONSTRAINT "sales_signals_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
