from typing import Any, Literal, Optional, List
from pydantic import BaseModel, Field

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreateRequest(BaseModel):
    fullName: str
    username: str
    password: str
    dbOption: str = "existing" # 'existing' | 'create_own'
    selectedDatabase: Optional[str] = None
    requestedDatabaseName: Optional[str] = None
    permissions: str = "READ & WRITE" # 'READ ONLY' | 'WRITE ONLY' | 'READ & WRITE'
    canCreateDb: bool = False

class UserUpdateRequest(BaseModel):
    fullName: Optional[str] = None
    password: Optional[str] = None
    assignedDatabase: Optional[str] = None
    permissions: Optional[str] = None
    canCreateDb: Optional[bool] = None
    status: Optional[str] = None

class UserDeleteRequest(BaseModel):
    deleteMode: str # 'ACCOUNT_ONLY' | 'ACCOUNT_AND_DATABASE'

class DatabaseCreateRequest(BaseModel):
    name: str
    charset: str = "utf8mb4"
    collation: str = "utf8mb4_unicode_ci"
    assignedUsername: Optional[str] = None

class DatabaseAssignRequest(BaseModel):
    databaseName: str
    username: str
    permissions: str = "READ & WRITE"

class RequestRejectBody(BaseModel):
    reason: Optional[str] = "Administrative discretion"

class SettingsUpdateRequest(BaseModel):
    serverIp: Optional[str] = None
    mysqlHost: Optional[str] = None
    mysqlPort: Optional[int] = None
    mysqlUser: Optional[str] = None
    mysqlPassword: Optional[str] = None


ClientPermission = Literal["upload", "edit", "download", "recycle", "restore"]


class ClientCreateRequest(BaseModel):
    clientName: str = Field(min_length=1, max_length=160)
    username: str = Field(min_length=3, max_length=32)
    permissions: List[ClientPermission] = Field(default_factory=lambda: ["upload", "edit", "download", "recycle", "restore"])


class ClientStatusRequest(BaseModel):
    isActive: bool


class ClientPermissionsRequest(BaseModel):
    permissions: List[ClientPermission] = Field(default_factory=list)


class ClientProfileRequest(BaseModel):
    clientName: str = Field(min_length=1, max_length=160)


class ClientFolderCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    parentId: Optional[str] = None


class ClientTextFileCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    content: str = ""
    folderId: Optional[str] = None


class ClientTextFileUpdateRequest(BaseModel):
    content: str


class WorkbookSheet(BaseModel):
    name: str = Field(min_length=1, max_length=31)
    rows: List[List[Any]]


class WorkbookSaveRequest(BaseModel):
    sheets: List[WorkbookSheet] = Field(min_length=1, max_length=20)
