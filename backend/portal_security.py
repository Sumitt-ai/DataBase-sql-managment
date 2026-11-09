"""Server-side sessions and role checks for the Client Portal and Admin API."""

import hashlib
import secrets
from datetime import datetime, timedelta

import pymysql
import pymysql.cursors
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.config import settings


SESSION_HOURS = 8
bearer_scheme = HTTPBearer(auto_error=False)


def _session_hash(token: str, role: str) -> str:
    return hashlib.sha256(f"{role}:{token}".encode("utf-8")).hexdigest()


def get_portal_connection():
    """Connect to the separate application schema on the configured MySQL server."""
    try:
        return pymysql.connect(
            host=settings.MYSQL_HOST,
            port=settings.MYSQL_PORT,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.CLIENT_METADATA_SCHEMA,
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
            connect_timeout=4,
            read_timeout=10,
            write_timeout=10,
            autocommit=False,
        )
    except pymysql.MySQLError as exc:
        raise HTTPException(status_code=503, detail="Client Portal database is unavailable.") from exc


def issue_session(username: str, role: str, client_id: int | None = None) -> str:
    token = secrets.token_urlsafe(32)
    token_hash = _session_hash(token, role)
    expires_at = datetime.utcnow() + timedelta(hours=SESSION_HOURS)
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO auth_sessions (session_hash, role, username, client_id, expires_at) "
                "VALUES (%s, %s, %s, %s, %s)",
                (token_hash, role, username, client_id, expires_at),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return token


def get_current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Sign in is required.")

    admin_hash = _session_hash(credentials.credentials, "admin")
    client_hash = _session_hash(credentials.credentials, "client")
    legacy_hash = hashlib.sha256(credentials.credentials.encode("utf-8")).hexdigest()
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT session_hash, role, username, client_id FROM auth_sessions "
                "WHERE session_hash IN (%s, %s, %s) AND revoked_at IS NULL "
                "AND expires_at > UTC_TIMESTAMP()",
                (admin_hash, client_hash, legacy_hash),
            )
            principal = cursor.fetchone()
            if principal and principal["role"] == "admin" and principal["session_hash"] != admin_hash:
                principal = None
            if principal and principal["role"] == "client":
                cursor.execute(
                    "SELECT c.is_active, r.client_id AS removed_client_id "
                    "FROM clients c LEFT JOIN client_access_removals r ON r.client_id = c.client_id "
                    "WHERE c.client_id = %s",
                    (principal["client_id"],),
                )
                client = cursor.fetchone()
                if not client or not client["is_active"] or client["removed_client_id"]:
                    principal = None
    except pymysql.MySQLError as exc:
        raise HTTPException(status_code=503, detail="Authentication service is unavailable.") from exc
    finally:
        conn.close()

    if not principal:
        raise HTTPException(status_code=401, detail="Session expired or revoked. Please sign in again.")
    return principal


def require_admin(principal: dict = Depends(get_current_principal)):
    if principal["role"] != "admin":
        raise HTTPException(status_code=403, detail="Administrator access is required.")
    return principal


def require_client(principal: dict = Depends(get_current_principal)):
    if principal["role"] != "client":
        raise HTTPException(status_code=403, detail="Client Portal access is required.")
    return principal


def revoke_session(principal: dict):
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() "
                "WHERE session_hash = %s AND revoked_at IS NULL",
                (principal["session_hash"],),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
