"""Private client-owned file, workbook, recycle-bin, and download routes."""

import os
import shutil
import uuid

import pymysql
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile

from backend.config import settings
from backend.models import (
    ClientFolderCreateRequest,
    ClientTextFileCreateRequest,
    ClientTextFileUpdateRequest,
    WorkbookSaveRequest,
)
from backend.portal_api_common import file_json, file_response, get_file, log_portal_activity, require_permission
from backend.portal_security import get_portal_connection, require_client
from backend.portal_storage import (
    ensure_client_directories,
    read_workbook,
    safe_folder_name,
    safe_original_name,
    sha256_bytes,
    storage_path,
    validate_sheets,
    write_workbook,
)


router = APIRouter(prefix="/api/client")


def _validate_folder(cursor, client_id: int, folder_id: str | None) -> None:
    if folder_id is None:
        return
    cursor.execute(
        "SELECT folder_id FROM client_folders WHERE folder_id = %s AND client_id = %s",
        (folder_id, client_id),
    )
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Folder not found.")


@router.get("/files")
def list_client_files(
    folder_id: str | None = Query(default=None, alias="folderId"),
    all_folders: bool = Query(default=False, alias="allFolders"),
    principal: dict = Depends(require_client),
):
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            if not all_folders:
                _validate_folder(cursor, principal["client_id"], folder_id)
                if folder_id is None:
                    folder_clause = "AND (loc.folder_id IS NULL)"
                    params = (principal["client_id"],)
                else:
                    folder_clause = "AND loc.folder_id = %s"
                    params = (principal["client_id"], folder_id)
            else:
                folder_clause = ""
                params = (principal["client_id"],)
            cursor.execute(
                "SELECT f.*, loc.folder_id FROM client_files f "
                "LEFT JOIN client_file_locations loc ON loc.file_id = f.file_id AND loc.client_id = f.client_id "
                "WHERE f.client_id = %s AND f.file_state = 'active' "
                f"{folder_clause} ORDER BY f.updated_at DESC, f.original_name",
                params,
            )
            return [file_json(row) for row in cursor.fetchall()]
    finally:
        conn.close()


@router.get("/folders")
def list_client_folders(parent_id: str | None = Query(default=None, alias="parentId"), principal: dict = Depends(require_client)):
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            _validate_folder(cursor, principal["client_id"], parent_id)
            if parent_id is None:
                cursor.execute(
                    "SELECT folder_id, folder_name, parent_folder_id, created_at FROM client_folders "
                    "WHERE client_id = %s AND parent_folder_id IS NULL ORDER BY folder_name",
                    (principal["client_id"],),
                )
            else:
                cursor.execute(
                    "SELECT folder_id, folder_name, parent_folder_id, created_at FROM client_folders "
                    "WHERE client_id = %s AND parent_folder_id = %s ORDER BY folder_name",
                    (principal["client_id"], parent_id),
                )
            return [
                {"folderId": row["folder_id"], "name": row["folder_name"], "parentId": row["parent_folder_id"], "createdAt": row["created_at"]}
                for row in cursor.fetchall()
            ]
    finally:
        conn.close()


