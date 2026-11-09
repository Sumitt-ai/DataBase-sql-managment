"""Private per-client file storage and tabular Excel/CSV workbook handling."""

import csv
import hashlib
import io
import os
import re
import zipfile
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path, PurePosixPath
from typing import Any

from backend.config import settings


SUPPORTED_EXTENSIONS = {".xlsx", ".xls", ".csv", ".txt"}
MAX_WORKBOOK_SHEETS = 20
MAX_WORKBOOK_CELLS = 200_000
MAX_WORKBOOK_COLUMNS = 256
MAX_WORKBOOK_ROWS = 100_000
MAX_SHEET_NAME = 31
INVALID_SHEET_CHARS = re.compile(r"[\\/*?:\[\]]")


def client_root(client_id: int) -> Path:
    root = Path(settings.CLIENT_STORAGE_ROOT).expanduser()
    if not root.is_absolute():
        root = Path(__file__).resolve().parent.parent / root
    root = root.resolve()
    return (root / str(int(client_id))).resolve()


def ensure_client_directories(client_id: int) -> None:
    root = client_root(client_id)
    for folder in ("Files", "Backups", "RecycleBin"):
        (root / folder).mkdir(parents=True, exist_ok=True)


def storage_path(client_id: int, storage_key: str) -> Path:
    if not isinstance(storage_key, str) or not storage_key:
        raise ValueError("Invalid stored file key.")
    relative = PurePosixPath(storage_key.replace("\\", "/"))
    if relative.is_absolute() or any(part in {"", ".", ".."} for part in relative.parts):
        raise ValueError("Invalid stored file key.")
    root = client_root(client_id)
    target = (root.joinpath(*relative.parts)).resolve()
    try:
        target.relative_to(root)
    except ValueError as exc:
        raise ValueError("Stored file key escapes the client storage directory.") from exc
    return target


def safe_original_name(filename: str | None) -> tuple[str, str]:
    name = (filename or "").replace("\\", "/").split("/")[-1].strip()
    if not name or name in {".", ".."}:
        raise ValueError("Choose a file with a valid name.")
    if any(ord(char) < 32 for char in name):
        raise ValueError("File names cannot contain control characters.")
    if len(name) > 255:
        raise ValueError("File name must be 255 characters or fewer.")
    extension = Path(name).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise ValueError("Only .xlsx, .xls, .csv, and .txt files are supported.")
    return name, extension


def safe_folder_name(name: str) -> str:
    clean_name = name.strip()
    if not clean_name or clean_name in {".", ".."}:
        raise ValueError("Folder name cannot be empty or a relative path.")
    if len(clean_name) > 120:
        raise ValueError("Folder names must be 120 characters or fewer.")
    if any(ord(char) < 32 for char in clean_name) or any(char in '/\\' for char in clean_name):
        raise ValueError("Folder names cannot contain path separators or control characters.")
    return clean_name


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _json_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return str(value)


def _check_dimensions(rows: list[list[Any]], cell_count: int) -> int:
    for row in rows:
        if not isinstance(row, list):
            raise ValueError("Each workbook row must be a list of cells.")
        cell_count += len(row)
        if cell_count > MAX_WORKBOOK_CELLS:
            raise ValueError(f"Workbook is too large to edit here (limit: {MAX_WORKBOOK_CELLS:,} cells).")
    return cell_count


def read_workbook(path: Path, extension: str) -> list[dict[str, Any]]:
    extension = extension.lower()
    sheets: list[dict[str, Any]] = []
    cell_count = 0

    if extension == ".csv":
        with path.open("r", newline="", encoding="utf-8-sig") as source:
            rows = [list(row) for row in csv.reader(source)]
        _check_dimensions(rows, 0)
        return [{"name": "Sheet1", "rows": rows}]

    if extension == ".xlsx":
        from openpyxl import load_workbook

        try:
            with zipfile.ZipFile(path) as archive:
                if len(archive.infolist()) > 2_000 or sum(info.file_size for info in archive.infolist()) > 128 * 1024 * 1024:
                    raise ValueError("Workbook archive exceeds the expanded file safety limits.")
        except zipfile.BadZipFile as exc:
            raise ValueError("The .xlsx file is not a valid workbook archive.") from exc

        workbook = load_workbook(path, read_only=True, data_only=False)
        try:
            if len(workbook.worksheets) > MAX_WORKBOOK_SHEETS:
                raise ValueError(f"Workbook exceeds the {MAX_WORKBOOK_SHEETS}-sheet limit.")
            for worksheet in workbook.worksheets:
                if worksheet.max_column > MAX_WORKBOOK_COLUMNS or worksheet.max_row > MAX_WORKBOOK_ROWS:
                    raise ValueError(f"Sheet '{worksheet.title}' exceeds the row or column editor limit.")
                if worksheet.max_row * worksheet.max_column > MAX_WORKBOOK_CELLS:
                    raise ValueError(f"Sheet '{worksheet.title}' exceeds the workbook cell limit.")
                rows = []
                for row in worksheet.iter_rows(values_only=True):
                    rows.append([_json_value(value) for value in row])
                    cell_count = _check_dimensions([rows[-1]], cell_count)
                sheets.append({"name": worksheet.title, "rows": rows})
        finally:
            workbook.close()
        return sheets

    if extension == ".xls":
        import xlrd

        workbook = xlrd.open_workbook(str(path), on_demand=True)
        try:
            if workbook.nsheets > MAX_WORKBOOK_SHEETS:
                raise ValueError(f"Workbook exceeds the {MAX_WORKBOOK_SHEETS}-sheet limit.")
            for worksheet in workbook.sheets():
                if worksheet.ncols > MAX_WORKBOOK_COLUMNS or worksheet.nrows > MAX_WORKBOOK_ROWS:
                    raise ValueError(f"Sheet '{worksheet.name}' exceeds the row or column editor limit.")
                if worksheet.nrows * worksheet.ncols > MAX_WORKBOOK_CELLS:
                    raise ValueError(f"Sheet '{worksheet.name}' exceeds the workbook cell limit.")
                rows = []
                for row_index in range(worksheet.nrows):
                    row = []
                    for col_index in range(worksheet.ncols):
                        cell = worksheet.cell(row_index, col_index)
                        value = cell.value
                        if cell.ctype == xlrd.XL_CELL_DATE:
                            value = xlrd.xldate.xldate_as_datetime(value, workbook.datemode).isoformat()
                        elif cell.ctype == xlrd.XL_CELL_EMPTY:
                            value = None
                        row.append(_json_value(value))
                    rows.append(row)
                    cell_count = _check_dimensions([rows[-1]], cell_count)
                sheets.append({"name": worksheet.name, "rows": rows})
        finally:
            workbook.release_resources()
        return sheets

    raise ValueError("Unsupported workbook type.")


