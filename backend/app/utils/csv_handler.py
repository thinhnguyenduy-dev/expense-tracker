
import csv
import io
from typing import List, Dict, Any, Type
from datetime import datetime

def generate_csv(data: List[Dict[str, Any]], fieldnames: List[str] = None) -> str:
    """
    Generates a CSV string from a list of dictionaries.
    If fieldnames is not provided, it infers them from the first item.
    """
    if not data:
        return ""
    
    if not fieldnames:
        fieldnames = list(data[0].keys())

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    
    for row in data:
        # Simple formatting for dates, etc could go here if needed
        writer.writerow(row)
        
    return output.getvalue()

def parse_csv(file_content: bytes) -> List[Dict[str, Any]]:
    """
    Parses CSV bytes into a list of dictionaries.
    """
    decoded = file_content.decode('utf-8')
    input_io = io.StringIO(decoded)
    reader = csv.DictReader(input_io)
    return list(reader)
