/**
 * SHOWDOWN IFRAMES
 *
 * This extension filters out iframes with src attributes that
 * are not from a trusted source
 */

define(["showdown", "common/TrustedContentUtilities"], (showdown, trustedContent) => {

  /**
   * Allowlisted iframe attributes that are safe to forward from the author's
   * markup. Everything else (event handlers, srcdoc, allow, etc.) is dropped.
   */
  const ALLOWED_ATTRS = ["title", "width", "height", "allowfullscreen"];
  const EXTERNAL_CONTENT_LABEL = "<b>External Content</b>:";
  const REMOVED_URL_MESSAGE = "(URL removed for security)";

  /**
   * Regular expression that finds all iframes in the markdown content. The
   * regex captures the full iframe tag, the src attribute, the inner content,
   * and the closing tag, if it exists.
   * @type {RegExp}
   */
  const IFRAME_REGEX =
    /<iframe[^>]*?\bsrc="([^"]*)"[^>]*?>([\s\S]*?)(<\/iframe>)?/g;

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

  /** Escape text for HTML and quoted attributes */
  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /**
   * Embed a trusted URL with its configured sandbox and permitted attributes.
   * Use a link for untrusted HTTP(S) URLs and warning text for other URLs.
   * @param {string} iframe The matched iframe tag
   * @param {string} rawSrc The src attribute as written in the HTML
   * @returns {string} The iframe, fallback link, or warning text
   */
  const secureIFrame = (iframe, rawSrc) => {
    // Check the decoded attribute value the browser would load.
    const template = document.createElement("template");
    template.innerHTML = `<a href="${rawSrc}"></a>`;
    const src = template.content.firstElementChild.getAttribute("href");
    const escapedSrc = escapeHtml(src);

    const sandbox = trustedContent.getTrustedIframeSandbox(src);
    if (sandbox === null) {
      if (trustedContent.isHttpUrl(src)) {
        return `<a href="${escapedSrc}" target="_blank" rel="noopener noreferrer">${EXTERNAL_CONTENT_LABEL} ${escapedSrc}</a>`;
      }
      return `${EXTERNAL_CONTENT_LABEL} ${REMOVED_URL_MESSAGE}`;
    }

    let attrs = `src="${escapedSrc}"`;
    if (sandbox) {
      attrs += ` sandbox="${sandbox}"`;
    }
    ALLOWED_ATTRS.forEach((name) => {
      const value = extractAttr(iframe, name);
      if (value !== null) {
        attrs += ` ${name}="${escapeHtml(value)}"`;
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
