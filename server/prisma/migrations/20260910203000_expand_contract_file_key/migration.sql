-- Historical records may contain an inline Base64 contract attachment.
ALTER TABLE `opportunities`
  MODIFY `contract_file_key` LONGTEXT NULL;
