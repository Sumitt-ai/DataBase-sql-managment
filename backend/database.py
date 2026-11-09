import re
import os
import sqlite3
import datetime
import uuid
import pymysql
import pymysql.cursors
from backend.config import settings

# Lightweight SQLite database for persisting audit trail, user profiles, and requests
META_DB_PATH = os.path.join(os.path.dirname(__file__), "admin_meta.db")

def init_meta_db():
    """Initializes local administrative metadata storage for full names, requests, and audit logs."""
    conn = sqlite3.connect(META_DB_PATH)
    cursor = conn.cursor()
    
    # User Profile Metadata Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users_meta (
        username TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        assigned_database TEXT,
        permissions TEXT NOT NULL,
        can_create_db INTEGER DEFAULT 0,
        status TEXT DEFAULT 'Active',
        created_at TEXT NOT NULL
    )
    """)

    # Database Requests Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS database_requests (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        requested_db TEXT NOT NULL,
        purpose TEXT,
        permissions TEXT NOT NULL,
        request_date TEXT NOT NULL,
        status TEXT DEFAULT 'Pending',
        rejection_reason TEXT
    )
    """)

    # Activity Audit Log Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        performed_by TEXT NOT NULL,
        target TEXT NOT NULL,
        ip_address TEXT,
        details TEXT NOT NULL,
        status TEXT DEFAULT 'SUCCESS'
    )
    """)

    conn.commit()
    conn.close()

# Run initialization immediately
init_meta_db()


def get_mysql_connection():
    """Establishes connection to the target MySQL Server."""
    return pymysql.connect(
        host=settings.MYSQL_HOST,
        port=settings.MYSQL_PORT,
        user=settings.MYSQL_USER,
        password=settings.MYSQL_PASSWORD,
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=3
    )


def verify_mysql_user_credentials(username: str, password: str) -> None:
    """Open and close a connection using the supplied MySQL account."""
    conn = pymysql.connect(
        host=settings.MYSQL_HOST,
        port=settings.MYSQL_PORT,
        user=username,
        password=password,
        charset="utf8mb4",
        connect_timeout=4,
    )
    conn.close()


def has_global_admin_privileges(grants: list[str]) -> bool:
    """Return whether MySQL grants all privileges globally to an account."""
    all_static_privileges = {
        "ALTER",
        "ALTER ROUTINE",
        "CREATE",
        "CREATE ROLE",
        "CREATE ROUTINE",
        "CREATE TABLESPACE",
        "CREATE TEMPORARY TABLES",
        "CREATE USER",
        "CREATE VIEW",
        "DELETE",
        "DROP",
        "DROP ROLE",
        "EVENT",
        "EXECUTE",
        "FILE",
        "INDEX",
        "INSERT",
        "LOCK TABLES",
        "PROCESS",
        "REFERENCES",
        "RELOAD",
        "REPLICATION CLIENT",
        "REPLICATION SLAVE",
        "SELECT",
        "SHOW DATABASES",
        "SHOW VIEW",
        "SHUTDOWN",
        "SUPER",
        "TRIGGER",
        "UPDATE",
    }

    for grant in grants:
        match = re.match(r"^\s*GRANT\s+(.+?)\s+ON\s+\*\.\*\s+TO\b", grant, re.IGNORECASE)
        if not match:
            continue
        granted_privileges = {privilege.strip().upper() for privilege in match.group(1).split(",")}
        if granted_privileges.intersection({"ALL", "ALL PRIVILEGES"}):
            return True
        if all_static_privileges.issubset(granted_privileges):
            return True
    return False


def authenticate_mysql_admin(username: str, password: str) -> bool:
    """Authenticate a MySQL account and require all global privileges."""
    conn = pymysql.connect(
        host=settings.MYSQL_HOST,
        port=settings.MYSQL_PORT,
        user=username,
        password=password,
        charset="utf8mb4",
        connect_timeout=4,
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute("SHOW GRANTS")
            grants = [row[0] for row in cursor.fetchall()]
        return has_global_admin_privileges(grants)
    finally:
        conn.close()


def authenticate_mysql_user(username: str, password: str) -> bool:
    """Verifies credentials by attempting a live connection to MySQL Server."""
    try:
        verify_mysql_user_credentials(username, password)
        return True
    except Exception as e:
        print(f"MySQL auth attempt for '{username}' failed: {e}")
        return False


def test_mysql_connection():
    """Tests connection to MySQL Server and returns connection status details."""
    try:
        conn = get_mysql_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT VERSION() as version, DATABASE() as current_db;")
            row = cursor.fetchone()
            version = row['version'] if row else "8.0.46"
        conn.close()
        return {
            "connected": True,
            "version": f"MySQL {version} Community Server",
            "host": settings.MYSQL_HOST,
            "port": settings.MYSQL_PORT,
            "user": settings.MYSQL_USER,
            "message": "Connected to local MySQL Server successfully"
        }
    except Exception as e:
        return {
            "connected": False,
            "version": "MySQL 8.0.46 (Awaiting Password)",
            "host": settings.MYSQL_HOST,
            "port": settings.MYSQL_PORT,
            "user": settings.MYSQL_USER,
            "message": str(e)
        }


def log_activity(
    activity_type: str,
    target: str,
    details: str,
    status: str = "SUCCESS",
    ip: str = None,
    performed_by: str = "system",
):
    """Records administrative actions to the immutable audit log."""
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_id = f"act_{int(datetime.datetime.now().timestamp() * 1000)}"
    ip_addr = ip or settings.SERVER_IP

    conn = sqlite3.connect(META_DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO activity_logs (id, timestamp, activity_type, performed_by, target, ip_address, details, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (log_id, now_str, activity_type, performed_by, target, ip_addr, details, status)
    )
    conn.commit()
    conn.close()


def get_all_activities():
    """Fetches all administrative activity records formatted for frontend compatibility."""
    conn = sqlite3.connect(META_DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 200")
    rows = []
    for r in cursor.fetchall():
        d = dict(r)
        d["activityType"] = d.get("activity_type") or "General"
        d["performedBy"] = d.get("performed_by") or "admin"
        d["ipAddress"] = d.get("ip_address") or "127.0.0.1"
        d["target"] = d.get("target") or "System"
        d["details"] = d.get("details") or ""
        d["status"] = d.get("status") or "SUCCESS"
        rows.append(d)
    conn.close()
    return rows


def get_all_databases():
    """Fetches live databases from MySQL Server including sizes and table counts."""
    system_dbs = {'mysql', 'information_schema', 'performance_schema', 'sys'}
    
    # Fetch assigned users from metadata
    conn_meta = sqlite3.connect(META_DB_PATH)
    conn_meta.row_factory = sqlite3.Row
    cur_meta = conn_meta.cursor()
    cur_meta.execute("SELECT username, assigned_database, permissions FROM users_meta WHERE assigned_database IS NOT NULL")
    user_assignments = cur_meta.fetchall()
    conn_meta.close()

    db_assigned_map = {}
    for ua in user_assignments:
        db_name = ua['assigned_database']
        if db_name not in db_assigned_map:
            db_assigned_map[db_name] = []
        db_assigned_map[db_name].append(ua['username'])

    try:
        conn = get_mysql_connection()
        with conn.cursor() as cursor:
            # Query databases with charset and collation from information_schema
            query = """
            SELECT 
                schema_name AS name,
                default_character_set_name AS charset,
                default_collation_name AS collation
            FROM information_schema.SCHEMATA
            ORDER BY schema_name ASC;
            """
            cursor.execute(query)
            schemas = cursor.fetchall()

            # Query table counts and sizes in MB
            stats_query = """
            SELECT 
                table_schema AS name,
                COUNT(table_name) AS tables_count,
                ROUND(SUM(data_length + index_length) / (1024 * 1024), 2) AS size_mb
            FROM information_schema.TABLES
            GROUP BY table_schema;
            """
            cursor.execute(stats_query)
            stats_rows = {r['name']: r for r in cursor.fetchall()}

        conn.close()

        result = []
        for s in schemas:
            db_name = s['name']
            if db_name in system_dbs:
                continue # Skip system schemas from standard user console
            stat = stats_rows.get(db_name, {})
            result.append({
                "id": f"db_{db_name}",
                "name": db_name,
                "charset": s.get('charset', 'utf8mb4'),
                "collation": s.get('collation', 'utf8mb4_unicode_ci'),
                "tablesCount": stat.get('tables_count', 0),
                "sizeMb": float(stat.get('size_mb') or 0.1),
                "assignedUsers": db_assigned_map.get(db_name, []),
                "createdAt": "MySQL Server"
            })
        return result
    except Exception as e:
        print(f"Direct MySQL get_all_databases error: {e}")
        return []


def create_database_schema(
    name: str,
    charset: str = 'utf8mb4',
    collation: str = 'utf8mb4_unicode_ci',
    assigned_username: str = None,
    permission_level: str = 'READ & WRITE',
    allow_existing: bool = False,
    strict_permissions: bool = False
):
    """Creates a new database on the MySQL Server using safe identifier validation."""
    clean_name = name.strip().lower()
    if not re.match(r'^[a-zA-Z0-9_]+$', clean_name):
        raise ValueError("Invalid database name. Only alphanumeric characters and underscores are allowed.")

    try:
        conn = get_mysql_connection()
        with conn.cursor() as cursor:
            existence_clause = "IF NOT EXISTS " if allow_existing else ""
            cursor.execute(f"CREATE DATABASE {existence_clause}`{clean_name}` CHARACTER SET {charset} COLLATE {collation};")
        conn.commit()
        conn.close()
    except Exception as e:
        err_msg = e.args[1] if hasattr(e, 'args') and len(e.args) > 1 else str(e)
        raise ValueError(f"MySQL Error creating database: {err_msg}")

    if assigned_username:
        try:
            grant_permissions(assigned_username, clean_name, permission_level)
        except Exception as ge:
            if strict_permissions:
                raise
            print(f"Grant permissions warning (non-fatal): {ge}")

    log_activity("Database Created", clean_name, f"Created schema '{clean_name}' on MySQL Server")
    return {"name": clean_name, "charset": charset, "collation": collation}


def drop_database_schema(name: str):
    """Permanently drops a database from MySQL Server."""
    clean_name = name.strip().lower()
    if not re.match(r'^[a-zA-Z0-9_]+$', clean_name):
        raise ValueError("Invalid database name.")

    try:
        conn = get_mysql_connection()
        with conn.cursor() as cursor:
            cursor.execute(f"DROP DATABASE `{clean_name}`;")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Direct MySQL drop error: {e}")

    log_activity("Database Deleted", clean_name, f"Dropped database '{clean_name}' from MySQL Server")


def grant_permissions(username: str, database_name: str, permission_level: str, can_create_db: bool = False):
    """Applies granular MySQL privileges according to least-privilege security specifications."""
    clean_user = username.strip()
    clean_db = database_name.strip() if database_name else None

    try:
        conn = get_mysql_connection()
        with conn.cursor() as cursor:
            if clean_db:
                if permission_level == "READ ONLY":
                    cursor.execute(f"GRANT SELECT ON `{clean_db}`.* TO %s@'%%';", (clean_user,))
                elif permission_level == "WRITE ONLY":
                    cursor.execute(f"GRANT INSERT, UPDATE, DELETE ON `{clean_db}`.* TO %s@'%%';", (clean_user,))
                else: # READ & WRITE
                    cursor.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON `{clean_db}`.* TO %s@'%%';", (clean_user,))

                if can_create_db:
                    # Confined strictly to their assigned database schema - NEVER global *.*
                    cursor.execute(f"GRANT CREATE, ALTER, DROP ON `{clean_db}`.* TO %s@'%%';", (clean_user,))

            # New users NEVER receive CREATE USER, GRANT OPTION, or global administrative privileges
            cursor.execute("FLUSH PRIVILEGES;")
        conn.commit()
        conn.close()
    except Exception as e:
        err_msg = e.args[1] if hasattr(e, 'args') and len(e.args) > 1 else str(e)
        print(f"Direct MySQL grant error: {err_msg}")
        raise ValueError(f"MySQL grant error: {err_msg}")


def get_all_users():
    """Queries real user accounts directly from MySQL Server and joins with metadata."""
    mysql_users = []
    system_users = {'root', 'mysql.session', 'mysql.sys', 'mysql.infoschema'}
    try:
        conn = get_mysql_connection()
        with conn.cursor() as cursor:
            try:
                cursor.execute("SELECT user, host, account_locked FROM mysql.user WHERE user NOT IN ('root', 'mysql.session', 'mysql.sys', 'mysql.infoschema');")
                mysql_users = cursor.fetchall()
            except Exception:
                # If mysql.user table is restricted, read from information_schema.USER_PRIVILEGES
                cursor.execute("SELECT DISTINCT GRANTEE FROM information_schema.USER_PRIVILEGES;")
                grantees = cursor.fetchall()
                seen = set()
                for g in grantees:
                    grantee_str = g.get('GRANTEE') or list(g.values())[0]
                    m = re.match(r"'([^']+)'@'([^']+)'", grantee_str)
                    if m:
                        u, h = m.group(1), m.group(2)
                        if u not in system_users and u not in seen:
                            seen.add(u)
                            mysql_users.append({'user': u, 'host': h, 'account_locked': 'N'})
        conn.close()
    except Exception as e:
        print(f"Direct MySQL user query error: {e}")

    # Get metadata for names, permissions, and database assignments
    conn_meta = sqlite3.connect(META_DB_PATH)
    conn_meta.row_factory = sqlite3.Row
    cur_meta = conn_meta.cursor()
    cur_meta.execute("SELECT * FROM users_meta")
    meta_rows = {r['username']: dict(r) for r in cur_meta.fetchall()}
    conn_meta.close()

    result = []
    # ONLY list users that actually exist in the MySQL Server
    for m in mysql_users:
        u = m['user']
        meta = meta_rows.get(u, {})
        status = "Inactive" if m.get('account_locked') == 'Y' else meta.get('status', 'Active')

        result.append({
            "id": f"usr_{u}",
            "fullName": meta.get('full_name', u.capitalize()),
            "username": u,
            "assignedDatabase": meta.get('assigned_database') or "company_db",
            "permissions": meta.get('permissions', 'READ & WRITE'),
            "canCreateDb": bool(meta.get('can_create_db', 0)),
            "status": status,
            "createdAt": meta.get('created_at', "MySQL Server")
        })
    return result


def create_user_account(full_name: str, username: str, password: str, assigned_db: str = None, permissions: str = "READ & WRITE", can_create_db: bool = False):
    """Provisions a new MySQL user account on the server and stores metadata."""
    clean_user = username.strip().lower()
    if not re.match(r'^[a-z0-9_]+$', clean_user):
        raise ValueError("Username can only contain lowercase letters, numbers, and underscores.")

    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 1. Execute CREATE USER in MySQL
    try:
        conn = get_mysql_connection()
        with conn.cursor() as cursor:
            # Create standard database user without any administrative privileges
            cursor.execute("CREATE USER %s@'%%' IDENTIFIED BY %s;", (clean_user, password))
            if assigned_db:
                if permissions == "READ ONLY":
                    cursor.execute(f"GRANT SELECT ON `{assigned_db}`.* TO %s@'%%';", (clean_user,))
                elif permissions == "WRITE ONLY":
                    cursor.execute(f"GRANT INSERT, UPDATE, DELETE ON `{assigned_db}`.* TO %s@'%%';", (clean_user,))
                else:
                    cursor.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON `{assigned_db}`.* TO %s@'%%';", (clean_user,))

                if can_create_db:
                    # Confined strictly to their assigned database schema
                    cursor.execute(f"GRANT CREATE, ALTER, DROP ON `{assigned_db}`.* TO %s@'%%';", (clean_user,))

            # New users will NEVER have CREATE USER, GRANT OPTION, or admin rights
            cursor.execute("FLUSH PRIVILEGES;")
        conn.commit()
        conn.close()
    except Exception as e:
        err_msg = e.args[1] if hasattr(e, 'args') and len(e.args) > 1 else str(e)
        print(f"Direct MySQL create user error: {err_msg}")
        raise ValueError(f"MySQL Error: {err_msg}")

    # 2. Persist metadata
    conn_meta = sqlite3.connect(META_DB_PATH)
    cur = conn_meta.cursor()
    cur.execute(
        "INSERT OR REPLACE INTO users_meta (username, full_name, assigned_database, permissions, can_create_db, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (clean_user, full_name, assigned_db, permissions, 1 if can_create_db else 0, 'Active', now_str)
    )
    conn_meta.commit()
    conn_meta.close()

    log_activity("User Created", clean_user, f"Provisioned user '@{clean_user}' ({full_name}) with {permissions} privileges")
    return {"username": clean_user, "fullName": full_name, "assignedDatabase": assigned_db, "permissions": permissions}


def update_user_account(username: str, full_name: str = None, password: str = None, assigned_db: str = None, permissions: str = None, can_create_db: bool = None, status: str = None):
    """Updates user attributes, password, or permissions in MySQL and metadata."""
    clean_user = username.strip().lower()

    try:
        conn = get_mysql_connection()
        with conn.cursor() as cursor:
            if password:
                cursor.execute("ALTER USER %s@'%%' IDENTIFIED BY %s;", (clean_user, password))
            if status:
                if status == "Inactive":
                    cursor.execute("ALTER USER %s@'%%' ACCOUNT LOCK;", (clean_user,))
                else:
                    cursor.execute("ALTER USER %s@'%%' ACCOUNT UNLOCK;", (clean_user,))
            cursor.execute("FLUSH PRIVILEGES;")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Direct MySQL alter user note: {e}")

    # Update privileges if database or permissions changed
    if assigned_db or permissions:
        try:
            grant_permissions(clean_user, assigned_db, permissions or "READ & WRITE", can_create_db or False)
        except Exception:
            pass

    # Update metadata
    conn_meta = sqlite3.connect(META_DB_PATH)
    cur = conn_meta.cursor()
    cur.execute(
        """
        UPDATE users_meta 
        SET full_name = COALESCE(?, full_name),
            assigned_database = ?,
            permissions = COALESCE(?, permissions),
            can_create_db = COALESCE(?, can_create_db),
            status = COALESCE(?, status)
        WHERE username = ?
        """,
        (full_name, assigned_db, permissions, 1 if can_create_db else 0 if can_create_db is not None else None, status, clean_user)
    )
    conn_meta.commit()
    conn_meta.close()

    log_activity("User Updated", clean_user, f"Updated configuration for user '@{clean_user}'")


def delete_user_account(username: str, mode: str):
    """
    Executes Section 10 deletion workflow:
    - Mode 'ACCOUNT_ONLY': Revokes privileges, drops user, preserves database.
    - Mode 'ACCOUNT_AND_DATABASE': Drops user, drops assigned database.
    """
    clean_user = username.strip().lower()

    conn_meta = sqlite3.connect(META_DB_PATH)
    cur = conn_meta.cursor()
    cur.execute("SELECT assigned_database FROM users_meta WHERE username = ?", (clean_user,))
    row = cur.fetchone()
    assigned_db = row[0] if row else None
    conn_meta.close()

    try:
        conn = get_mysql_connection()
        with conn.cursor() as cursor:
            cursor.execute("REVOKE ALL PRIVILEGES, GRANT OPTION FROM %s@'%%';", (clean_user,))
            cursor.execute("DROP USER %s@'%%';", (clean_user,))
            if mode == "ACCOUNT_AND_DATABASE" and assigned_db:
                cursor.execute(f"DROP DATABASE `{assigned_db}`;")
            cursor.execute("FLUSH PRIVILEGES;")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Direct MySQL drop user note: {e}")

    conn_meta = sqlite3.connect(META_DB_PATH)
    cur = conn_meta.cursor()
    cur.execute("DELETE FROM users_meta WHERE username = ?", (clean_user,))
    conn_meta.commit()
    conn_meta.close()

    if mode == "ACCOUNT_AND_DATABASE":
        log_activity("User Deleted", clean_user, f"Option B: Deleted user '@{clean_user}' and dropped database '{assigned_db}'")
    else:
        log_activity("User Deleted", clean_user, f"Option A: Deleted user '@{clean_user}' (database '{assigned_db}' preserved)")


def get_all_requests():
    """Fetches all database creation requests with frontend-compatible camelCase keys."""
    conn = sqlite3.connect(META_DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM database_requests ORDER BY request_date DESC")
    rows = []
    for r in cursor.fetchall():
        d = dict(r)
        req_db = d.get("requested_db") or ""
        d["requestedDatabaseName"] = req_db
        d["requestedDb"] = req_db
        d["requestDate"] = d.get("request_date") or ""
        d["permissionRequested"] = d.get("permissions") or "READ & WRITE"
        d["rejectionReason"] = d.get("rejection_reason")
        rows.append(d)
    conn.close()
    return rows


def add_database_request(username: str, requested_db: str, purpose: str, permissions: str = "READ & WRITE"):
    """Creates a new database creation request."""
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    req_id = f"REQ-{datetime.datetime.now().year}-{uuid.uuid4().hex[:8].upper()}"

    conn = sqlite3.connect(META_DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO database_requests (id, username, requested_db, purpose, permissions, request_date, status) VALUES (?, ?, ?, ?, ?, ?, 'Pending')",
        (req_id, username, requested_db, purpose, permissions, now_str)
    )
    conn.commit()
    conn.close()

    log_activity("Database Request Created", req_id, f"Submitted request for database '{requested_db}' for user '@{username}'")
    return req_id


def resolve_database_request(request_id: str, action: str, reason: str = None):
    """Approves or rejects a database creation request."""
    conn = sqlite3.connect(META_DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM database_requests WHERE id = ?", (request_id,))
    req = cur.fetchone()

    if not req:
        conn.close()
        raise ValueError(f"Request {request_id} not found.")

    if req['status'] != 'Pending':
        conn.close()
        raise ValueError(f"Request {request_id} is already {req['status'].lower()}.")

    if action == "approve":
        create_database_schema(
            req['requested_db'],
            assigned_username=req['username'],
            permission_level=req['permissions'] or 'READ & WRITE',
            allow_existing=True,
            strict_permissions=True
        )
        cur.execute("UPDATE database_requests SET status = 'Approved' WHERE id = ?", (request_id,))
        cur.execute(
            "UPDATE users_meta SET assigned_database = ?, permissions = ? WHERE username = ?",
            (req['requested_db'], req['permissions'] or 'READ & WRITE', req['username'])
        )
        log_activity("Database Request Approved", req['requested_db'], f"Approved request {request_id} and created database for @{req['username']}")
    else:
        cur.execute("UPDATE database_requests SET status = 'Rejected', rejection_reason = ? WHERE id = ?", (reason, request_id))
        log_activity("Database Request Rejected", req['requested_db'], f"Rejected request {request_id}. Reason: {reason}")

    conn.commit()
    conn.close()
