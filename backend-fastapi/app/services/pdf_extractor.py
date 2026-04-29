import fitz


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
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
