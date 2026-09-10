-- CreateTable
CREATE TABLE `tenants` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tenants_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `role` ENUM('admin', 'channel_admin', 'sales_admin', 'sales', 'channel') NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL DEFAULT 'tenant_joymarketing',
    `is_platform_admin` BOOLEAN NOT NULL DEFAULT false,
    `channel_id` VARCHAR(191) NULL,
    `is_jd_manager` BOOLEAN NOT NULL DEFAULT false,
    `group_name` VARCHAR(191) NULL,
    `disabled` BOOLEAN NOT NULL DEFAULT false,
    `must_change_pwd` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_role_idx`(`role`),
    INDEX `users_tenant_id_idx`(`tenant_id`),
    INDEX `users_channel_id_idx`(`channel_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `channels` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `full_name` VARCHAR(191) NULL,
    `contact_name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `jd_manager_name` VARCHAR(191) NULL,
    `status` ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
    `tenant_id` VARCHAR(191) NOT NULL DEFAULT 'tenant_joymarketing',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `channels_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `opportunities` (
    `id` VARCHAR(191) NOT NULL,
    `customer_name` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL DEFAULT 'tenant_joymarketing',
    `customer_name_norm` VARCHAR(191) NOT NULL,
    `company_name` VARCHAR(191) NULL,
    `industry` VARCHAR(191) NOT NULL,
    `product_interests` JSON NOT NULL,
    `source` ENUM('direct', 'channel') NOT NULL,
    `channel_id` VARCHAR(191) NULL,
    `channel_name` VARCHAR(191) NULL,
    `channel_manager_name` VARCHAR(191) NULL,
    `sa_owner_id` VARCHAR(191) NOT NULL,
    `sa_owner_name` VARCHAR(191) NOT NULL,
    `sales_owner_id` VARCHAR(191) NOT NULL,
    `sales_owner_name` VARCHAR(191) NOT NULL,
    `stage` ENUM('reporting', 'contacting', 'proposal', 'negotiation', 'signing', 'delivery', 'signed', 'closed', 'released') NOT NULL DEFAULT 'reporting',
    `reported_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `release_at` DATETIME(3) NOT NULL,
    `locked_permanently` BOOLEAN NOT NULL DEFAULT false,
    `amount_range` VARCHAR(191) NOT NULL,
    `first_contact_date` DATETIME(3) NULL,
    `requirement_description` TEXT NOT NULL,
    `contract_no` VARCHAR(191) NULL,
    `signed_date` DATETIME(3) NULL,
    `signed_amount` DOUBLE NULL,
    `contract_file_key` VARCHAR(191) NULL,
    `is_frozen` BOOLEAN NOT NULL DEFAULT false,
    `frozen_reason` VARCHAR(191) NULL,
    `release_reason` VARCHAR(191) NULL,
    `released_by` VARCHAR(191) NULL,
    `released_at` DATETIME(3) NULL,
    `is_subsidiary` BOOLEAN NOT NULL DEFAULT false,
    `parent_company_name` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `opportunities_customer_name_norm_industry_idx`(`customer_name_norm`, `industry`),
    INDEX `opportunities_tenant_id_idx`(`tenant_id`),
    INDEX `opportunities_sales_owner_id_idx`(`sales_owner_id`),
    INDEX `opportunities_stage_idx`(`stage`),
    INDEX `opportunities_release_at_idx`(`release_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `opportunity_inspection_bindings` (
    `id` VARCHAR(191) NOT NULL,
    `opportunity_id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL DEFAULT 'tenant_joymarketing',
    `channel` VARCHAR(191) NOT NULL,
    `source_group_id` VARCHAR(191) NULL,
    `group_id` VARCHAR(191) NOT NULL,
    `group_name` VARCHAR(191) NOT NULL,
    `encrypted_secret` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `updated_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `opportunity_inspection_bindings_tenant_id_idx`(`tenant_id`),
    INDEX `opportunity_inspection_bindings_opportunity_id_idx`(`opportunity_id`),
    UNIQUE INDEX `opportunity_inspection_bindings_tenant_id_channel_group_id_key`(`tenant_id`, `channel`, `group_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `opportunity_contacts` (
    `opportunity_id` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `contact_types` JSON NOT NULL,
    `enc_name` TEXT NULL,
    `enc_contact` TEXT NULL,
    `phone_hash` VARCHAR(191) NULL,

    PRIMARY KEY (`opportunity_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `evidence_files` (
    `id` VARCHAR(191) NOT NULL,
    `opportunity_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `oss_key` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `reject_reason` VARCHAR(191) NULL,
    `uploaded_by` VARCHAR(191) NOT NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `progress_reports` (
    `id` VARCHAR(191) NOT NULL,
    `opportunity_id` VARCHAR(191) NOT NULL,
    `reporter_id` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `last_contact_date` DATETIME(3) NOT NULL,
    `description` TEXT NOT NULL,
    `estimated_sign_date` DATETIME(3) NULL,
    `needs_support` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `renewal_requests` (
    `id` VARCHAR(191) NOT NULL,
    `opportunity_id` VARCHAR(191) NOT NULL,
    `requester_id` VARCHAR(191) NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `reason` VARCHAR(191) NULL,
    `rejection_reason` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,
    `processed_by` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `opportunity_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_read_idx`(`user_id`, `read`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operation_logs` (
    `id` VARCHAR(191) NOT NULL,
    `actor_id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL DEFAULT 'tenant_joymarketing',
    `actor_name` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `detail` TEXT NOT NULL,
    `target_type` VARCHAR(191) NULL,
    `target_id` VARCHAR(191) NULL,
    `ip` VARCHAR(191) NOT NULL,
    `user_agent` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `operation_logs_actor_id_idx`(`actor_id`),
    INDEX `operation_logs_tenant_id_idx`(`tenant_id`),
    INDEX `operation_logs_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `integration_connections` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL DEFAULT 'tenant_joymarketing',
    `app_id` VARCHAR(191) NOT NULL,
    `encrypted_app_secret` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'disconnected',
    `last_error` VARCHAR(191) NULL,
    `last_connected_at` DATETIME(3) NULL,
    `updated_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `integration_connections_tenant_id_idx`(`tenant_id`),
    UNIQUE INDEX `integration_connections_tenant_id_provider_key`(`tenant_id`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feishu_messages` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL DEFAULT 'tenant_joymarketing',
    `chat_id` VARCHAR(191) NOT NULL,
    `chat_name` VARCHAR(191) NOT NULL,
    `sender_id` VARCHAR(191) NOT NULL,
    `sender_name` VARCHAR(191) NOT NULL,
    `message_type` VARCHAR(191) NOT NULL,
    `content_raw` LONGTEXT NOT NULL,
    `content_text` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `feishu_messages_created_at_idx`(`created_at`),
    INDEX `feishu_messages_tenant_id_idx`(`tenant_id`),
    INDEX `feishu_messages_chat_id_idx`(`chat_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_signals` (
    `id` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'feishu',
    `source_message_id` VARCHAR(191) NOT NULL,
    `opportunity_id` VARCHAR(191) NULL,
    `signal_type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `confidence` DOUBLE NOT NULL DEFAULT 0,
    `extracted_data` JSON NOT NULL,
    `processing_source` VARCHAR(191) NOT NULL DEFAULT 'rules',
    `processing_version` INTEGER NOT NULL DEFAULT 1,
    `opportunity_updated` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sales_signals_source_message_id_key`(`source_message_id`),
    INDEX `sales_signals_created_at_idx`(`created_at`),
    INDEX `sales_signals_opportunity_id_idx`(`opportunity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agent_configurations` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL DEFAULT 'tenant_joymarketing',
    `provider` VARCHAR(191) NOT NULL DEFAULT 'deepseek-harness',
    `model` VARCHAR(191) NOT NULL,
    `base_url` VARCHAR(191) NOT NULL,
    `encrypted_api_key` TEXT NOT NULL,
    `soul_prompt` TEXT NOT NULL,
    `business_prompt` TEXT NOT NULL,
    `response_prompt` TEXT NOT NULL,
    `updated_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `agent_configurations_tenant_id_key`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agent_model_configurations` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL DEFAULT 'tenant_joymarketing',
    `model` VARCHAR(191) NOT NULL,
    `base_url` VARCHAR(191) NOT NULL,
    `encrypted_api_key` TEXT NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `last_status` VARCHAR(191) NULL,
    `last_error` VARCHAR(191) NULL,
    `last_checked_at` DATETIME(3) NULL,
    `updated_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `agent_model_configurations_enabled_is_default_priority_idx`(`enabled`, `is_default`, `priority`),
    INDEX `agent_model_configurations_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `channels` ADD CONSTRAINT `channels_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opportunities` ADD CONSTRAINT `opportunities_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opportunities` ADD CONSTRAINT `opportunities_channel_id_fkey` FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opportunities` ADD CONSTRAINT `opportunities_sales_owner_id_fkey` FOREIGN KEY (`sales_owner_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opportunity_inspection_bindings` ADD CONSTRAINT `opportunity_inspection_bindings_opportunity_id_fkey` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opportunity_inspection_bindings` ADD CONSTRAINT `opportunity_inspection_bindings_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opportunity_contacts` ADD CONSTRAINT `opportunity_contacts_opportunity_id_fkey` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evidence_files` ADD CONSTRAINT `evidence_files_opportunity_id_fkey` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `progress_reports` ADD CONSTRAINT `progress_reports_opportunity_id_fkey` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `renewal_requests` ADD CONSTRAINT `renewal_requests_opportunity_id_fkey` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operation_logs` ADD CONSTRAINT `operation_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operation_logs` ADD CONSTRAINT `operation_logs_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `integration_connections` ADD CONSTRAINT `integration_connections_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feishu_messages` ADD CONSTRAINT `feishu_messages_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_signals` ADD CONSTRAINT `sales_signals_source_message_id_fkey` FOREIGN KEY (`source_message_id`) REFERENCES `feishu_messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_signals` ADD CONSTRAINT `sales_signals_opportunity_id_fkey` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_configurations` ADD CONSTRAINT `agent_configurations_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_model_configurations` ADD CONSTRAINT `agent_model_configurations_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
