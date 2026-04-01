"use strict";

define(["common/ValueUtilities"], (ValueUtilities) => {
  const { normalizeText, safeDecodeURIComponent } = ValueUtilities;

  /**
   * @typedef {String|URL|Location|null|undefined} UrlLikeValue A value that can
   * be coerced into a URL string.
   */

  /**
   * @typedef {"preserve"|"ensure"|"remove"} SlashMode A mode for normalizing
   * leading or trailing slashes on a URL/path-like string.
   * - "preserve": Keep existing slashes as they are.
   * - "ensure": Add a slash if not already present.
   * - "remove": Remove all slashes.
   */

  /**
   * Generic helpers for normalizing and composing URLs.
   * @namespace UrlUtilities
   * @since 0.0.0
   */
  const UrlUtilities = {
    /**
     * Normalize a slash-mode option.
     * @param {*} mode Requested slash mode.
     * @param {SlashMode} [fallback="preserve"] Fallback mode.
     * @returns {SlashMode} Normalized slash mode.
     */
    normalizeSlashMode(mode, fallback = "preserve") {
      return ["preserve", "ensure", "remove"].includes(mode) ? mode : fallback;
    },

    /**
     * Coerce supported URL-like inputs into strings.
     * @param {*} value Candidate URL-like value.
     * @returns {string|null} Coerced string value or null.
     */
    urlLikeToString(value) {
      if (typeof value === "string" || value instanceof String) {
        return String(value);
      }

      if (value instanceof URL) {
        return value.href;
      }

      if (
        typeof globalThis.Location !== "undefined" &&
        value instanceof globalThis.Location
      ) {
        return value.href;
      }

      return null;
    },

    /**
     * Split a URL-like value into the portion before any query/hash suffix and
     * the suffix itself. For example, "http://example.com/path?query#hash"
     * would be split into { base: "http://example.com/path", suffix:
     * "?query#hash" }.
     * @param {*} value URL-like value.
     * @returns {{base:string, suffix:string}} Base/suffix pair.
     */
    splitUrlSuffix(value) {
      const normalized = normalizeText(value) || "";
      const match = normalized.match(/^([^?#]*)([?#].*)?$/);
      return {
        base: match?.[1] || normalized,
        suffix: match?.[2] || "",
      };
    },

    /**
     * Split an absolute URL into its origin-like prefix and path portion.
     * Non-absolute values are returned with an empty prefix. For example,
     * "http://example.com/path" would be split into { prefix:
     * "http://example.com", path: "/path" }, while "/relative/path" would be
     * split into { prefix: "", path: "/relative/path" }.
     * @param {*} value URL-like value without query/hash suffix.
     * @returns {{prefix:string, path:string}} Absolute prefix and path portion.
     */
    splitAbsoluteUrl(value) {
      const normalized = normalizeText(value) || "";
      const match = normalized.match(
        /^([A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#]*)(\/.*)?$/,
      );
      if (!match) {
        return { prefix: "", path: normalized };
      }

      return {
        prefix: match[1] || "",
        path: match[2] || "",
      };
    },

    /**
     * Normalize leading/trailing slash boundaries on a path-like string. Query
     * strings and fragments are preserved. For absolute URLs, `leadingSlash` is
     * ignored and only `trailingSlash` affects the path component after the
     * origin.
     * @param {*} value Path-like value.
     * @param {object} [options] Slash options.
     * @param {SlashMode} [options.leadingSlash="preserve"] Leading slash mode.
     * @param {SlashMode} [options.trailingSlash="preserve"] Trailing slash
     * mode.
     * @returns {string} Path-like string with normalized boundaries.
     */
    normalizePathBoundaries(
      value,
      { leadingSlash = "preserve", trailingSlash = "preserve" } = {},
    ) {
      const normalized = normalizeText(value) || "";
      if (!normalized) return "";

      const { base, suffix } = UrlUtilities.splitUrlSuffix(normalized);
      const { prefix, path } = UrlUtilities.splitAbsoluteUrl(base);
      const leadingMode = UrlUtilities.normalizeSlashMode(leadingSlash);
      const trailingMode = UrlUtilities.normalizeSlashMode(trailingSlash);

      if (prefix) {
        const normalizedPath =
          trailingMode === "remove"
            ? path.replace(/\/+$/, "")
            : trailingMode === "ensure"
              ? `${path.replace(/\/+$/, "")}/`
              : path;

        return `${prefix}${normalizedPath}${suffix}`;
      }

      const leadingRun = base.match(/^\/+/)?.[0] || "";
      const trailingRun = base.match(/\/+$/)?.[0] || "";
      const body = base.replace(/^\/+|\/+$/g, "");

      if (!body) {
        if (leadingMode === "preserve" && trailingMode === "preserve") {
          return `${base}${suffix}`;
        }

        return `${
          leadingMode === "remove" && trailingMode === "remove" ? "" : "/"
        }${suffix}`;
      }

      const normalizedLeading =
        leadingMode === "preserve"
          ? leadingRun
          : leadingMode === "ensure"
            ? "/"
            : "";
      const normalizedTrailing =
        trailingMode === "preserve"
          ? trailingRun
          : trailingMode === "ensure"
            ? "/"
            : "";

      return `${normalizedLeading}${body}${normalizedTrailing}${suffix}`;
    },

    /**
     * Encode a single URL path segment while avoiding double-encoding.
     * @param {*} segment URL path segment.
     * @returns {string} Encoded segment.
     */
    encodePathSegment(segment = "") {
      const normalized = normalizeText(segment) || "";
      if (!normalized) return "";
      return encodeURIComponent(safeDecodeURIComponent(normalized));
    },

    /**
     * Encode each segment of a URL path while preserving slash separators.
     * @param {string} path URL path.
     * @returns {string} Encoded path.
     */
    encodePathSegments(path = "") {
      const normalizedPath = normalizeText(path);
      if (!normalizedPath) return "";

      if (normalizedPath.includes("?") || normalizedPath.includes("#")) {
        throw new Error(
          "UrlUtilities.encodePathSegments does not support query strings or hashes",
        );
      }

      return normalizedPath
        .split("/")
        .map((segment) =>
          segment === "" ? "" : UrlUtilities.encodePathSegment(segment),
        )
        .join("/");
    },

    /**
     * Remove any fragment identifier from a URL-like string. For example,
     * "http://example.com/path#section" would become "http://example.com/path".
     * @param {*} value URL-like value.
     * @returns {string} Value without the fragment.
     */
    stripFragment(value) {
      const normalized = normalizeText(value) || "";
      const fragmentIndex = normalized.indexOf("#");
      return fragmentIndex === -1
        ? normalized
        : normalized.slice(0, fragmentIndex);
    },

    /**
     * Normalize a URL/path-like string by trimming whitespace, applying a
     * fallback, and normalizing slash boundaries. For absolute URLs,
     * `leadingSlash` is ignored and only `trailingSlash` affects the path
     * component after the origin.
     * @param {UrlLikeValue} url Value to normalize.
     * @param {UrlLikeValue} [fallback] Fallback URL when the input is empty.
     * @param {object} [options] Normalization options.
     * @param {SlashMode} [options.leadingSlash="preserve"] Leading slash mode.
     * @param {SlashMode} [options.trailingSlash="remove"] Trailing slash mode.
     * @returns {string} Normalized URL/path-like string or an empty string.
     */
    normalizeUrl(
      url,
      fallback = "",
      { leadingSlash = "preserve", trailingSlash = "remove" } = {},
    ) {
      const normalizeInput = (value) =>
        UrlUtilities.normalizePathBoundaries(
          normalizeText(UrlUtilities.urlLikeToString(value)) || "",
          { leadingSlash, trailingSlash },
        );

      const normalizedUrl = normalizeInput(url);
      if (normalizedUrl) {
        return normalizedUrl;
      }

      return normalizeInput(fallback);
    },

    /**
     * Extract the base URL up to the final slash from a URL-like value,
     * optionally requiring a specific path segment to be present.
     * @param {*} value URL-like value.
     * @param {object} [options] Extraction options.
     * @param {string} [options.requiredPathSegment] Required substring.
     * @param {SlashMode} [options.trailingSlash="ensure"] Trailing slash mode
     * for the returned base URL.
     * @returns {string} Extracted base URL or empty string.
     */
    extractBaseUrl(
      value,
      { requiredPathSegment = "", trailingSlash = "ensure" } = {},
    ) {
      const normalized = UrlUtilities.stripFragment(value);
      if (!normalized) return "";

      const required = normalizeText(requiredPathSegment) || "";
      if (required && !normalized.includes(required)) return "";

      const { base } = UrlUtilities.splitUrlSuffix(normalized);
      const { prefix, path } = UrlUtilities.splitAbsoluteUrl(base);
      const baseToSlice = prefix ? path : base;
      const lastSlashIndex = baseToSlice.lastIndexOf("/");
      if (lastSlashIndex === -1) return "";

      return UrlUtilities.normalizeUrl(
        `${prefix}${baseToSlice.slice(0, lastSlashIndex + 1)}`,
        "",
        {
          trailingSlash,
        },
      );
    },

    /**
     * Return the last slash-delimited path segment from a URL-like string.
     * Query strings and fragments are ignored. For example,
     * "http://example.com/path/to/resource?query#hash" would return "resource".
     * @param {*} value URL-like value.
     * @returns {string} Final path segment, or an empty string.
     */
    getLastPathSegment(value) {
      const withoutFragment = UrlUtilities.stripFragment(value);
      if (!withoutFragment) return "";

      const { base } = UrlUtilities.splitUrlSuffix(withoutFragment);
      const { prefix, path } = UrlUtilities.splitAbsoluteUrl(base);
      const segments = (prefix ? path : base).split("/").filter(Boolean);
      return segments.length ? segments[segments.length - 1] : "";
    },

    /**
     * Build a full URL from a base URL and a relative path.
     * @param {string} [baseUrl] Base URL.
     * @param {string} [path] Path relative to the base URL.
     * @param {object|boolean} [options] Options or legacy encodePath flag.
     * @param {boolean} [options.encodePath] Whether to encode path segments
     * before joining.
     * @param {string} [options.fallbackOrigin] Fallback origin when baseUrl is
     * empty.
     * @returns {string} Full URL.
     */
    buildUrl(baseUrl = "", path = "", options = {}) {
      const normalizedOptions =
        typeof options === "boolean" ? { encodePath: options } : options || {};
      const {
        encodePath = true,
        fallbackOrigin = globalThis.window?.location?.origin || "",
      } = normalizedOptions;

      const normalizedPath = normalizeText(path);
      const normalizedBaseUrl =
        normalizeText(baseUrl) || normalizeText(fallbackOrigin);

      if (!normalizedBaseUrl) {
        if (!normalizedPath) return "";
        throw new Error("UrlUtilities.buildUrl requires a baseUrl");
      }

      const correctedBaseUrl = UrlUtilities.normalizeUrl(
        normalizedBaseUrl,
        "",
        {
          trailingSlash: "ensure",
        },
      );

      if (!normalizedPath) {
        return UrlUtilities.normalizeUrl(correctedBaseUrl);
      }

      const resolvedPath = encodePath
        ? UrlUtilities.encodePathSegments(normalizedPath)
        : normalizedPath;
      const correctedPath = UrlUtilities.normalizeUrl(resolvedPath, "", {
        leadingSlash: "remove",
        trailingSlash: "ensure",
      });

      return UrlUtilities.normalizeUrl(
        new URL(correctedPath, correctedBaseUrl),
      );
    },
  };

  return UrlUtilities;
});
