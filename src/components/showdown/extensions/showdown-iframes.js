/**
 * SHOWDOWN IFRAMES
 *
 * This extension filters out iframes with src attributes that
 * are not from a trusted source
 */

define(["showdown", "utils/trustedContent"], (showdown, trustedContent) => {

  /**
   * Allowlisted iframe attributes that are safe to forward from the author's
   * markup. Everything else (event handlers, srcdoc, allow, etc.) is dropped.
   */
  const ALLOWED_ATTRS = ["title", "width", "height", "allowfullscreen"];

  /**
   * Regular expression that finds all iframes in the markdown content. The
   * regex captures the full iframe tag, the src attribute, the inner content,
   * and the closing tag, if it exists.
   * @type {RegExp}
   */
  const IFRAME_REGEX =
    /<iframe[^>]*?\bsrc="([^"]*)"[^>]*?>([\s\S]*?)(<\/iframe>)?/g;

  /**
   * Return true when the URL uses the http: or https: scheme. Used to decide
   * whether an untrusted src is safe to render as a plain link.
   * @param {string} url
   * @returns {boolean}
   */
  function isSafeProtocol(url) {
    try {
      const { protocol } = new URL(url);
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }

  /**
   * Extract the value of a single quoted attribute from a raw HTML tag string.
   * @param {string} tag The raw opening tag text.
   * @param {string} name Attribute name.
   * @returns {string|null} Attribute value, or null if absent.
   */
  function extractAttr(tag, name) {
    const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
    return match ? match[1] : null;
  }

  /**
   * Replace iFrames that are NOT from trusted sources with a link to the
   * source URL (or plain text for unsafe protocols). Reconstruct trusted
   * iFrames from an attribute allowlist — dropping event handlers, srcdoc,
  * and any other potentially dangerous attributes — and apply the sandbox
  * permissions resolved from the trusted content source configuration.
   * @param {string} iframe - The full iframe tag
   * @param {string} src - The src attribute of the iframe
   * @returns {string} - The sanitised iframe or fallback markup
   */
  const secureIFrame = (iframe, src) => {
    // Untrusted: render as a safe link for http(s) sources, plain text otherwise
    if (!trustedContent.isTrustedUrl(src)) {
      if (isSafeProtocol(src)) {
        const escaped = src
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return `<a href="${escaped}" target="_blank" rel="noopener noreferrer"><b>External Content</b>: ${escaped}</a>`;
      }
      return "<b>External Content</b>: (URL removed for security)";
    }

    // Trusted: rebuild the tag from the allowlist only
    const sandbox = trustedContent.getTrustedIframeSandbox(src);
    let attrs = `src="${src}"`;
    if (sandbox) {
      attrs += ` sandbox="${sandbox}"`;
    }
    ALLOWED_ATTRS.forEach((name) => {
      const value = extractAttr(iframe, name);
      if (value !== null) {
        const escaped = value
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        attrs += ` ${name}="${escaped}"`;
      }
    });

    return `<iframe ${attrs}></iframe>`;
  };

  const extension = {
    type: "output",
    regex: IFRAME_REGEX,
    replace: secureIFrame,
  };

  showdown.extension("showdown-iframes", () => [extension]);
});
