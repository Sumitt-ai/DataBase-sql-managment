"""Private client-owned file, workbook, recycle-bin, and download routes."""

import os
import shutil
import uuid

import pymysql
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from backend.config import settings
from backend.models import WorkbookSaveRequest
from backend.portal_api_common import file_json, file_response, get_file, log_portal_activity, require_permission
from backend.portal_security import get_portal_connection, require_client
from backend.portal_storage import (
    ensure_client_directories,
    read_workbook,
    safe_original_name,
    sha256_bytes,
    storage_path,
    validate_sheets,
    write_workbook,
)


router = APIRouter(prefix="/api/client")


@router.get("/files")
def list_client_files(principal: dict = Depends(require_client)):
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT * FROM client_files WHERE client_id = %s AND file_state = 'active' "
                "ORDER BY updated_at DESC, original_name",
                (principal["client_id"],),
            )
            return [file_json(row) for row in cursor.fetchall()]
    finally:
        conn.close()


@router.post("/files/upload", status_code=201)
async def upload_client_file(request: Request, file: UploadFile = File(...), principal: dict = Depends(require_client)):
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            require_permission(cursor, principal["client_id"], "upload")
    finally:
        conn.close()

    try:
        original_name, extension = safe_original_name(file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    max_bytes = max(1, settings.CLIENT_MAX_UPLOAD_MB) * 1024 * 1024
    content = await file.read(max_bytes + 1)
    await file.close()
    if not content:
        raise HTTPException(status_code=422, detail="The selected file is empty.")
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds the {settings.CLIENT_MAX_UPLOAD_MB} MB upload limit.")

    file_id = str(uuid.uuid4())
    storage_key = f"Files/{file_id}{extension}"
    temp_path = final_path = None
    try:
        ensure_client_directories(principal["client_id"])
        temp_path = storage_path(principal["client_id"], f"Files/.{file_id}.upload{extension}")
        final_path = storage_path(principal["client_id"], storage_key)
        temp_path.write_bytes(content)
    except OSError as exc:
        if temp_path:
            temp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=507, detail="The server could not write to the configured client file store.") from exc

    try:
        validate_sheets(extension, read_workbook(temp_path, extension))
        os.replace(temp_path, final_path)
    except Exception as exc:
        if temp_path:
            temp_path.unlink(missing_ok=True)
        if final_path:
            final_path.unlink(missing_ok=True)
        if isinstance(exc, ValueError):
            raise HTTPException(status_code=422, detail=f"Could not read this workbook: {exc}") from exc
        if isinstance(exc, OSError):
            raise HTTPException(status_code=507, detail="The server could not save this file to the configured client file store.") from exc
        raise HTTPException(status_code=422, detail="Could not read this Excel or CSV file. Check that it is valid and not password-protected.") from exc

    digest = sha256_bytes(content)
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO client_files (file_id, client_id, original_name, file_extension, content_type, storage_key, size_bytes, sha256, current_version) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1)",
                (file_id, principal["client_id"], original_name, extension, file.content_type, storage_key, len(content), digest),
            )
            cursor.execute(
                "INSERT INTO client_file_versions (file_id, version_number, storage_key, size_bytes, sha256, created_by_username) "
                "VALUES (%s, 1, %s, %s, %s, %s)",
                (file_id, storage_key, len(content), digest, principal["username"]),
            )
            log_portal_activity(
                cursor, "client", principal["username"], principal["client_id"], "file_uploaded",
                file_id, {"name": original_name}, request.client.host if request.client else None,
            )
        conn.commit()
    except pymysql.IntegrityError as exc:
        conn.rollback()
        final_path.unlink(missing_ok=True)
        raise HTTPException(status_code=409, detail="File metadata conflicts with an existing record.") from exc
    except Exception as exc:
        conn.rollback()
        final_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="File metadata could not be saved.") from exc
    finally:
        conn.close()
    return {"success": True, "file": {"fileId": file_id, "originalName": original_name, "sizeBytes": len(content), "currentVersion": 1}}


@router.get("/files/{file_id}/download")
def download_client_file(file_id: str, request: Request, principal: dict = Depends(require_client)):
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            require_permission(cursor, principal["client_id"], "download")
            row = get_file(cursor, principal["client_id"], file_id, "active")
    finally:
        conn.close()
    response = file_response(row, principal["client_id"])
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            log_portal_activity(cursor, "client", principal["username"], principal["client_id"], "file_downloaded", file_id, {"name": row["original_name"]}, request.client.host if request.client else None)
        conn.commit()
    finally:
        conn.close()
    return response


