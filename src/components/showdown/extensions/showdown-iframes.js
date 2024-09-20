/**
 * SHOWDOWN IFRAMES
 *
 * This extension filters out iframes with src attributes that
 * are not from a trusted source
 */

/** List of trusted URL patterns */
const TRUSTED_SOURCES = MetacatUI.appModel.get("trustedContentSources") || [];

/**
 * The sandbox to add to iframes from trusted sources. This allows the iframe
 * some capabilities, such as running scripts and accessing it's own origin.
 */
const SANDBOX = `sandbox="allow-scripts allow-same-origin"`;

/**
 * Regular expression that finds all iframes in the markdown content. The regex
 * captures the full iframe tag, the src attribute, the inner content, and the
 * closing tag, if it exists.
 * @type {RegExp}
 */
const IFRAME_REGEX =
  /<iframe[^>]*?\bsrc="([^"]*)"[^>]*?>([\s\S]*?)(<\/iframe>)?/g;

/**
 * Function to convert URL patterns with wildcards to regex patterns.
 * @param {string} wildcardPattern - The URL pattern with wildcards
 * @returns {RegExp} - The regex pattern
 */
function patternToRegex(wildcardPattern) {
  // Extract protocol if specified
  let protocol = "";
  let pattern = wildcardPattern;
  const protocolMatch = pattern.match(/^(https?:\/\/)/);
  if (protocolMatch) {
    [, protocol] = protocolMatch;
    pattern = wildcardPattern.slice(protocol.length);
  }

  // Escape special regex characters except for '*'
  let escapedPattern = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");
  // Replace '*' with '.*'
  escapedPattern = escapedPattern.replace(/\*/g, ".*");
  // Escape the protocol
  const escapedProtocol = protocol.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");
  // Build the full regex pattern
  const regexString = `^${escapedProtocol}${escapedPattern}$`;

  return new RegExp(regexString, "i"); // Case-insensitive matching
}

/**
 * Check if a URL is valid according to the trusted sources. Trusted sources may
 * use wildcards (*) to match multiple URLs. For example, the trusted source
 * "https://*dataone.org/*" will match any URL that starts with "https://",
 * contains "dataone.org", and ends with a path. The trusted source
 * "*arcticdata.io*" will match any URL that contains "arcticdata.io". It could
 * also include wildcards at any position, such as
 * "*arcticdata.io/*\/something".
 * @param {string} url - The URL to check
 * @returns {boolean} - True if the URL is trusted, false otherwise
 */
function isTrustedUrl(url) {
  if (!TRUSTED_SOURCES?.length) return false;

  try {
    const urlObj = new URL(url);
    if (!urlObj.protocol.startsWith("http")) {
      return false;
    }
  } catch (e) {
    return false;
  }

  // Check if the URL matches any of the trusted sources
  for (let i = 0; i < TRUSTED_SOURCES.length; i += 1) {
    const pattern = TRUSTED_SOURCES[i];
    const regex = patternToRegex(pattern);

    if (regex.test(url)) {
      return true;
    }
  }

  return false;
}

/**
 * Replace iFrames that are NOT from trusted sources with a link to the source
 * URL. Make the iFrames from trusted sources secure by adding the 'sandbox'
 * attribute, which restricts the iframe's capabilities. Remove any inner
 * content from the iframe.
 * @param {string} iframe - The full iframe tag
 * @param {string} src - The src attribute of the iframe
 * @param {string} _innerContent - The inner content of the iframe tag
 * @param {string} closingTag - The closing iframe tag
 * @param {number} _index - The index of the match
 * @param {string} _markdown - The full markdown content
 * @returns {string} - The secure iframe tag
 */
const secureIFrame = (
  iframe,
  src,
  _innerContent,
  closingTag,
  _index,
  _markdown,
) => {
  // Return as a link instead of an iframe if the source is not trusted
  if (!isTrustedUrl(src)) {
    return `<a href="${src}" target="_blank" rel="noopener noreferrer"><b>External Content</b>: ${src}</a>`;
  }

  // Find the position of the first '>' that ends the opening iframe tag
  const openingTagEndIndex = iframe.indexOf(">");

  // Add the 'sandbox' attr and strip out any inner content
  if (openingTagEndIndex !== -1) {
    // Extract the opening tag
    let openingTag = iframe.slice(0, openingTagEndIndex);

    // Ensure 'sandbox' attribute exists with the correct value
    if (!/\bsandbox=/.test(openingTag)) {
      // Add the 'sandbox' attribute
      openingTag += ` ${SANDBOX}`;
    } else {
      // Update the existing 'sandbox' attribute to have the correct value
      openingTag = openingTag.replace(/\bsandbox="[^"]*"/, SANDBOX);
    }

    // Close the opening tag
    openingTag += ">";

    let newIframe;
    if (closingTag) {
      // Reconstruct the iframe without inner content and include the closing tag
      newIframe = `${openingTag}${closingTag}`;
    } else {
      // If there is no closing tag, self-close the iframe
      newIframe = openingTag.replace(">", " />");
    }

    return newIframe;
  }

  // If the iframe tag is malformed and doesn't contain '>', return it as is
  return iframe;
};

const extension = {
  type: "output",
  regex: IFRAME_REGEX,
  replace: secureIFrame,
};

define(["showdown"], (showdown) => {
  showdown.extension("showdown-iframes", () => [extension]);
});