def validate_sheets(extension: str, sheets: list[dict[str, Any]]) -> None:
    if not sheets or len(sheets) > MAX_WORKBOOK_SHEETS:
        raise ValueError(f"A workbook must have between 1 and {MAX_WORKBOOK_SHEETS} sheets.")
    if extension == ".csv" and len(sheets) != 1:
        raise ValueError("CSV files support one sheet.")

    seen_names: set[str] = set()
    total_cells = 0
    for sheet in sheets:
        name = sheet.get("name")
        if not isinstance(name, str) or not name.strip() or len(name) > MAX_SHEET_NAME:
            raise ValueError("Sheet names must contain 1 to 31 characters.")
        if INVALID_SHEET_CHARS.search(name):
            raise ValueError("Sheet names cannot contain \\, /, *, ?, :, [ or ].")
        if name.casefold() in seen_names:
            raise ValueError("Sheet names must be unique.")
        seen_names.add(name.casefold())

        rows = sheet.get("rows")
        if not isinstance(rows, list):
            raise ValueError("Each sheet must contain a rows list.")
        if len(rows) > MAX_WORKBOOK_ROWS:
            raise ValueError(f"A sheet cannot exceed {MAX_WORKBOOK_ROWS:,} rows in the editor.")
        if max((len(row) for row in rows), default=0) > MAX_WORKBOOK_COLUMNS:
            raise ValueError(f"A sheet cannot exceed {MAX_WORKBOOK_COLUMNS} columns in the editor.")
        total_cells = _check_dimensions(rows, total_cells)
        for row in rows:
            for value in row:
                if value is not None and not isinstance(value, (str, int, float, bool)):
                    raise ValueError("Cells must contain plain text, numbers, booleans, or be empty.")
                if isinstance(value, str) and len(value) > 32_767:
                    raise ValueError("A cell cannot contain more than 32,767 characters.")

    if extension == ".xls":
        if any(len(sheet["rows"]) > 65_536 for sheet in sheets):
            raise ValueError("Legacy .xls files support up to 65,536 rows per sheet.")
        if any(max((len(row) for row in sheet["rows"]), default=0) > 256 for sheet in sheets):
            raise ValueError("Legacy .xls files support up to 256 columns per sheet.")


def write_workbook(path: Path, extension: str, sheets: list[dict[str, Any]]) -> None:
    extension = extension.lower()
    validate_sheets(extension, sheets)

    if extension == ".csv":
        with path.open("w", newline="", encoding="utf-8-sig") as output:
            writer = csv.writer(output)
            writer.writerows(sheets[0]["rows"])
        return

    if extension == ".xlsx":
        from openpyxl import Workbook

        workbook = Workbook()
        workbook.remove(workbook.active)
        for sheet in sheets:
            worksheet = workbook.create_sheet(sheet["name"])
            for row in sheet["rows"]:
                worksheet.append(row)
        workbook.save(path)
        workbook.close()
        return

    if extension == ".xls":
        import xlwt

        workbook = xlwt.Workbook()
        for sheet in sheets:
            worksheet = workbook.add_sheet(sheet["name"])
            for row_index, row in enumerate(sheet["rows"]):
                for col_index, value in enumerate(row):
                    if value is not None:
                        worksheet.write(row_index, col_index, value)
        workbook.save(str(path))
        return

    raise ValueError("Unsupported workbook type.")
