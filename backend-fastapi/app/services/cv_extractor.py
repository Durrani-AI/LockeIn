from __future__ import annotations

import os

import fitz

from docx import Document


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from a PDF file using PyMuPDF (fitz)."""
    if not pdf_bytes:
        raise ValueError("Could not download CV file")

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:  # pragma: no cover - library-specific parse errors
        raise ValueError("Could not parse CV file") from exc

    chunks: list[str] = []
    for page in doc:
        chunks.append(page.get_text("text"))

    full_text = "\n".join(chunks)
    cleaned = full_text.replace(" \n", "\n").strip()

    while "\n\n\n" in cleaned:
        cleaned = cleaned.replace("\n\n\n", "\n\n")

    if not cleaned:
        raise ValueError("CV text is empty after extraction")

    return cleaned


def extract_text_from_docx(docx_bytes: bytes) -> str:
    """Extract text from a Word (.docx) file using python-docx."""
    if not docx_bytes:
        raise ValueError("Could not download CV file")

    try:
        from io import BytesIO
        doc = Document(BytesIO(docx_bytes))
    except Exception as exc:  # pragma: no cover - library-specific parse errors
        raise ValueError("Could not parse CV file") from exc

    chunks: list[str] = []
    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()
        if text:
            chunks.append(text)

    # Also extract text from tables (common in CV templates)
    for table in doc.tables:
        for row in table.rows:
            row_texts = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if row_texts:
                chunks.append("  ".join(row_texts))

    full_text = "\n".join(chunks)
    cleaned = full_text.replace(" \n", "\n").strip()

    while "\n\n\n" in cleaned:
        cleaned = cleaned.replace("\n\n\n", "\n\n")

    if not cleaned:
        raise ValueError("CV text is empty after extraction")

    return cleaned


# Supported MIME types and their corresponding extractors
_SUPPORTED_EXTENSIONS = {".pdf", ".docx"}


def extract_cv_text(file_bytes: bytes, filename: str) -> str:
    """Route to the correct extractor based on file extension.

    Raises ValueError for unsupported file types or extraction failures.
    """
    ext = os.path.splitext(filename.lower())[1]

    if ext == ".pdf":
        return extract_text_from_pdf(file_bytes)
    elif ext == ".docx":
        return extract_text_from_docx(file_bytes)
    else:
        raise ValueError(
            f"Unsupported file type '{ext}'. Please upload a PDF or Word (.docx) file."
        )
