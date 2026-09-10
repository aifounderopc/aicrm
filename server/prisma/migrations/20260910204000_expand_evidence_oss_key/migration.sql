-- Legacy demo data may store evidence files as inline Base64 payloads.
ALTER TABLE `evidence_files`
  MODIFY `oss_key` LONGTEXT NOT NULL;
