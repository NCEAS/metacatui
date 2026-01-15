define([], () => {
  /**
   * Encode each segment of a URL path, preserving slashes. This should only be
   * used on the path portion of a URL, not the full URL.
   * @param {string} path The URL path to encode, e.g. "/object/pid:12345"
   * @returns {string} The encoded path, e.g. "/object/pid%3A12345"
   */
  const encodePathSegments = (path = "") => {
    if (!path) return "";
    // No support for query strings or hashes yet, encoding might break them
    if (path.includes("?") || path.includes("#")) {
      throw new Error(
        "encodePathSegments does not support query strings or hashes",
      );
    }
    return path
      .split("/")
      .map((segment) => {
        if (segment === "") return "";
        try {
          // Avoid double-encoding: decode what we can, then re-encode
          return encodeURIComponent(decodeURIComponent(segment));
        } catch (e) {
          return encodeURIComponent(segment);
        }
      })
      .join("/");
  };

  /**
   * Correct leading and trailing slashes on a path.
   * @param {string} path The URL path to correct
   * @param {boolean} [leadingSlash] Whether to ensure a leading slash
   * @param {boolean} [trailingSlash] Whether to ensure a trailing slash
   * @returns {string} The corrected path
   */
  const correctSlashes = (path, leadingSlash = false, trailingSlash = true) => {
    let correctedPath = path;
    const slashRegex = /^\/*|\/*$/g;
    // First remove all leading and trailing slashes
    correctedPath = correctedPath.replace(slashRegex, "");
    // Then add back the leading slash if needed
    if (leadingSlash) {
      correctedPath = `/${correctedPath}`;
    }
    // Then add back the trailing slash if needed
    if (trailingSlash) {
      correctedPath = `${correctedPath}/`;
    }
    return correctedPath;
  };

  /**
   * Build a full URL from base, path, and query parameters.
   * @param {string} baseUrl Base URL
   * @param {string} path Path relative to base URL
   * @param {boolean} encodePath Whether to URL-encode path segments
   * @returns {string} Full URL
   */
  const buildUrl = (baseUrl = "", path = "", encodePath = true) => {
    const normalizedPath = path.trim() || "";
    const normalizedBaseUrl = baseUrl.trim() || window.location?.origin || "";
    // BaseURL must end with a slash for URL to treat path as relative
    const correctedBaseUrl = correctSlashes(normalizedBaseUrl, false, true);

    // If no path, return base URL without trailing slash, otherwise URL will
    // resolve to the domain root
    if (!normalizedPath) {
      return correctedBaseUrl.replace(/\/$/, "");
    }

    const encodedPath = encodePath
      ? encodePathSegments(normalizedPath)
      : normalizedPath;

    // The path needs a slash at the start to be treated as relative to the base
    // URL, and no trailing slash so that URL handles it correctly.
    const correctedPath = correctSlashes(encodedPath, false, true);

    // Create a string and then remove trailing slash
    const url = new URL(correctedPath, correctedBaseUrl);
    return url.toString().replace(/\/$/, "");
  };

  return { encodePathSegments, correctSlashes, buildUrl };
});
