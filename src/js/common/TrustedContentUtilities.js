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
       * Convert a wildcard pattern to a regex that ignores case.
       * @param {string} wildcardPattern The pattern, which may include "*" wildcards
       * @returns {RegExp} Regular expression anchored at both ends
       * @since 2.37.0
       */
      patternToRegex(wildcardPattern) {
        const escapedPattern = wildcardPattern
          .replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&")
          .replace(/\*/g, ".*");
        return new RegExp(`^${escapedPattern}$`, "i");
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

        let parsedUrl;
        try {
          parsedUrl = new URL(url);
        } catch {
          return null;
        }
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          return null;
        }

        const urlSuffix = parsedUrl.href.replace(/^https?:\/\/[^/]+/, "");

        const matchedSource = sources
          .map(TrustedContentUtilities.normalizeTrustedContentSource)
          .find((normalized) => {
            if (!normalized) return false;

            // Only a leading "*." can match across hostname labels.
            const pattern = normalized.url.match(
              /^(https?:\/\/(?:\*\.)?[^*/?#]+)([/?#].*)?$/i,
            );
            if (!pattern) return false;

            const [, originPattern, suffixPattern] = pattern;
            return (
              TrustedContentUtilities.patternToRegex(originPattern).test(
                parsedUrl.origin,
              ) &&
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
    };

  return TrustedContentUtilities;
});
