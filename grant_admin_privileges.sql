-- Run in MySQL Workbench as a MySQL administrator.
-- Choose an existing MySQL account. Admin Console access is then granted
-- dynamically to any account with ALL PRIVILEGES ON *.*.
-- This script does not create an account or store its password.

SET @admin_user = 'replace_with_mysql_username';
SET @admin_host = '%';

SET @grant_sql = CONCAT(
  'GRANT CREATE USER, RELOAD, PROCESS, SHOW DATABASES ON *.* TO ',
  QUOTE(@admin_user), '@', QUOTE(@admin_host), ' WITH GRANT OPTION'
);
PREPARE grant_admin_extras FROM @grant_sql;
EXECUTE grant_admin_extras;
DEALLOCATE PREPARE grant_admin_extras;

SET @grant_sql = CONCAT(
  'GRANT ALL PRIVILEGES ON *.* TO ',
  QUOTE(@admin_user), '@', QUOTE(@admin_host), ' WITH GRANT OPTION'
);
PREPARE grant_admin_all FROM @grant_sql;
EXECUTE grant_admin_all;
DEALLOCATE PREPARE grant_admin_all;

FLUSH PRIVILEGES;

SET @show_grants_sql = CONCAT(
  'SHOW GRANTS FOR ', QUOTE(@admin_user), '@', QUOTE(@admin_host)
);
PREPARE show_admin_grants FROM @show_grants_sql;
EXECUTE show_admin_grants;
DEALLOCATE PREPARE show_admin_grants;
