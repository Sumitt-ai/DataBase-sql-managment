"""Admin-managed application client accounts and client oversight endpoints."""

import re

import pymysql
from fastapi import APIRouter, Depends, HTTPException, Request

import backend.database as db
from backend.config import settings
from backend.models import (
    ClientCreateRequest,
    ClientPermissionsRequest,
    ClientStatusRequest,
)
from backend.portal_api_common import client_permissions, file_json, file_response, get_file, log_portal_activity
from backend.portal_security import get_portal_connection, require_admin


router = APIRouter(prefix="/api/admin/clients")
USERNAME_RE = re.compile(r"^[a-z0-9_]{3,32}$")


@router.get("")
def list_clients(principal: dict = Depends(require_admin)):
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT c.client_id, c.username, c.client_name, c.is_active, c.created_at, "
                "COUNT(f.file_id) AS file_count, COALESCE(SUM(f.size_bytes), 0) AS storage_bytes "
                "FROM clients c LEFT JOIN client_files f ON f.client_id = c.client_id "
                "GROUP BY c.client_id ORDER BY c.created_at DESC"
            )
            clients = cursor.fetchall()
            return [
                {
                    "clientId": client["client_id"],
                    "username": client["username"],
                    "clientName": client["client_name"],
                    "isActive": bool(client["is_active"]),
                    "createdAt": client["created_at"],
                    "fileCount": client["file_count"],
                    "storageBytes": client["storage_bytes"],
                    "permissions": client_permissions(cursor, client["client_id"]),
                }
                for client in clients
            ]
    finally:
        conn.close()


@router.post("", status_code=201)
def create_client(body: ClientCreateRequest, request: Request, principal: dict = Depends(require_admin)):
    username = body.username.strip().lower()
    client_name = body.clientName.strip()
    if not USERNAME_RE.fullmatch(username):
        raise HTTPException(status_code=422, detail="Username must contain 3-32 lowercase letters, numbers, or underscores.")
    if not client_name:
        raise HTTPException(status_code=422, detail="Client name cannot be empty.")
    reserved_admin_names = {settings.MYSQL_USER.strip().lower()} if settings.MYSQL_USER else set()
    if username in reserved_admin_names:
        raise HTTPException(status_code=409, detail="Client username cannot match the configured administrator.")

    mysql_status = db.test_mysql_connection()
    if not mysql_status.get("connected"):
        raise HTTPException(status_code=503, detail="MySQL is unavailable; the Client Portal account cannot be verified.")
    mysql_accounts = db.get_all_users()
    if not any(account["username"].lower() == username and account["status"] == "Active" for account in mysql_accounts):
        raise HTTPException(status_code=422, detail="Create and activate this MySQL account in User Management before enabling Client Portal access.")

    permissions = sorted(set(body.permissions))
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT client_id, client_name, is_active FROM clients WHERE username = %s FOR UPDATE", (username,))
            existing = cursor.fetchone()
            if existing:
                client_id = existing["client_id"]
                client_name = existing["client_name"]
                reactivated = not bool(existing["is_active"])
                if reactivated:
                    cursor.execute("UPDATE clients SET is_active = 1 WHERE client_id = %s", (client_id,))
                    log_portal_activity(
                        cursor, "admin", principal["username"], client_id, "client_activated",
                        details={"username": username}, ip=request.client.host if request.client else None,
                    )
                granted_permissions = client_permissions(cursor, client_id)
            else:
                cursor.execute(
                    "INSERT INTO clients (username, client_name, password_hash) VALUES (%s, %s, NULL)",
                    (username, client_name),
                )
                client_id = cursor.lastrowid
                for permission in permissions:
                    cursor.execute(
                        "INSERT INTO client_permissions (client_id, permission_key, granted) VALUES (%s, %s, 1)",
                        (client_id, permission),
                    )
                granted_permissions = permissions
                log_portal_activity(
                    cursor, "admin", principal["username"], client_id, "client_created",
                    details={"username": username}, ip=request.client.host if request.client else None,
                )
        conn.commit()
        return {
            "success": True,
            "created": existing is None,
            "reactivated": bool(existing and reactivated),
            "client": {
                "clientId": client_id,
                "username": username,
                "clientName": client_name,
                "isActive": True,
                "permissions": granted_permissions,
            },
        }
    except pymysql.IntegrityError as exc:
        conn.rollback()
        error_code = exc.args[0] if exc.args else None
        if error_code == 1062:
            detail = "Client Portal access was created at the same time. Refresh the Client Management list."
        elif error_code == 1048:
            detail = "The Client Portal schema is outdated. Run backend/client_portal_schema.sql, then retry."
        else:
            detail = f"MySQL rejected the Client Portal record (error {error_code})."
        raise HTTPException(status_code=409 if error_code == 1062 else 500, detail=detail) from exc
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@router.patch("/{client_id}/status")
def set_client_status(client_id: int, body: ClientStatusRequest, request: Request, principal: dict = Depends(require_admin)):
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("UPDATE clients SET is_active = %s WHERE client_id = %s", (body.isActive, client_id))
            if cursor.rowcount == 0:
                cursor.execute("SELECT client_id FROM clients WHERE client_id = %s", (client_id,))
                if not cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Client account not found.")
            if not body.isActive:
                cursor.execute(
                    "UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE client_id = %s AND revoked_at IS NULL",
                    (client_id,),
                )
            log_portal_activity(
                cursor, "admin", principal["username"], client_id,
                "client_activated" if body.isActive else "client_deactivated",
                ip=request.client.host if request.client else None,
            )
        conn.commit()
        return {"success": True, "isActive": body.isActive}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@router.put("/{client_id}/permissions")