@router.post("/files/{file_id}/recycle")
def recycle_client_file(file_id: str, request: Request, principal: dict = Depends(require_client)):
    conn = get_portal_connection()
    moved_from = moved_to = None
    try:
        with conn.cursor() as cursor:
            require_permission(cursor, principal["client_id"], "recycle")
            row = get_file(cursor, principal["client_id"], file_id, "active")
            moved_from = storage_path(principal["client_id"], row["storage_key"])
            new_key = f"RecycleBin/{row['file_id']}_{uuid.uuid4().hex}{row['file_extension']}"
            moved_to = storage_path(principal["client_id"], new_key)
            if not moved_from.is_file():
                raise HTTPException(status_code=404, detail="The stored file is missing from the server.")
            os.replace(moved_from, moved_to)
            cursor.execute(
                "UPDATE client_files SET storage_key = %s, file_state = 'recycled', deleted_at = UTC_TIMESTAMP() "
                "WHERE file_id = %s AND client_id = %s",
                (new_key, file_id, principal["client_id"]),
            )
            cursor.execute(
                "UPDATE client_file_versions SET storage_key = %s WHERE file_id = %s AND version_number = %s",
                (new_key, file_id, row["current_version"]),
            )
            log_portal_activity(cursor, "client", principal["username"], principal["client_id"], "file_recycled", file_id, {"name": row["original_name"]}, request.client.host if request.client else None)
        conn.commit()
        return {"success": True}
    except HTTPException:
        conn.rollback()
        if moved_to and moved_to.exists() and moved_from:
            os.replace(moved_to, moved_from)
        raise
    except Exception as exc:
        conn.rollback()
        if moved_to and moved_to.exists() and moved_from:
            os.replace(moved_to, moved_from)
        raise HTTPException(status_code=500, detail="File could not be moved to the recycle bin.") from exc
    finally:
        conn.close()


@router.get("/recycle-bin")
def list_recycled_files(principal: dict = Depends(require_client)):
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT * FROM client_files WHERE client_id = %s AND file_state = 'recycled' ORDER BY deleted_at DESC",
                (principal["client_id"],),
            )
            return [file_json(row) for row in cursor.fetchall()]
    finally:
        conn.close()


@router.post("/recycle-bin/{file_id}/restore")
def restore_client_file(file_id: str, request: Request, principal: dict = Depends(require_client)):
    conn = get_portal_connection()
    moved_from = moved_to = None
    try:
        with conn.cursor() as cursor:
            require_permission(cursor, principal["client_id"], "restore")
            row = get_file(cursor, principal["client_id"], file_id, "recycled")
            moved_from = storage_path(principal["client_id"], row["storage_key"])
            new_key = f"Files/{row['file_id']}{row['file_extension']}"
            moved_to = storage_path(principal["client_id"], new_key)
            if not moved_from.is_file():
                raise HTTPException(status_code=404, detail="The stored file is missing from the server.")
            if moved_to.exists():
                raise HTTPException(status_code=409, detail="A file with this internal ID already exists.")
            os.replace(moved_from, moved_to)
            cursor.execute(
                "UPDATE client_files SET storage_key = %s, file_state = 'active', deleted_at = NULL "
                "WHERE file_id = %s AND client_id = %s",
                (new_key, file_id, principal["client_id"]),
            )
            cursor.execute(
                "UPDATE client_file_versions SET storage_key = %s WHERE file_id = %s AND version_number = %s",
                (new_key, file_id, row["current_version"]),
            )
            log_portal_activity(cursor, "client", principal["username"], principal["client_id"], "file_restored", file_id, {"name": row["original_name"]}, request.client.host if request.client else None)
        conn.commit()
        return {"success": True}
    except HTTPException:
        conn.rollback()
        if moved_to and moved_to.exists() and moved_from:
            os.replace(moved_to, moved_from)
        raise
    except Exception as exc:
        conn.rollback()
        if moved_to and moved_to.exists() and moved_from:
            os.replace(moved_to, moved_from)
        raise HTTPException(status_code=500, detail="File could not be restored.") from exc
    finally:
        conn.close()


