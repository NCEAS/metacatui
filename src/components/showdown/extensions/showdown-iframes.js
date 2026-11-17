/**
 * SHOWDOWN IFRAMES
 *
 * This extension filters out iframes with src attributes that
 * are not from a trusted source
 */

define(["showdown", "common/TrustedContentUtilities"], (showdown, trustedContent) => {

  /** Presentation attributes to keep from the author's iframe */
  const ALLOWED_ATTRS = ["title", "width", "height"];
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

  /**
   * Embed a trusted URL with the source's sandbox and browser permissions.
   * Use a link for untrusted HTTP(S) URLs and warning text for other URLs.
   * @param {string} tag The matched iframe tag
   * @param {string} rawSrc The src attribute as written in the HTML
   * @returns {string} The iframe, fallback link, or warning text
   */
  const secureIFrame = (tag, rawSrc) => {
    // Check the decoded attribute value the browser would load.
    const template = document.createElement("template");
    template.innerHTML = `<a href="${rawSrc}"></a>`;
    const link = template.content.firstElementChild;
    const src = link.getAttribute("href");
    const iframe = document.createElement("iframe");

    if (!trustedContent.configureTrustedIframe(iframe, src)) {
      if (!trustedContent.isHttpUrl(src)) {
        return `${EXTERNAL_CONTENT_LABEL} ${REMOVED_URL_MESSAGE}`;
      }
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.innerHTML = EXTERNAL_CONTENT_LABEL;
      link.append(` ${src}`);
      return link.outerHTML;
    }

    ALLOWED_ATTRS.forEach((name) => {
      const value = extractAttr(tag, name);
      if (value !== null) {
        iframe.setAttribute(name, value);
      }
    });

    return iframe.outerHTML;
  };

  const extension = {
    type: "output",
    regex: IFRAME_REGEX,
    replace: secureIFrame,
  };

  showdown.extension("showdown-iframes", () => [extension]);
});
