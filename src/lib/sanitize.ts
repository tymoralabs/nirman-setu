/**
 * File name sanitization (§7.5): strip path characters, control chars,
 * collapse whitespace, cap length. Keeps the extension intact.
 */
export function sanitizeFileName(input: string): string {
  const trimmed = input.trim();
  const lastDot = trimmed.lastIndexOf(".");
  const base = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  const ext = lastDot > 0 ? trimmed.slice(lastDot + 1) : "";

  const clean = (s: string) =>
    s
      // path separators, reserved/special chars, control chars
      .replace(/[\\/:*?"<>|#%&{}$!'@+`=]/g, "_")
      .replace(/\p{Cc}/gu, "") // control chars (incl. 0x00–0x1f, 0x7f)
      .replace(/\s+/g, " ")
      .replace(/^\.+/, "") // no leading dots
      .trim();

  const cleanBase = clean(base).slice(0, 120) || "file";
  const cleanExt = clean(ext).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toLowerCase();

  return cleanExt ? `${cleanBase}.${cleanExt}` : cleanBase;
}
