"""Unit tests for app.core.sanitization — text and URL sanitisation."""

import pytest

from app.core.sanitization import sanitize_external_url, sanitize_text


# ── sanitize_text ───────────────────────────────────────────────────


class TestSanitizeText:
    """Core text sanitisation pipeline."""

    def test_returns_none_for_none(self):
        assert sanitize_text(None) is None

    def test_returns_none_for_empty_string(self):
        assert sanitize_text("") is None

    def test_returns_none_for_whitespace_only(self):
        assert sanitize_text("   \t\n  ") is None

    def test_strips_html_tags(self):
        result = sanitize_text("<p>hello</p>")
        assert "<p>" not in result
        assert "hello" in result

    def test_strips_script_tags_and_content(self):
        result = sanitize_text("safe<script>alert('xss')</script>text")
        assert "alert" not in result
        assert "safe" in result
        assert "text" in result

    def test_strips_style_tags_and_content(self):
        result = sanitize_text("before<style>body{display:none}</style>after")
        assert "display" not in result
        assert "before" in result
        assert "after" in result

    def test_removes_control_characters(self):
        result = sanitize_text("hello\x00\x01\x02world")
        assert result == "helloworld"

    def test_unescapes_html_entities(self):
        # &lt; and &gt; unescape to < and > which the HTML-tag regex then strips
        result = sanitize_text("&amp; &lt; &gt;")
        assert result == "&"

    def test_preserves_newlines_by_default(self):
        result = sanitize_text("line1\nline2\nline3")
        assert "\n" in result
        assert "line1" in result

    def test_collapses_excessive_newlines(self):
        result = sanitize_text("a\n\n\n\n\nb")
        assert result == "a\n\nb"

    def test_no_newlines_when_preserve_is_false(self):
        result = sanitize_text("line1\nline2", preserve_newlines=False)
        assert "\n" not in result

    def test_truncates_to_max_length(self):
        result = sanitize_text("a" * 200, max_length=50)
        assert len(result) <= 50

    def test_max_length_returns_none_if_result_empty(self):
        result = sanitize_text("   ", max_length=10)
        assert result is None

    def test_normalises_unicode_nfkc(self):
        # ﬁ (fi ligature, U+FB01) should normalise to "fi"
        result = sanitize_text("ﬁnd")
        assert result == "find"

    def test_converts_crlf_to_lf(self):
        result = sanitize_text("hello\r\nworld")
        assert "\r" not in result
        assert "hello\nworld" == result

    def test_coerces_non_string_to_string(self):
        result = sanitize_text(42)
        assert result == "42"


# ── sanitize_external_url ───────────────────────────────────────────


class TestSanitizeExternalUrl:
    """URL validation and normalisation."""

    def test_valid_https_url_passes(self):
        url = "https://example.com/path?q=1"
        assert sanitize_external_url(url) == url

    def test_valid_http_url_passes(self):
        url = "http://example.com"
        assert sanitize_external_url(url) == url

    def test_rejects_javascript_scheme(self):
        assert sanitize_external_url("javascript:alert(1)") is None

    def test_rejects_data_scheme(self):
        assert sanitize_external_url("data:text/html,<h1>hi</h1>") is None

    def test_rejects_ftp_scheme(self):
        assert sanitize_external_url("ftp://files.example.com/doc.pdf") is None

    def test_rejects_empty(self):
        assert sanitize_external_url("") is None

    def test_rejects_none(self):
        assert sanitize_external_url(None) is None

    def test_rejects_no_netloc(self):
        assert sanitize_external_url("https://") is None

    def test_truncates_very_long_urls(self):
        long_url = "https://example.com/" + "a" * 3000
        result = sanitize_external_url(long_url)
        # Should be truncated to max_length=2048 before parsing
        assert result is None or len(result) <= 2048

    def test_normalises_scheme_case(self):
        result = sanitize_external_url("HTTPS://Example.Com/Path")
        assert result.startswith("https://")
