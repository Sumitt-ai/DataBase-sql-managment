-- Run in MySQL Workbench as an administrator.
-- Set the account and host that match the backend's MySQL connection.
-- This script grants privileges to an existing account; it does not create
-- an account or embed a password in the repository.

SET @admin_user = 'replace_with_mysql_username';
SET @admin_host = 'localhost';

SET @grant_sql = CONCAT(
  'GRANT ALL PRIVILEGES ON *.* TO ',
  QUOTE(@admin_user), '@', QUOTE(@admin_host),
  ' WITH GRANT OPTION'
);
PREPARE grant_admin FROM @grant_sql;
EXECUTE grant_admin;
DEALLOCATE PREPARE grant_admin;

FLUSH PRIVILEGES;

SET @show_grants_sql = CONCAT(
  'SHOW GRANTS FOR ', QUOTE(@admin_user), '@', QUOTE(@admin_host)
);
PREPARE show_admin_grants FROM @show_grants_sql;
EXECUTE show_admin_grants;
DEALLOCATE PREPARE show_admin_grants;
