define([], () => {
  /**
   * Convert a URL pattern with wildcards to a RegExp.
   * The protocol (if present) is extracted and escaped separately so that
   * "https://" in a pattern only matches HTTPS URLs, not HTTP.
   * @param {string} wildcardPattern The pattern, which may include "*" wildcards.
   * @returns {RegExp} Case-insensitive regex that matches the full URL.
   */
  function patternToRegex(wildcardPattern) {
    let protocol = "";
    let pattern = wildcardPattern;
    const protocolMatch = pattern.match(/^(https?:\/\/)/);
    if (protocolMatch) {
      [, protocol] = protocolMatch;
      pattern = wildcardPattern.slice(protocol.length);
    }

    const escapedPattern = pattern
      .replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&")
      .replace(/\*/g, ".*");
    const escapedProtocol = protocol.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");
    return new RegExp(`^${escapedProtocol}${escapedPattern}$`, "i");
  }

  /**
   * Test whether a URL is trusted according to the app's
   * `trustedContentSources` configuration.
   *
   * A URL is trusted when all of the following hold:
   * - `trustedContentSources` is non-empty
   * - The URL is syntactically valid
   * - The URL uses the `http:` or `https:` protocol
   * - The URL matches at least one `trustedContentSources` pattern
   * @param {string} url The URL to test.
   * @returns {boolean} `true` when the URL is trusted.
   */
  function isTrustedUrl(url) {
    const sources = MetacatUI?.appModel?.get("trustedContentSources") ?? [];
    if (!sources.length) return false;

    try {
      const { protocol } = new URL(url);
      if (protocol !== "http:" && protocol !== "https:") return false;
    } catch {
      return false;
    }

    return sources.some((pattern) => patternToRegex(pattern).test(url));
  }

  return isTrustedUrl;
});
