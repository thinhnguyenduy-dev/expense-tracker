from fastapi import APIRouter, UploadFile, File, HTTPException, status
from typing import Optional
import re
from datetime import datetime
import shutil
import os
import tempfile
from pydantic import BaseModel

try:
    from PIL import Image
    import pytesseract
except ImportError:
    Image = None
    pytesseract = None

router = APIRouter(prefix="/ocr", tags=["OCR"])

class ScanResult(BaseModel):
    amount: Optional[float] = None
    date: Optional[str] = None
    merchant: Optional[str] = None
    text: Optional[str] = None

def extract_amount(text: str) -> Optional[float]:
    # Look for currency symbols or just numbers with 2 decimals
    # Matches: $10.00, 10.00, 1,200.50
    matches = re.findall(r'[$€£¥]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)', text)
    if not matches:
        return None
    
    # Clean and convert matches to float, return the largest one usually
    amounts = []
    for match in matches:
        try:
            val = float(match.replace(',', ''))
            amounts.append(val)
        except ValueError:
            continue
            
    return max(amounts) if amounts else None

def extract_date(text: str) -> Optional[str]:
    # Matches: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
    # Simplistic regex, can be improved
    date_patterns = [
        r'\d{4}-\d{2}-\d{2}',
        r'\d{2}/\d{2}/\d{4}',
        r'\d{2}-\d{2}-\d{4}'
    ]
    
    for pattern in date_patterns:
        match = re.search(pattern, text)
        if match:
            # Try to standardize to YYYY-MM-DD
            d_str = match.group(0)
            try:
                if '-' in d_str and len(d_str.split('-')[0]) == 4:
                    return d_str # Already YYYY-MM-DD
                
                # Parse others using dateutil or datetime
                # For now just return raw string or simple assumption
                return d_str
            except:
                pass
                
    return None

@router.post("/scan", response_model=ScanResult)
async def scan_receipt(file: UploadFile = File(...)):
    if not pytesseract:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="OCR dependencies not installed on server"
        )

    # Save temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp:
        shutil.copyfileobj(file.file, temp)
        temp_path = temp.name

    try:
        # Perform OCR
        try:
            image = Image.open(temp_path)
            text = pytesseract.image_to_string(image)
        except pytesseract.TesseractNotFoundError:
             raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Tesseract OCR engine not found on server. Please install tesseract-ocr."
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"OCR failed: {str(e)}"
            )
            
        # Extract data
        amount = extract_amount(text)
        date_str = extract_date(text)
        
        return ScanResult(
            amount=amount,
            date=date_str,
            text=text[:500] # Debug info
        )
        
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
