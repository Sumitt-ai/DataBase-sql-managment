import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

class Settings:
    SERVER_HOST: str = os.getenv("SERVER_HOST", "0.0.0.0")
    SERVER_PORT: int = int(os.getenv("SERVER_PORT", "8000"))
    SERVER_IP: str = os.getenv("SERVER_IP", "172.20.10.3")

    # Backend service credentials, separate from interactive administrator sign-in.
    MYSQL_HOST: str = os.getenv("MYSQL_HOST", "127.0.0.1")
    MYSQL_PORT: int = int(os.getenv("MYSQL_PORT", "3306"))
    MYSQL_USER: str = os.getenv("MYSQL_USER", "")
    MYSQL_PASSWORD: str = os.getenv("MYSQL_PASSWORD", "")

    # Separate application metadata schema for Client Portal accounts and files.
    CLIENT_METADATA_SCHEMA: str = os.getenv("CLIENT_METADATA_SCHEMA", "mysql_admin_portal")
    CLIENT_STORAGE_ROOT: str = os.getenv("CLIENT_STORAGE_ROOT", "client_storage")
    CLIENT_MAX_UPLOAD_MB: int = int(os.getenv("CLIENT_MAX_UPLOAD_MB", "25"))
    CORS_ORIGIN_REGEX: str = os.getenv("CORS_ORIGIN_REGEX", r"^https?://[^/:]+:5173$")

    SECRET_KEY: str = os.getenv("SECRET_KEY", "mysql-admin-console-secret")

settings = Settings()
