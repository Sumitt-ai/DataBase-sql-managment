-- Client Portal metadata schema for MySQL Admin Console.
-- Additive and idempotent: it creates only the new schema and its tables.
-- Excel workbook contents remain in the configured server-side file store.
-- MySQL validates portal client passwords; password_hash is retained only for old rows and compatibility.

CREATE DATABASE IF NOT EXISTS mysql_admin_portal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mysql_admin_portal.clients (
  client_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  client_name VARCHAR(160) NOT NULL,
  password_hash VARCHAR(255) NULL DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  password_changed_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (client_id),
  UNIQUE KEY uq_clients_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Existing portal credentials are no longer used. Client sign-in is verified by MySQL itself.
ALTER TABLE mysql_admin_portal.clients
  MODIFY COLUMN password_hash VARCHAR(255) NULL DEFAULT NULL;

CREATE TABLE IF NOT EXISTS mysql_admin_portal.client_permissions (
  client_id BIGINT UNSIGNED NOT NULL,
  permission_key ENUM('upload', 'edit', 'download', 'recycle', 'restore') NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, permission_key),
  CONSTRAINT fk_client_permissions_client
    FOREIGN KEY (client_id) REFERENCES mysql_admin_portal.clients (client_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mysql_admin_portal.auth_sessions (
  session_hash CHAR(64) NOT NULL,
  role ENUM('admin', 'client') NOT NULL,
  username VARCHAR(64) NOT NULL,
  client_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (session_hash),
  KEY ix_auth_sessions_username (username),
  KEY ix_auth_sessions_expiry (expires_at),
  CONSTRAINT fk_auth_sessions_client
    FOREIGN KEY (client_id) REFERENCES mysql_admin_portal.clients (client_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mysql_admin_portal.client_files (
  file_id CHAR(36) NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_extension VARCHAR(12) NOT NULL,
  content_type VARCHAR(127) NULL,
  storage_key VARCHAR(512) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  current_version INT UNSIGNED NOT NULL DEFAULT 1,
  file_state ENUM('active', 'recycled') NOT NULL DEFAULT 'active',
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (file_id),
  UNIQUE KEY uq_client_files_storage_key (storage_key),
  KEY ix_client_files_owner_state (client_id, file_state, updated_at),
  CONSTRAINT fk_client_files_client
    FOREIGN KEY (client_id) REFERENCES mysql_admin_portal.clients (client_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mysql_admin_portal.client_file_versions (
  file_id CHAR(36) NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  storage_key VARCHAR(512) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  created_by_username VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (file_id, version_number),
  UNIQUE KEY uq_client_file_versions_storage_key (storage_key),
  CONSTRAINT fk_client_file_versions_file
    FOREIGN KEY (file_id) REFERENCES mysql_admin_portal.client_files (file_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mysql_admin_portal.client_activity (
  activity_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_role ENUM('admin', 'client') NOT NULL,
  actor_username VARCHAR(64) NOT NULL,
  client_id BIGINT UNSIGNED NULL,
  action VARCHAR(64) NOT NULL,
  file_id CHAR(36) NULL,
  details JSON NULL,
  client_ip VARCHAR(45) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (activity_id),
  KEY ix_client_activity_client_time (client_id, created_at),
  KEY ix_client_activity_actor_time (actor_username, created_at),
  CONSTRAINT fk_client_activity_client
    FOREIGN KEY (client_id) REFERENCES mysql_admin_portal.clients (client_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
