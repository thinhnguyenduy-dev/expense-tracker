"""Helpers for storing and validating expense image uploads."""
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import HTTPException, UploadFile, status

from ..core.config import settings

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}
CONTENT_TYPE_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_IMAGES_PER_EXPENSE = 5

def get_upload_root() -> Path:
    path = Path(settings.UPLOAD_DIR)
    if not path.is_absolute():
        path = Path(__file__).resolve().parent.parent.parent / path
    path.mkdir(parents=True, exist_ok=True)
    return path.resolve()


def _public_url(relative_path: str) -> str:
    return f"/uploads/{relative_path}"


async def save_expense_image(file: UploadFile, user_id: int) -> str:
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image type. Use JPEG, PNG, WebP, or GIF.",
        )

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        suffix = CONTENT_TYPE_TO_EXT.get(content_type, ".jpg")

    dest_dir = get_upload_root() / "expenses" / str(user_id)
    dest_dir.mkdir(parents=True, exist_ok=True)

    dest = dest_dir / f"{uuid.uuid4().hex}{suffix}"
    size = 0
    try:
        with dest.open("wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_IMAGE_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Image is too large (max 5MB).",
                    )
                buffer.write(chunk)
    except HTTPException:
        dest.unlink(missing_ok=True)
        raise
    except Exception:
        dest.unlink(missing_ok=True)
        raise

    return _public_url(f"expenses/{user_id}/{dest.name}")


def delete_uploaded_file(public_path: str) -> None:
    if not public_path or not public_path.startswith("/uploads/"):
        return
    if ".." in public_path:
        return

    relative = public_path[len("/uploads/") :]
    root = get_upload_root().resolve()
    path = (root / relative).resolve()
    try:
        path.relative_to(root)
    except ValueError:
        return
    if path.is_file():
        path.unlink()


def delete_uploaded_files(public_paths: Optional[List[str]]) -> None:
    for path in public_paths or []:
        delete_uploaded_file(path)


def validate_expense_image_urls(urls: Optional[List[str]], user_id: int) -> List[str]:
    if not urls:
        return []
    if len(urls) > MAX_IMAGES_PER_EXPENSE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {MAX_IMAGES_PER_EXPENSE} images per expense.",
        )

    prefix = f"/uploads/expenses/{user_id}/"
    cleaned: List[str] = []
    for url in urls:
        if not isinstance(url, str) or not url.startswith(prefix) or ".." in url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid image path",
            )
        cleaned.append(url)
    return cleaned