@router.post("/folders", status_code=201)
def create_client_folder(body: ClientFolderCreateRequest, request: Request, principal: dict = Depends(require_client)):
    try:
        folder_name = safe_folder_name(body.name)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            require_permission(cursor, principal["client_id"], "upload")
            _validate_folder(cursor, principal["client_id"], body.parentId)
            cursor.execute(
                "SELECT client_id FROM clients WHERE client_id = %s FOR UPDATE",
                (principal["client_id"],),
            )
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Client account not found.")
            cursor.execute(
                "SELECT folder_id FROM client_folders WHERE client_id = %s "
                "AND parent_folder_id <=> %s AND folder_name = %s FOR UPDATE",
                (principal["client_id"], body.parentId, folder_name),
            )
            if cursor.fetchone():
                raise HTTPException(status_code=409, detail="A folder with this name already exists here.")
            folder_id = str(uuid.uuid4())
            cursor.execute(
                "INSERT INTO client_folders (folder_id, client_id, parent_folder_id, folder_name) VALUES (%s, %s, %s, %s)",
                (folder_id, principal["client_id"], body.parentId, folder_name),
            )
            log_portal_activity(
                cursor, "client", principal["username"], principal["client_id"], "folder_created",
                details={"name": folder_name, "parentId": body.parentId},
                ip=request.client.host if request.client else None,
            )
        conn.commit()
        return {"success": True, "folder": {"folderId": folder_id, "name": folder_name, "parentId": body.parentId}}
    except HTTPException:
        conn.rollback()
        raise
    except pymysql.IntegrityError as exc:
        conn.rollback()
        raise HTTPException(status_code=409, detail="A folder with this name already exists here.") from exc
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@router.post("/files/upload", status_code=201)
async def upload_client_file(
    request: Request,
    file: UploadFile = File(...),
    folder_id: str | None = Form(default=None),
    principal: dict = Depends(require_client),
):
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            require_permission(cursor, principal["client_id"], "upload")
            _validate_folder(cursor, principal["client_id"], folder_id)
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
    storage_key = f"Files/{folder_id}/{file_id}{extension}" if folder_id else f"Files/{file_id}{extension}"
    temp_path = final_path = None
    try:
        ensure_client_directories(principal["client_id"])
        temp_key = f"Files/{folder_id}/.{file_id}.upload{extension}" if folder_id else f"Files/.{file_id}.upload{extension}"
        temp_path = storage_path(principal["client_id"], temp_key)
        final_path = storage_path(principal["client_id"], storage_key)
        temp_path.parent.mkdir(parents=True, exist_ok=True)
        temp_path.write_bytes(content)
    except OSError as exc:
        if temp_path:
            temp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=507, detail="The server could not write to the configured client file store.") from exc

    try:
        if extension != ".txt":
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
            if folder_id:
                cursor.execute(
                    "INSERT INTO client_file_locations (file_id, client_id, folder_id) VALUES (%s, %s, %s)",
                    (file_id, principal["client_id"], folder_id),
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
    return {"success": True, "file": {"fileId": file_id, "originalName": original_name, "sizeBytes": len(content), "currentVersion": 1, "folderId": folder_id}}


@router.post("/text-files", status_code=201)
def create_client_text_file(body: ClientTextFileCreateRequest, request: Request, principal: dict = Depends(require_client)):
    try:
        filename = body.name if body.name.lower().endswith(".txt") else f"{body.name}.txt"
        original_name, extension = safe_original_name(filename)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    content = body.content.encode("utf-8")
    max_bytes = max(1, settings.CLIENT_MAX_UPLOAD_MB) * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Text file exceeds the {settings.CLIENT_MAX_UPLOAD_MB} MB limit.")
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            require_permission(cursor, principal["client_id"], "upload")
            _validate_folder(cursor, principal["client_id"], body.folderId)
    finally:
        conn.close()
    file_id = str(uuid.uuid4())
    storage_key = f"Files/{body.folderId}/{file_id}.txt" if body.folderId else f"Files/{file_id}.txt"
    path = storage_path(principal["client_id"], storage_key)
    try:
        ensure_client_directories(principal["client_id"])
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    except OSError as exc:
        raise HTTPException(status_code=507, detail="The server could not write to the configured client file store.") from exc

    digest = sha256_bytes(content)
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            require_permission(cursor, principal["client_id"], "upload")
            _validate_folder(cursor, principal["client_id"], body.folderId)
            cursor.execute(
                "INSERT INTO client_files (file_id, client_id, original_name, file_extension, content_type, storage_key, size_bytes, sha256, current_version) "
                "VALUES (%s, %s, %s, %s, 'text/plain; charset=utf-8', %s, %s, %s, 1)",
                (file_id, principal["client_id"], original_name, extension, storage_key, len(content), digest),
            )
            cursor.execute(
                "INSERT INTO client_file_versions (file_id, version_number, storage_key, size_bytes, sha256, created_by_username) "
                "VALUES (%s, 1, %s, %s, %s, %s)",
                (file_id, storage_key, len(content), digest, principal["username"]),
            )
            if body.folderId:
                cursor.execute(
                    "INSERT INTO client_file_locations (file_id, client_id, folder_id) VALUES (%s, %s, %s)",
                    (file_id, principal["client_id"], body.folderId),
                )
            log_portal_activity(
                cursor, "client", principal["username"], principal["client_id"], "text_file_created",
                file_id, {"name": original_name}, request.client.host if request.client else None,
            )
        conn.commit()
    except HTTPException:
        conn.rollback()
        path.unlink(missing_ok=True)
        raise
    except Exception as exc:
        conn.rollback()
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Text file metadata could not be saved.") from exc
    finally:
        conn.close()
    return {"success": True, "file": {"fileId": file_id, "originalName": original_name, "sizeBytes": len(content), "currentVersion": 1, "folderId": body.folderId}}


@router.get("/text-files/{file_id}")
def get_client_text_file(file_id: str, principal: dict = Depends(require_client)):
    conn = get_portal_connection()
    try:
        with conn.cursor() as cursor:
            require_permission(cursor, principal["client_id"], "edit")
            row = get_file(cursor, principal["client_id"], file_id, "active")
    finally:
        conn.close()
    if row["file_extension"] != ".txt":
        raise HTTPException(status_code=422, detail="This file is not a text file.")
    path = storage_path(principal["client_id"], row["storage_key"])
    try:
        content = path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="The stored text file is missing from the server.") from exc
    except (OSError, UnicodeError) as exc:
        raise HTTPException(status_code=422, detail="The stored text file could not be read.") from exc
    return {"fileId": row["file_id"], "fileName": row["original_name"], "content": content, "currentVersion": row["current_version"]}


