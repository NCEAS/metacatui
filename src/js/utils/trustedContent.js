define([], () => {
  const DEFAULT_PERMISSIONS = ["allow-scripts"];

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
   * Normalize a trusted content source entry to a consistent shape.
   * @param {string|{url: string, permissions: (string[]|undefined)}} source Source entry from configuration.
   * @returns {{url: string, permissions: string[]}|null} Normalized source object or null when invalid.
   */
  function normalizeTrustedContentSource(source) {
    if (typeof source === "string") {
      return { url: source, permissions: DEFAULT_PERMISSIONS };
    }

    if (
      !source ||
      typeof source !== "object" ||
      typeof source.url !== "string"
    ) {
      return null;
    }

    return {
      url: source.url,
      permissions:
        Array.isArray(source.permissions) && source.permissions.length
          ? source.permissions
          : DEFAULT_PERMISSIONS,
    };
  }

  /**
   * Resolve the trusted content source entry that matches the given URL.
   * @param {string} url The URL to test.
   * @returns {{url: string, permissions: string[]}|null} Matching trusted source entry, or null when no match is found.
   */
  function getTrustedContentSource(url) {
    const sources = MetacatUI?.appModel?.get("trustedContentSources") ?? [];
    if (!sources.length) return null;

    try {
      const { protocol } = new URL(url);
      if (protocol !== "http:" && protocol !== "https:") return null;
    } catch {
      return null;
    }

    const matchedSource = sources
      .map(normalizeTrustedContentSource)
      .find(
        (normalized) => normalized && patternToRegex(normalized.url).test(url),
      );

    return matchedSource ?? null;
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
    return getTrustedContentSource(url) !== null;
  }

  /**
   * Resolve the sandbox permissions for a trusted iframe URL.
   * @param {string} url The URL to test.
   * @returns {string|null} The sandbox permissions string, or null when untrusted.
   */
  function getTrustedIframeSandbox(url) {
    const trustedContentSource = getTrustedContentSource(url);
    if (!trustedContentSource) return null;

    return trustedContentSource.permissions.join(" ");
  }

  return {
    DEFAULT_PERMISSIONS,
    getTrustedContentSource,
    getTrustedIframeSandbox,
    isTrustedUrl,
  };
});
