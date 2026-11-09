import os
import pymysql
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.models import (
    LoginRequest,
    UserCreateRequest,
    UserUpdateRequest,
    UserDeleteRequest,
    DatabaseCreateRequest,
    DatabaseAssignRequest,
    RequestRejectBody,
    SettingsUpdateRequest
)
import backend.database as db
from backend.admin_client_api import router as admin_client_router
from backend.client_account_api import router as client_account_router
from backend.client_file_api import router as client_file_router
from backend.portal_security import issue_session, require_admin, revoke_session

app = FastAPI(
    title="MySQL Admin Console API",
    description="Centralized administration API for local MySQL Server 8.0 over LAN",
    version="2.0.2"
)

# Allow the Vite frontend from localhost or a LAN hostname on its configured port.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# -----------------------------------------------------------------------------
# System & Health Endpoints
# -----------------------------------------------------------------------------

@app.get("/api/system/status")
def get_system_status(principal: dict = Depends(require_admin)):
    """Returns connectivity status of MySQL Server and host information."""
    mysql_status = db.test_mysql_connection()
    return {
        "serverIp": settings.SERVER_IP,
        "serverPort": settings.SERVER_PORT,
        "mysql": mysql_status
    }

@app.post("/api/auth/login")
def login(body: LoginRequest, request: Request):
    """Authenticate a MySQL account with a direct global ALL PRIVILEGES grant."""
    client_ip = request.client.host if request.client else settings.SERVER_IP
    username = body.username.strip()
    if not username or not body.password:
        raise HTTPException(status_code=401, detail="A MySQL administrator username and password are required.")

    try:
        is_admin = db.authenticate_mysql_admin(username, body.password)
    except pymysql.MySQLError as exc:
        error_code = exc.args[0] if exc.args and isinstance(exc.args[0], int) else None
        db.log_activity(
            "Admin Login", "Console Auth",
            f"MySQL rejected or could not verify administrator account (error {error_code})",
            "FAILED", client_ip, username,
        )
        if error_code == 1130:
            raise HTTPException(
                status_code=403,
                detail="MySQL does not allow connections for this account from the backend host. Check the MySQL account Host entry.",
            ) from exc
        if error_code in {2002, 2003, 2005, 2006, 2013, 2055}:
            raise HTTPException(
                status_code=503,
                detail="The backend could not reach the configured MySQL server. Check MYSQL_HOST, MYSQL_PORT, and the MySQL service.",
            ) from exc
        if error_code in {1045, 1698, 1820, 1862, 3118}:
            raise HTTPException(
                status_code=401,
                detail="MySQL rejected this account. Check its current password, account status, and allowed Host entry.",
            ) from exc
        raise HTTPException(
            status_code=503,
            detail=f"MySQL could not complete authentication (error {error_code}). Check the backend terminal for details.",
        ) from exc
    except Exception as exc:
        db.log_activity(
            "Admin Login", "Console Auth",
            "Unexpected error while verifying MySQL administrator privileges",
            "FAILED", client_ip, username,
        )
        raise HTTPException(status_code=503, detail="The backend could not complete MySQL authentication. Check the backend terminal.") from exc

    if not is_admin:
        db.log_activity(
            "Admin Login", "Console Auth",
            "MySQL account authenticated but lacks a direct ALL PRIVILEGES ON *.* grant",
            "FAILED", client_ip, username,
        )
        raise HTTPException(
            status_code=403,
            detail="This MySQL account does not have a direct ALL PRIVILEGES ON *.* grant and cannot access the Admin Console.",
        )

    db.log_activity(
        "Admin Login", "Console Auth",
        "MySQL administrator authenticated with all global privileges",
        "SUCCESS", client_ip, username,
    )
    session_token = issue_session(username, "admin")
    return {
        "success": True,
        "username": username,
        "role": "admin",
        "token": session_token,
        "serverIp": settings.SERVER_IP
    }

# -----------------------------------------------------------------------------
# Dashboard KPI Overview
# -----------------------------------------------------------------------------

@app.post("/api/auth/logout")
def admin_logout(principal: dict = Depends(require_admin)):
    db.log_activity(
        "Admin Logout", "Console Auth", "MySQL administrator signed out",
        performed_by=principal["username"],
    )
    revoke_session(principal)
    return {"success": True}

@app.get("/api/dashboard")
def get_dashboard_overview(principal: dict = Depends(require_admin)):
    users = db.get_all_users()
    databases = db.get_all_databases()
    requests = db.get_all_requests()
    activities = db.get_all_activities()

    active_users = sum(1 for u in users if u['status'] == 'Active')
    inactive_users = sum(1 for u in users if u['status'] == 'Inactive')
    pending_requests = sum(1 for r in requests if r['status'] == 'Pending')

    return {
        "totalUsers": len(users),
        "activeUsers": active_users,
        "inactiveUsers": inactive_users,
        "totalDatabases": len(databases),
        "pendingRequests": pending_requests,
        "users": users,
        "databases": databases,
        "requests": requests,
        "recentActivities": activities[:10]
    }

# -----------------------------------------------------------------------------
# User Management Endpoints
# -----------------------------------------------------------------------------

@app.get("/api/users")
def list_users(principal: dict = Depends(require_admin)):
    return db.get_all_users()

