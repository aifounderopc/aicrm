-- User-facing enterprise tenant ID. Internal string keys remain unchanged for relationship compatibility.
ALTER TABLE `tenants` ADD COLUMN `tenant_no` INTEGER NULL;

SET @tenant_no := 100000;
UPDATE `tenants`
SET `tenant_no` = (@tenant_no := @tenant_no + 1)
ORDER BY `created_at`, `id`;

ALTER TABLE `tenants`
  MODIFY `tenant_no` INTEGER NOT NULL AUTO_INCREMENT,
  ADD UNIQUE INDEX `tenants_tenant_no_key`(`tenant_no`);

ALTER TABLE `tenants` AUTO_INCREMENT = 100001;
