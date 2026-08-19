from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from ..core.deps import get_current_user
from ..models.user import User
from ..services.upload_service import (
    MAX_IMAGES_PER_EXPENSE,
    save_expense_image,
)

router = APIRouter(prefix="/uploads", tags=["Uploads"])


@router.post("/images")
async def upload_images(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload expense images and return public URLs."""
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files uploaded",
        )
    if len(files) > MAX_IMAGES_PER_EXPENSE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {MAX_IMAGES_PER_EXPENSE} images per upload.",
        )

    urls = [await save_expense_image(file, current_user.id) for file in files]
    return {"urls": urls}
