define([], () => {
  const DEFAULT_PERMISSIONS = ["allow-scripts", "allow-same-origin"];

  /**
   * @namespace TrustedContentUtilities
   * @description Utility functions for working with trusted content sources specified
   * by a theme's AppConfig and used by the showdown iframe embedding and visualization
   * panel.
   * @type {object}
   * @since 0.0.0
   */
  const TrustedContentUtilities =
    /** @lends TrustedContentUtilities.prototype */ {
      DEFAULT_PERMISSIONS,

      /**
       * Get the default iframe sandbox permissions from app config.
       * Falls back to {@link TrustedContentUtilities.DEFAULT_PERMISSIONS} when
       * not configured.
       * @returns {string[]} Default iframe sandbox permissions.
       * @since 2.33.0
       */
      getDefaultIframePermissions() {
        const configuredPermissions = MetacatUI?.appModel?.get(
          "defaultIframePermissions",
        );

        if (
          Array.isArray(configuredPermissions) &&
          configuredPermissions.length
        ) {
          return configuredPermissions;
        }

        return DEFAULT_PERMISSIONS;
      },

      /**
       * Convert a URL pattern with wildcards to a RegExp.
       * The protocol (if present) is extracted and escaped separately so that
       * "https://" in a pattern only matches HTTPS URLs, not HTTP.
       * @param {string} wildcardPattern The pattern, which may include "*" wildcards.
       * @returns {RegExp} Case-insensitive regex that matches the full URL.
       * @since 0.0.0
       */
      patternToRegex(wildcardPattern) {
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
        const escapedProtocol = protocol.replace(
          /[-/\\^$+?.()|[\]{}]/g,
          "\\$&",
        );
        return new RegExp(`^${escapedProtocol}${escapedPattern}$`, "i");
      },

      /**
       * Normalize a trusted content source entry to a consistent shape.
       * @param {string|{url: string, permissions: (string[]|undefined)}} source Source entry from configuration.
       * @returns {{url: string, permissions: string[]}|null} Normalized source object or null when invalid.
       * @since 0.0.0
       */
      normalizeTrustedContentSource(source) {
        const defaultPermissions =
          TrustedContentUtilities.getDefaultIframePermissions();

        if (typeof source === "string") {
          return { url: source, permissions: defaultPermissions };
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
              : defaultPermissions,
        };
      },

      /**
       * Resolve the trusted content source entry that matches the given URL.
       * @param {string} url The URL to test.
       * @returns {{url: string, permissions: string[]}|null} Matching trusted source entry, or null when no match is found.
       * @since 0.0.0
       */
      getTrustedContentSource(url) {
        const sources = MetacatUI?.appModel?.get("trustedContentSources") ?? [];
        if (!sources.length) return null;

        if (!TrustedContentUtilities.isHttpUrl(url)) {
          return null;
        }

        const parsedUrl = new URL(url);

        const matchedSource = sources
          .map(TrustedContentUtilities.normalizeTrustedContentSource)
          .find(
            (normalized) =>
              normalized &&
              TrustedContentUtilities.patternToRegex(normalized.url).test(
                /^(https?:\/\/[^/?#]+)$/i.test(normalized.url)
                  ? parsedUrl.origin
                  : parsedUrl.href,
              ),
          );

        return matchedSource ?? null;
      },

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
       * @since 0.0.0
       */
      isTrustedUrl(url) {
        return TrustedContentUtilities.getTrustedContentSource(url) !== null;
      },

      /**
       * Return true when the URL uses the `http:` or `https:` protocol.
       * @param {string} url URL to validate.
       * @returns {boolean} `true` when protocol is HTTP(S).
       * @since 0.0.0
       */
      isHttpUrl(url) {
        try {
          const { protocol } = new URL(url);
          return protocol === "http:" || protocol === "https:";
        } catch {
          return false;
        }
      },

      /**
       * Resolve the sandbox permissions for a trusted iframe URL.
       * @param {string} url The URL to test.
       * @returns {string|null} The sandbox permissions string, or null when untrusted.
       * @since 0.0.0
       */
      getTrustedIframeSandbox(url) {
        const trustedContentSource =
          TrustedContentUtilities.getTrustedContentSource(url);
        if (!trustedContentSource) return null;

        return trustedContentSource.permissions.join(" ");
      },
    };

  return TrustedContentUtilities;
});