@app.post("/api/users")
def create_user(body: UserCreateRequest, principal: dict = Depends(require_admin)):
    try:
        assigned_db = None
        request_id = None
        if body.dbOption == "existing" and body.selectedDatabase:
            assigned_db = body.selectedDatabase
        elif body.dbOption == "create_own" and body.requestedDatabaseName:
            request_id = db.add_database_request(
                username=body.username,
                requested_db=body.requestedDatabaseName,
                purpose=f"Registration request for {body.fullName}",
                permissions=body.permissions
            )

        user = db.create_user_account(
            full_name=body.fullName,
            username=body.username,
            password=body.password,
            assigned_db=assigned_db,
            permissions=body.permissions,
            can_create_db=body.canCreateDb
        )
        return {"success": True, "user": user, "requestId": request_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/users/{username}")
def update_user(username: str, body: UserUpdateRequest, principal: dict = Depends(require_admin)):
    try:
        db.update_user_account(
            username=username,
            full_name=body.fullName,
            password=body.password,
            assigned_db=body.assignedDatabase,
            permissions=body.permissions,
            can_create_db=body.canCreateDb,
            status=body.status
        )
        return {"success": True, "message": f"User '@{username}' updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.patch("/api/users/{username}/status")
def toggle_status(username: str, principal: dict = Depends(require_admin)):
    try:
        users = db.get_all_users()
        user = next((u for u in users if u['username'] == username), None)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        new_status = "Inactive" if user['status'] == "Active" else "Active"
        db.update_user_account(username=username, status=new_status)
        return {"success": True, "status": new_status}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/users/{username}")
def delete_user(username: str, body: UserDeleteRequest, principal: dict = Depends(require_admin)):
    try:
        db.delete_user_account(username=username, mode=body.deleteMode, actor_username=principal["username"])
        return {"success": True, "message": f"User '@{username}' deleted using mode {body.deleteMode}."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# -----------------------------------------------------------------------------
# Database Management Endpoints
# -----------------------------------------------------------------------------

@app.get("/api/databases")
def list_databases(principal: dict = Depends(require_admin)):
    return db.get_all_databases()

@app.post("/api/databases")
def create_database(body: DatabaseCreateRequest, principal: dict = Depends(require_admin)):
    try:
        result = db.create_database_schema(
            name=body.name,
            charset=body.charset,
            collation=body.collation,
            assigned_username=body.assignedUsername
        )
        return {"success": True, "database": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/databases/{db_name}")
def delete_database(db_name: str, principal: dict = Depends(require_admin)):
    try:
        db.drop_database_schema(db_name)
        return {"success": True, "message": f"Database '{db_name}' dropped successfully."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/databases/assign")
def assign_database(body: DatabaseAssignRequest, principal: dict = Depends(require_admin)):
    try:
        db.grant_permissions(body.username, body.databaseName, body.permissions)
        db.update_user_account(username=body.username, assigned_db=body.databaseName, permissions=body.permissions)
        db.log_activity(
            "Database Assigned", body.databaseName,
            f"Assigned database '{body.databaseName}' to @{body.username}",
            performed_by=principal["username"],
        )
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# -----------------------------------------------------------------------------
# Database Creation Requests
# -----------------------------------------------------------------------------

@app.get("/api/requests")
def list_requests(principal: dict = Depends(require_admin)):
    return db.get_all_requests()

@app.post("/api/requests/{request_id}/approve")
def approve_request(request_id: str, principal: dict = Depends(require_admin)):
    try:
        db.resolve_database_request(request_id, action="approve")
        return {"success": True, "message": f"Request {request_id} approved."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/requests/{request_id}/reject")
def reject_request(request_id: str, body: RequestRejectBody, principal: dict = Depends(require_admin)):
    try:
        db.resolve_database_request(request_id, action="reject", reason=body.reason)
        return {"success": True, "message": f"Request {request_id} rejected."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# -----------------------------------------------------------------------------
# Activity Log Endpoints
# -----------------------------------------------------------------------------

@app.get("/api/activities")
def list_activities(principal: dict = Depends(require_admin)):
    return db.get_all_activities()

# -----------------------------------------------------------------------------
# Settings & Configuration
# -----------------------------------------------------------------------------

@app.get("/api/settings")
def get_settings(principal: dict = Depends(require_admin)):
    mysql_status = db.test_mysql_connection()
    return {
        "serverIp": settings.SERVER_IP,
        "serverPort": settings.SERVER_PORT,
        "mysqlHost": settings.MYSQL_HOST,
        "mysqlPort": settings.MYSQL_PORT,
        "mysqlUser": settings.MYSQL_USER,
        "mysqlConnected": mysql_status["connected"],
        "mysqlVersion": mysql_status["version"]
    }

@app.put("/api/settings")
def update_settings(body: SettingsUpdateRequest, principal: dict = Depends(require_admin)):
    if body.mysqlPassword is not None:
        settings.MYSQL_PASSWORD = body.mysqlPassword
    if body.mysqlUser:
        settings.MYSQL_USER = body.mysqlUser
    if body.mysqlHost:
        settings.MYSQL_HOST = body.mysqlHost
    if body.mysqlPort:
        settings.MYSQL_PORT = body.mysqlPort
    if body.serverIp:
        settings.SERVER_IP = body.serverIp
    db.log_activity(
        "Settings Changed", "System Config",
        "Updated server and database parameters",
        performed_by=principal["username"],
    )
    return {"success": True, "message": "Settings updated"}

app.include_router(admin_client_router)
app.include_router(client_account_router)
app.include_router(client_file_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.SERVER_HOST, port=settings.SERVER_PORT, reload=True)