def update_client_permissions(client_id: int, body: ClientPermissionsRequest, request: Request, principal: dict = Depends(require_admin)):
    permissions = sorted(set(body.permissions))
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT client_id FROM clients WHERE client_id = %s FOR UPDATE", (client_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Client account not found.")
            cursor.execute("DELETE FROM client_permissions WHERE client_id = %s", (client_id,))
            for permission in permissions:
                cursor.execute(
                    "INSERT INTO client_permissions (client_id, permission_key, granted) VALUES (%s, %s, 1)",
                    (client_id, permission),
                )
            log_portal_activity(cursor, "admin", principal["username"], client_id, "client_permissions_updated", details={"permissions": permissions}, ip=request.client.host if request.client else None)
        conn.commit()
        return {"success": True, "permissions": permissions}
    except HTTPException:
        conn.rollback()
        raise
    except pymysql.IntegrityError as exc:
        conn.rollback()
        raise HTTPException(status_code=422, detail="One or more client permissions are invalid.") from exc
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@router.get("/{client_id}/files")
def admin_client_files(client_id: int, principal: dict = Depends(require_admin)):
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT client_id FROM clients WHERE client_id = %s", (client_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Client account not found.")
            cursor.execute("SELECT * FROM client_files WHERE client_id = %s ORDER BY updated_at DESC, original_name", (client_id,))
            return [file_json(row) for row in cursor.fetchall()]
    finally:
        conn.close()


@router.get("/{client_id}/activity")
def admin_client_activity(client_id: int, principal: dict = Depends(require_admin)):
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT client_id FROM clients WHERE client_id = %s", (client_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Client account not found.")
            cursor.execute(
                "SELECT actor_role, actor_username, action, file_id, details, created_at FROM client_activity "
                "WHERE client_id = %s ORDER BY created_at DESC, activity_id DESC LIMIT 200",
                (client_id,),
            )
            return [
                {"actorRole": row["actor_role"], "actorUsername": row["actor_username"], "action": row["action"], "fileId": row["file_id"], "details": row["details"], "createdAt": row["created_at"]}
                for row in cursor.fetchall()
            ]
    finally:
        conn.close()


@router.get("/{client_id}/files/{file_id}/download")
def admin_download_client_file(client_id: int, file_id: str, request: Request, principal: dict = Depends(require_admin)):
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            row = get_file(cursor, client_id, file_id, "active")
    finally:
        conn.close()
    response = file_response(row, client_id)
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            log_portal_activity(cursor, "admin", principal["username"], client_id, "admin_file_downloaded", file_id, {"name": row["original_name"]}, request.client.host if request.client else None)
        conn.commit()
    finally:
        conn.close()
    return response
