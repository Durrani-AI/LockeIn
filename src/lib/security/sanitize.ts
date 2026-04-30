const SCRIPT_OR_STYLE_RE = /<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const HTML_TAG_RE = /<[^>]+>/g;
const CONTROL_CHAR_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizePlainText(value: string, maxLength = 2000): string {
  const normalized = value.normalize("NFKC");
  const withoutScripts = normalized.replace(SCRIPT_OR_STYLE_RE, " ");
  const withoutTags = withoutScripts.replace(HTML_TAG_RE, " ");
  const withoutControlChars = withoutTags.replace(CONTROL_CHAR_RE, "");
  const compacted = withoutControlChars
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return compacted.slice(0, maxLength).trim();
}

export function sanitizeSingleLine(value: string, maxLength = 180): string {
  return sanitizePlainText(value, maxLength).replace(/\s+/g, " ").trim();
}

export function sanitizeExternalUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = sanitizeSingleLine(value, 2048);
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
