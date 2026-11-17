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

  /** Match sanitized iframe tags with a src attribute */
  const IFRAME_REGEX = /<iframe[^>]*?\bsrc="[^"]*"[^>]*?>(?:<\/iframe>)?/g;

  /**
   * Embed a trusted URL with the source's sandbox and browser permissions.
   * Use a link for untrusted HTTP(S) URLs and warning text for other URLs.
   * @param {string} tag The matched iframe tag
   * @returns {string} The iframe, fallback link, or warning text
   */
  const secureIFrame = (tag) => {
    // Parse the tag in an inert template to read the decoded attributes.
    const template = document.createElement("template");
    template.innerHTML = tag;
    const original = template.content.firstElementChild;
    const src = original.getAttribute("src");
    const iframe = document.createElement("iframe");

    if (!trustedContent.configureTrustedIframe(iframe, src)) {
      if (!trustedContent.isHttpUrl(src)) {
        return `${EXTERNAL_CONTENT_LABEL} ${REMOVED_URL_MESSAGE}`;
      }
      const link = document.createElement("a");
      link.href = src;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.innerHTML = EXTERNAL_CONTENT_LABEL;
      link.append(` ${src}`);
      return link.outerHTML;
    }

    ALLOWED_ATTRS.forEach((name) => {
      const value = original.getAttribute(name);
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