@router.get("/workbook/{file_id}")
def get_client_workbook(file_id: str, principal: dict = Depends(require_client)):
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            require_permission(cursor, principal["client_id"], "edit")
            row = get_file(cursor, principal["client_id"], file_id, "active")
    finally:
        conn.close()
    path = storage_path(principal["client_id"], row["storage_key"])
    if not path.is_file():
        raise HTTPException(status_code=404, detail="The stored workbook is missing from the server.")
    try:
        sheets = read_workbook(path, row["file_extension"])
    except Exception as exc:
        raise HTTPException(status_code=422, detail="This workbook could not be opened for editing.") from exc
    limitations = ["Editing rebuilds the workbook from cell values and formulas; advanced formatting, charts, macros, pivot tables, and external connections are not preserved."]
    if row["file_extension"] == ".xls":
        limitations.append("Legacy .xls editing preserves cell values and sheet names only; formulas and formatting are converted to their displayed values.")
    if row["file_extension"] == ".csv":
        limitations.append("CSV supports one sheet and does not store formulas, formatting, or multiple sheets.")
    return {
        "fileId": row["file_id"],
        "fileName": row["original_name"],
        "extension": row["file_extension"],
        "currentVersion": row["current_version"],
        "sheets": sheets,
        "limitations": limitations,
    }


@router.put("/workbook/{file_id}")
def save_client_workbook(file_id: str, body: WorkbookSaveRequest, request: Request, principal: dict = Depends(require_client)):
    conn = get_portal_connection()
    temp_path = backup_path = current_path = None
    replaced_current = False
    try:
        with conn.cursor() as cursor:
            require_permission(cursor, principal["client_id"], "edit")
            cursor.execute(
                "SELECT * FROM client_files WHERE file_id = %s AND client_id = %s AND file_state = 'active' FOR UPDATE",
                (file_id, principal["client_id"]),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="File not found.")
            current_path = storage_path(principal["client_id"], row["storage_key"])
            if not current_path.is_file():
                raise HTTPException(status_code=404, detail="The stored workbook is missing from the server.")
            sheets = [sheet.model_dump() for sheet in body.sheets]
            try:
                validate_sheets(row["file_extension"], sheets)
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc

            ensure_client_directories(principal["client_id"])
            suffix = uuid.uuid4().hex
            temp_path = storage_path(principal["client_id"], f"Files/.{file_id}_{suffix}.tmp")
            backup_key = f"Backups/{file_id}_v{row['current_version']}_{suffix}{row['file_extension']}"
            backup_path = storage_path(principal["client_id"], backup_key)
            next_version = row["current_version"] + 1
            write_workbook(temp_path, row["file_extension"], sheets)
            new_bytes = temp_path.read_bytes()
            max_bytes = max(1, settings.CLIENT_MAX_UPLOAD_MB) * 1024 * 1024
            if len(new_bytes) > max_bytes:
                raise HTTPException(status_code=413, detail=f"Saved workbook exceeds the {settings.CLIENT_MAX_UPLOAD_MB} MB limit.")
            shutil.copy2(current_path, backup_path)
            cursor.execute(
                "UPDATE client_file_versions SET storage_key = %s WHERE file_id = %s AND version_number = %s",
                (backup_key, file_id, row["current_version"]),
            )
            os.replace(temp_path, current_path)
            replaced_current = True
            digest = sha256_bytes(new_bytes)
            cursor.execute(
                "UPDATE client_files SET size_bytes = %s, sha256 = %s, current_version = %s WHERE file_id = %s AND client_id = %s",
                (len(new_bytes), digest, next_version, file_id, principal["client_id"]),
            )
            cursor.execute(
                "INSERT INTO client_file_versions (file_id, version_number, storage_key, size_bytes, sha256, created_by_username) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (file_id, next_version, row["storage_key"], len(new_bytes), digest, principal["username"]),
            )
            log_portal_activity(cursor, "client", principal["username"], principal["client_id"], "workbook_saved", file_id, {"version": next_version}, request.client.host if request.client else None)
        conn.commit()
        return {"success": True, "currentVersion": next_version, "sizeBytes": len(new_bytes)}
    except HTTPException:
        conn.rollback()
        if replaced_current and backup_path and backup_path.exists() and current_path:
            shutil.copy2(backup_path, current_path)
        if temp_path:
            temp_path.unlink(missing_ok=True)
        if backup_path:
            backup_path.unlink(missing_ok=True)
        raise
    except Exception as exc:
        conn.rollback()
        if replaced_current and backup_path and backup_path.exists() and current_path:
            shutil.copy2(backup_path, current_path)
        if temp_path:
            temp_path.unlink(missing_ok=True)
        if backup_path:
            backup_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Workbook could not be saved. The previous version was restored.") from exc
    finally:
        conn.close()
