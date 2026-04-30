from __future__ import annotations

import html
import re
import unicodedata
from urllib.parse import urlparse, urlunparse

_SCRIPT_STYLE_RE = re.compile(r"(?is)<\s*(script|style)[^>]*>.*?<\s*/\s*\1\s*>")
_HTML_TAG_RE = re.compile(r"(?is)<[^>]+>")
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_INLINE_SPACE_RE = re.compile(r"[ \t\f\v]+")
_EXTRA_NEWLINES_RE = re.compile(r"\n{3,}")


def sanitize_text(
    value: object,
    *,
    max_length: int | None = None,
    preserve_newlines: bool = True,
) -> str | None:
    if value is None:
        return None

    text = unicodedata.normalize("NFKC", str(value))
    text = html.unescape(text)
    text = _SCRIPT_STYLE_RE.sub(" ", text)
    text = _HTML_TAG_RE.sub(" ", text)
    text = _CONTROL_CHAR_RE.sub("", text)

    if preserve_newlines:
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = _INLINE_SPACE_RE.sub(" ", text)
        text = _EXTRA_NEWLINES_RE.sub("\n\n", text)
    else:
        text = re.sub(r"\s+", " ", text)

    cleaned = text.strip()
    if not cleaned:
        return None

    if max_length is not None and max_length > 0:
        cleaned = cleaned[:max_length].rstrip()
        if not cleaned:
            return None

    return cleaned


def sanitize_external_url(value: object) -> str | None:
    normalized = sanitize_text(value, max_length=2048, preserve_newlines=False)
    if not normalized:
        return None

    parsed = urlparse(normalized)
    scheme = parsed.scheme.lower()
    if scheme not in {"http", "https"}:
        return None
    if not parsed.netloc:
        return None

    return urlunparse(
        (
            scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            parsed.query,
            parsed.fragment,
        )
    )
