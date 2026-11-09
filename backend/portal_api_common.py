"""Shared helpers for Client Portal API routers."""

import json

from fastapi import HTTPException
from fastapi.responses import FileResponse

from backend.portal_storage import storage_path


def require_permission(cursor, client_id: int, permission: str) -> None:
    cursor.execute(
        "SELECT granted FROM client_permissions WHERE client_id = %s AND permission_key = %s",
        (client_id, permission),
    )
    row = cursor.fetchone()
    if not row or not row["granted"]:
        raise HTTPException(status_code=403, detail=f"Your account does not have {permission} permission.")


def log_portal_activity(cursor, role: str, username: str, client_id: int | None, action: str,
                        file_id: str | None = None, details: dict | None = None, ip: str | None = None) -> None:
    cursor.execute(
        "INSERT INTO client_activity (actor_role, actor_username, client_id, action, file_id, details, client_ip) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (role, username, client_id, action, file_id, json.dumps(details or {}), ip),
    )


def remove_client_access(cursor, client_id: int, actor_username: str, ip: str | None = None) -> bool:
    cursor.execute("SELECT username FROM clients WHERE client_id = %s FOR UPDATE", (client_id,))
    client = cursor.fetchone()
    if not client:
        return False

    cursor.execute("UPDATE clients SET is_active = 0 WHERE client_id = %s", (client_id,))
    cursor.execute(
        "INSERT INTO client_access_removals (client_id, removed_by) VALUES (%s, %s) "
        "ON DUPLICATE KEY UPDATE removed_by = VALUES(removed_by), removed_at = UTC_TIMESTAMP()",
        (client_id, actor_username),
    )
    cursor.execute(
        "UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() "
        "WHERE client_id = %s AND revoked_at IS NULL",
        (client_id,),
    )
    log_portal_activity(
        cursor,
        "admin",
        actor_username,
        client_id,
        "client_access_removed",
        details={"username": client["username"]},
        ip=ip,
    )
    return True


def client_profile(cursor, client_id: int) -> dict:
    cursor.execute(
        "SELECT client_id, username, client_name, is_active, created_at FROM clients WHERE client_id = %s",
        (client_id,),
    )
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Client account not found.")
    cursor.execute(
        "SELECT permission_key FROM client_permissions WHERE client_id = %s AND granted = 1 ORDER BY permission_key",
        (client_id,),
    )
    return {
        "clientId": row["client_id"],
        "username": row["username"],
        "clientName": row["client_name"],
        "isActive": bool(row["is_active"]),
        "createdAt": row["created_at"],
        "permissions": [item["permission_key"] for item in cursor.fetchall()],
    }


def client_permissions(cursor, client_id: int) -> list[str]:
    cursor.execute(
        "SELECT permission_key FROM client_permissions WHERE client_id = %s AND granted = 1 ORDER BY permission_key",
        (client_id,),
    )
    return [row["permission_key"] for row in cursor.fetchall()]


def get_file(cursor, client_id: int, file_id: str, state: str | None = None) -> dict:
    query = "SELECT * FROM client_files WHERE file_id = %s AND client_id = %s"
    params: list = [file_id, client_id]
    if state:
        query += " AND file_state = %s"
        params.append(state)
    cursor.execute(query, params)
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="File not found.")
    return row


def file_json(row: dict) -> dict:
    return {
        "fileId": row["file_id"],
        "folderId": row.get("folder_id"),
        "originalName": row["original_name"],
        "extension": row["file_extension"],
        "contentType": row["content_type"],
        "sizeBytes": row["size_bytes"],
        "currentVersion": row["current_version"],
        "state": row["file_state"],
        "uploadedAt": row["uploaded_at"],
        "updatedAt": row["updated_at"],
        "deletedAt": row["deleted_at"],
    }


def file_response(row: dict, client_id: int) -> FileResponse:
    try:
        path = storage_path(client_id, row["storage_key"])
    except ValueError as exc:
        raise HTTPException(status_code=500, detail="Stored file metadata is invalid.") from exc
    if not path.is_file():
        raise HTTPException(status_code=404, detail="The stored file is missing from the server.")
    return FileResponse(path, filename=row["original_name"], media_type="application/octet-stream")
