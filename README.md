# MySQL Admin Console and Client File Portal

An existing React/Vite administration console backed by FastAPI, MySQL 8, and a local SQLite metadata store. The project now also includes a separate Client Portal for private Excel/CSV file management. Both interfaces use the same FastAPI service and configured MySQL server.

## Features

### Admin Console

- MySQL-backed administrator login.
- Dashboard, MySQL user management, database management, request approvals, activity log, and settings.
- Separate Client Management for enabling existing MySQL accounts in the Client Portal, setting file permissions, activating/deactivating or removing portal access, deleting the associated MySQL user, reviewing uploaded files, viewing storage usage, and reviewing client activity. Removing portal access preserves the user's uploaded files and activity history.
- The MySQL User Management page creates and manages database accounts. Client Management enrolls an existing MySQL account for portal access and does not create a second password.

### Client Portal

- Separate sign-in at `/client/login`; clients cannot self-register. Sign-in uses the username and password of an active MySQL account that an administrator has enrolled for portal access.
- Client dashboard, private file list, upload, workbook editor, downloads, recycle bin, activity history, profile, and logout.
- Supports `.xlsx`, `.xls`, and `.csv` files. Files are stored on the server, not in MySQL. MySQL stores account, permission, file metadata, version, session, and activity records.
- Backend-generated client folders and file keys enforce ownership. The browser never supplies a server path.
- Each save backs up the previous workbook version. Recycle and restore move the file within that client's storage area.

Workbook editing rebuilds the file from cell values and formulas. Advanced formatting, charts, macros, pivot tables, and external connections are not preserved. Legacy `.xls` editing preserves cell values and sheet names; formulas and formatting are converted to their displayed values. CSV has one sheet and no workbook formatting.

## Requirements

- Windows host for the provided batch launchers.
- Node.js 18 or newer.
- Python 3.10 or newer.
- MySQL 8 reachable from the FastAPI host.
- FastAPI's configured MySQL account must be able to use the existing admin functions and the `mysql_admin_portal` schema.

Python workbook dependencies (`openpyxl`, `xlrd`, and `xlwt`) are listed in `requirements.txt`.

## Configuration

Create a project-root `.env` file. Keep real credentials in this ignored local file; never commit it or paste its contents into support messages.

```dotenv
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
SERVER_IP=<server-lan-ip>

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=<backend-service-account>
MYSQL_PASSWORD=<backend-service-password>

CLIENT_METADATA_SCHEMA=mysql_admin_portal
CLIENT_STORAGE_ROOT=./client_storage
CLIENT_MAX_UPLOAD_MB=25
CORS_ORIGIN_REGEX=^https?://[^/:]+:5173$
```

Admin Console sign-in accepts a MySQL username and password and authenticates them directly against MySQL. The account must be directly granted `ALL PRIVILEGES ON *.*`; the backend checks its grants after authentication. MySQL does not return recoverable passwords, so the password is supplied at sign-in and is not stored by the application. This administrator account can differ from `MYSQL_USER` and `MYSQL_PASSWORD`, which are the backend service credentials used to execute admin operations and access Client Portal metadata. Configure that service account separately with the privileges required by the application. Client sign-in is also verified directly by MySQL, then the backend checks that the account is active in the portal enrollment table. Client permissions and file ownership remain application-level controls; the browser never receives the backend service credentials or a database connection.

The server creates folders under `CLIENT_STORAGE_ROOT` as files are uploaded. The default is a `client_storage` folder in the project root:

```text
client_storage/<client-id>/Files
client_storage/<client-id>/Backups
client_storage/<client-id>/RecycleBin
```

Make sure the Windows account running FastAPI can write to this configured directory. For another drive, set an absolute path that exists on the backend host and grant the FastAPI account Modify access.

## Client Portal metadata schema

`backend/client_portal_schema.sql` contains an additive migration for the separate `mysql_admin_portal` schema and its seven tables: `clients`, `client_access_removals`, `client_permissions`, `auth_sessions`, `client_files`, `client_file_versions`, and `client_activity`. Removed enrollments are hidden from Client Management and have their sessions revoked; their portal files and history remain stored. Re-enabling the same account restores its enrollment and retained data. The script also makes the legacy `clients.password_hash` column nullable; that field is no longer used for sign-in. The schema was created on this project instance earlier, but rerun this SQL file after the MySQL server is reachable to apply the compatibility change. The backend does not automatically apply DDL at startup.

On another server, inspect the schema and check for conflicts before applying the migration. It uses `CREATE DATABASE IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, and a non-destructive `MODIFY COLUMN` for the legacy password-hash field; it does not drop existing objects. Do not run privilege-grant scripts without reviewing their contents and understanding the required grants.

## Start the application

From the project root, the one-click launcher starts the backend and frontend:

```bat
start-all.bat
```

Or start each process separately:

```bat
start-backend.bat
start-frontend.bat
```

Frontend: `http://localhost:5173` or `http://<server-lan-ip>:5173`  
Backend API: `http://localhost:8000/api`  
FastAPI development docs: `http://localhost:8000/docs`

For LAN access, allow the intended clients to reach ports 5173 and 8000 on the server. MySQL connectivity is from the backend host to `MYSQL_HOST:MYSQL_PORT`; it is separate from browser-to-frontend and browser-to-API connectivity. Use `GET /api/system/status` after signing in to check the admin console's MySQL connection.

Create the database account first from **User Management**. Then sign in to the Admin Console with the configured MySQL administrator account and enable that existing account in **Client Management**, where the administrator assigns portal file permissions. Clients use their MySQL username and password at `/client/login`. Change a client password through MySQL User Management; there is no separate portal password.

## Development commands

```powershell
# Frontend, from frontend/
npm install
npm run dev -- --host 0.0.0.0 --port 5173
npm run lint
npm run build

# Backend, from the project root
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

## Data and security notes

- MySQL stores live MySQL accounts/schemas and the separate Client Portal application records.
- `backend/admin_meta.db` remains the SQLite store for admin profile metadata, database requests, and the existing activity log.
- MySQL verifies admin and enrolled-client passwords. Bearer sessions are random, stored hashed in MySQL, expire after eight hours, and are held in browser session storage.
- Admin and client API routes enforce server-side role checks. A client can only list or access files whose `client_id` matches its authenticated session.
- The API accepts the Vite frontend origin on port 5173 by default; configure `CORS_ORIGIN_REGEX` if the frontend uses another origin.
- SQL setup scripts can change MySQL privileges. Review them before running; the app does not execute them.
- Do not expose this development deployment to the public internet without a separate security review, HTTPS, production-grade deployment settings, and tighter network controls.
