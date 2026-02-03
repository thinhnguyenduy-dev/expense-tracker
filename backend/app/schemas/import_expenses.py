from pydantic import BaseModel
from typing import List, Optional

class ImportError(BaseModel):
    row: int
    error: str
    data: Optional[dict] = None

class ImportResult(BaseModel):
    success_count: int
    failed_count: int
    errors: List[ImportError] = []
    message: str
