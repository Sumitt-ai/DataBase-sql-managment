"""Client account login, profile, dashboard, and activity routes."""

import pymysql
from fastapi import APIRouter, Depends, HTTPException, Request

import backend.database as db
from backend.config import settings
from backend.models import ClientProfileRequest, LoginRequest
from backend.portal_api_common import client_profile, client_permissions, log_portal_activity
from backend.portal_security import get_portal_connection, issue_session, require_client, revoke_session


router = APIRouter(prefix="/api/client")


@router.post("/auth/login")
def client_login(body: LoginRequest, request: Request):
    username = body.username.strip().lower()
    if not username or username == (settings.MYSQL_USER or "").strip().lower():
        raise HTTPException(status_code=401, detail="Invalid MySQL username/password or Client Portal access is not enabled.")

    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM clients WHERE username = %s", (username,))
            client = cursor.fetchone()
            if not client or not client["is_active"]:
                raise HTTPException(status_code=401, detail="Invalid MySQL username/password or Client Portal access is not enabled.")
    except HTTPException:
        raise
    except pymysql.MySQLError as exc:
        raise HTTPException(status_code=503, detail="Client sign-in is temporarily unavailable.") from exc
    finally:
        conn.close()

    # MySQL does not expose reusable plaintext passwords in mysql.user. Verify by
    # asking the server to authenticate the submitted account over a new connection.
    if not db.authenticate_mysql_user(username, body.password):
        raise HTTPException(status_code=401, detail="Invalid MySQL username/password or Client Portal access is not enabled.")

    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            log_portal_activity(cursor, "client", username, client["client_id"], "login", ip=request.client.host if request.client else None)
        conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    except pymysql.MySQLError as exc:
        conn.rollback()
        raise HTTPException(status_code=503, detail="Client sign-in is temporarily unavailable.") from exc
    finally:
        conn.close()

    token = issue_session(username, "client", client["client_id"])
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            permissions = client_permissions(cursor, client["client_id"])
    finally:
        conn.close()
    return {
        "success": True,
        "role": "client",
        "token": token,
        "client": {
            "clientId": client["client_id"],
            "username": username,
            "clientName": client["client_name"],
            "permissions": permissions,
        },
    }


@router.post("/auth/logout")
def client_logout(request: Request, principal: dict = Depends(require_client)):
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            log_portal_activity(cursor, "client", principal["username"], principal["client_id"], "logout", ip=request.client.host if request.client else None)
        conn.commit()
    finally:
        conn.close()
    revoke_session(principal)
    return {"success": True}


@router.get("/me")
def client_me(principal: dict = Depends(require_client)):
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            return client_profile(cursor, principal["client_id"])
    finally:
        conn.close()


@router.get("/dashboard")
def client_dashboard(principal: dict = Depends(require_client)):
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            profile = client_profile(cursor, principal["client_id"])
            cursor.execute(
                "SELECT COUNT(*) AS file_count, "
                "COALESCE(SUM(CASE WHEN file_state = 'active' THEN 1 ELSE 0 END), 0) AS active_count, "
                "COALESCE(SUM(size_bytes), 0) AS storage_bytes "
                "FROM client_files WHERE client_id = %s",
                (principal["client_id"],),
            )
            summary = cursor.fetchone()
            cursor.execute(
                "SELECT action, details, created_at FROM client_activity WHERE client_id = %s "
                "ORDER BY created_at DESC, activity_id DESC LIMIT 8",
                (principal["client_id"],),
            )
            recent = cursor.fetchall()
            return {
                "client": profile,
                "totalFiles": summary["file_count"],
                "activeFiles": summary["active_count"],
                "storageBytes": summary["storage_bytes"],
                "recentActivity": [
                    {"action": row["action"], "details": row["details"], "createdAt": row["created_at"]}
                    for row in recent
                ],
            }
    finally:
        conn.close()


@router.put("/profile")
def update_client_profile(body: ClientProfileRequest, principal: dict = Depends(require_client)):
    client_name = body.clientName.strip()
    if not client_name:
        raise HTTPException(status_code=422, detail="Client name cannot be empty.")
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("UPDATE clients SET client_name = %s WHERE client_id = %s", (client_name, principal["client_id"]))
            log_portal_activity(cursor, "client", principal["username"], principal["client_id"], "profile_updated")
            profile = client_profile(cursor, principal["client_id"])
        conn.commit()
        return profile
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@router.get("/activity")
def client_activity(principal: dict = Depends(require_client)):
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT action, file_id, details, created_at FROM client_activity "
                "WHERE client_id = %s ORDER BY created_at DESC, activity_id DESC LIMIT 200",
                (principal["client_id"],),
            )
            return [
                {"action": row["action"], "fileId": row["file_id"], "details": row["details"], "createdAt": row["created_at"]}
                for row in cursor.fetchall()
            ]
    finally:
        conn.close()
