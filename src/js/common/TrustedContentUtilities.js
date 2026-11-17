define([], () => {
  const DEFAULT_PERMISSIONS = ["allow-scripts", "allow-same-origin"];

  /**
   * @namespace TrustedContentUtilities
   * @description Utility functions for working with trusted content sources specified
   * by a theme's AppConfig and used by the showdown iframe embedding and visualization
   * panel.
   * @type {object}
   * @since 2.37.0
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
       * @since 2.37.0
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
       * Read the iframe permissions for a source and fill in sandbox defaults.
       * @param {string|{url: string, permissions: (string[]|undefined), allow:
       * (string[]|undefined)}} source URL pattern or source config
       * @returns {{url: string, permissions: string[], allow:
       * (string[]|undefined)}|null} Source settings, or null if the entry has
       * no URL string
       * @since 2.37.0
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
          allow: Array.isArray(source.allow) ? source.allow : undefined,
        };
      },

      /**
       * Find the first trusted source that matches a URL.
       * @param {string} url URL to match
       * @returns {{url: string, permissions: string[], allow:
       * (string[]|undefined)}|null} Source settings, or null if no source
       * matches
       * @since 2.37.0
       */
      getTrustedContentSource(url) {
        const sources = MetacatUI?.appModel?.get("trustedContentSources") ?? [];
        if (!sources.length) return null;

        if (!TrustedContentUtilities.isHttpUrl(url)) {
          return null;
        }

        const parsedUrl = new URL(url);
        const urlSuffix = parsedUrl.href.replace(/^https?:\/\/[^/]+/, "");

        const matchedSource = sources
          .map(TrustedContentUtilities.normalizeTrustedContentSource)
          .find((normalized) => {
            if (!normalized) return false;

            // Keep host wildcards from matching the rest of the URL.
            const [, originPattern, suffixPattern] =
              normalized.url.match(/^(https?:\/\/[^/?#]+)(.*)$/i) ?? [];
            const urlToMatch = originPattern
              ? parsedUrl.origin
              : parsedUrl.href;

            return (
              TrustedContentUtilities.patternToRegex(
                originPattern ?? normalized.url,
              ).test(urlToMatch) &&
              (!suffixPattern ||
                TrustedContentUtilities.patternToRegex(suffixPattern).test(
                  urlSuffix,
                ))
            );
          });

        return matchedSource ?? null;
      },

      /**
       * Apply the matching source's permissions before loading the iframe.
       * Clear its source and permissions if the URL is untrusted.
       * @param {HTMLIFrameElement} iframe An iframe created by the caller
       * @param {string} url The URL to load
       * @returns {boolean} Whether the URL matched a trusted source
       * @since 0.0.0
       */
      configureTrustedIframe(iframe, url) {
        const source = TrustedContentUtilities.getTrustedContentSource(url);
        if (!source) {
          iframe.removeAttribute("src");
          iframe.removeAttribute("sandbox");
          iframe.removeAttribute("allow");
          return false;
        }

        iframe.setAttribute("sandbox", source.permissions.join(" "));
        if (source.allow?.length) {
          iframe.setAttribute("allow", source.allow.join("; "));
        } else {
          iframe.removeAttribute("allow");
        }
        Object.assign(iframe, { src: url });
        return true;
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
       * @since 2.37.0
       */
      isTrustedUrl(url) {
        return TrustedContentUtilities.getTrustedContentSource(url) !== null;
      },

      /**
       * Return true when the URL uses the `http:` or `https:` protocol.
       * @param {string} url URL to validate.
       * @returns {boolean} `true` when protocol is HTTP(S).
       * @since 2.37.0
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
       * @since 2.37.0
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