@router.put("/text-files/{file_id}")
def save_client_text_file(file_id: str, body: ClientTextFileUpdateRequest, request: Request, principal: dict = Depends(require_client)):
    content = body.content.encode("utf-8")
    max_bytes = max(1, settings.CLIENT_MAX_UPLOAD_MB) * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Text file exceeds the {settings.CLIENT_MAX_UPLOAD_MB} MB limit.")
    conn = get_portal_connection()
    current_path = backup_path = temp_path = None
    try:
        with conn.cursor() as cursor:
            require_permission(cursor, principal["client_id"], "edit")
            cursor.execute(
                "SELECT * FROM client_files WHERE file_id = %s AND client_id = %s AND file_state = 'active' FOR UPDATE",
                (file_id, principal["client_id"]),
            )
            row = cursor.fetchone()
            if not row or row["file_extension"] != ".txt":
                raise HTTPException(status_code=404, detail="Text file not found.")
            current_path = storage_path(principal["client_id"], row["storage_key"])
            if not current_path.is_file():
                raise HTTPException(status_code=404, detail="The stored text file is missing from the server.")
            ensure_client_directories(principal["client_id"])
            suffix = uuid.uuid4().hex
            temp_path = storage_path(principal["client_id"], f"Files/.{file_id}_{suffix}.tmp")
            backup_key = f"Backups/{file_id}_v{row['current_version']}_{suffix}.txt"
            backup_path = storage_path(principal["client_id"], backup_key)
            temp_path.write_bytes(content)
            os.replace(current_path, backup_path)
            os.replace(temp_path, current_path)
            next_version = row["current_version"] + 1
            digest = sha256_bytes(content)
            cursor.execute(
                "INSERT INTO client_file_versions (file_id, version_number, storage_key, size_bytes, sha256, created_by_username) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (file_id, next_version, row["storage_key"], len(content), digest, principal["username"]),
            )
            cursor.execute(
                "UPDATE client_files SET size_bytes = %s, sha256 = %s, current_version = %s "
                "WHERE file_id = %s AND client_id = %s",
                (len(content), digest, next_version, file_id, principal["client_id"]),
            )
            cursor.execute(
                "UPDATE client_file_versions SET storage_key = %s WHERE file_id = %s AND version_number = %s",
                (backup_key, file_id, row["current_version"]),
            )
            log_portal_activity(
                cursor, "client", principal["username"], principal["client_id"], "text_file_updated",
                file_id, {"name": row["original_name"], "version": next_version},
                request.client.host if request.client else None,
            )
        conn.commit()
        return {"success": True, "currentVersion": next_version}
    except HTTPException:
        conn.rollback()
        if current_path and backup_path and backup_path.exists():
            os.replace(backup_path, current_path)
        if temp_path and temp_path.exists():
            temp_path.unlink()
        raise
    except Exception as exc:
        conn.rollback()
        if current_path and backup_path and backup_path.exists():
            os.replace(backup_path, current_path)
        if temp_path and temp_path.exists():
            temp_path.unlink()
        raise HTTPException(status_code=500, detail="Text file could not be saved.") from exc
    finally:
        conn.close()


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
            cursor.execute(
                "SELECT folder_id FROM client_file_locations WHERE file_id = %s AND client_id = %s",
                (file_id, principal["client_id"]),
            )
            location = cursor.fetchone()
            folder_id = location["folder_id"] if location else None
            _validate_folder(cursor, principal["client_id"], folder_id)
            new_key = f"Files/{folder_id}/{row['file_id']}{row['file_extension']}" if folder_id else f"Files/{row['file_id']}{row['file_extension']}"
            moved_to = storage_path(principal["client_id"], new_key)
            moved_to.parent.mkdir(parents=True, exist_ok=True)
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
