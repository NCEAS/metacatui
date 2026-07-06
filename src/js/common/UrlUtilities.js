"use strict";

define(["common/ValueUtilities"], (ValueUtilities) => {
  const { normalizeText, safeDecodeURIComponent, requireStringChoice } =
    ValueUtilities;
  const RFC3986_PCHAR_ESCAPES = {
    "%21": "!",
    "%24": "$",
    "%26": "&",
    "%27": "'",
    "%28": "(",
    "%29": ")",
    "%2A": "*",
    "%2B": "+",
    "%2C": ",",
    "%3A": ":",
    "%3B": ";",
    "%3D": "=",
    "%40": "@",
    "%7E": "~",
  };
  const RFC3986_PCHAR_ESCAPE_PATTERN =
    /%(21|24|26|27|28|29|2A|2B|2C|3A|3B|3D|40|7E)/gi;

  /**
   * @typedef {string | URL | Location | null | undefined} UrlLikeValue A value that can
   * be coerced into a URL string.
   */

  /**
   * @typedef {"preserve"|"ensure"|"remove"} SlashMode A mode for normalizing
   * leading or trailing slashes on a URL/path-like string.
   * - "preserve": Keep existing slashes as they are.
   * - "ensure": Add a slash if not already present.
   * - "remove": Remove all slashes.
   */
  const SlashMode = ["preserve", "ensure", "remove"];

  /**
   * Generic helpers for normalizing and composing URLs.
   * @namespace UrlUtilities
   * @since 0.0.0
   */
  const UrlUtilities = {
    /**
     * Normalize a slash-mode option.
     * @param {*} mode Requested slash mode.
     * @param {SlashMode} [fallback] Fallback mode.
     * @returns {SlashMode} Normalized slash mode.
     */
    normalizeSlashMode(mode, fallback = "preserve") {
      return requireStringChoice(mode, SlashMode, {
        fallback,
        fieldName: "slash mode",
      });
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
     * @param {SlashMode} [options.leadingSlash] Leading slash mode.
     * @param {SlashMode} [options.trailingSlash] Trailing slash
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

      // If there is a prefix, then this is an absolute URL. Only apply trailing
      // slash normalization to the path portion, and preserve leading slashes
      // as they are part of the absolute URL structure.
      if (prefix) {
        const pathWithoutTrailing = path.replace(/\/+$/, "");
        let normalizedPath = pathWithoutTrailing;

        if (trailingMode === "ensure") {
          normalizedPath = `${pathWithoutTrailing}/`;
        } else if (trailingMode === "remove") {
          normalizedPath = pathWithoutTrailing;
        } else {
          normalizedPath = path;
        }

        return `${prefix}${normalizedPath}${suffix}`;
      }

      const leadingRun = base.match(/^\/+/)?.[0] || "";
      const trailingRun = base.match(/\/+$/)?.[0] || "";
      const body = base.replace(/^\/+|\/+$/g, "");

      // If there is no body, then the value is made up of only slashes (and
      // possibly a query/hash suffix). In this case, preserve a single slash if
      // either mode is "preserve", otherwise return just the suffix.
      if (!body) {
        if (leadingMode === "preserve" && trailingMode === "preserve") {
          return `${base}${suffix}`;
        }
        const hasSlash =
          leadingMode !== "remove" || trailingMode !== "remove" ? "/" : "";
        return `${hasSlash}${suffix}`;
      }

      let normalizedLeading;
      if (leadingMode === "preserve") {
        normalizedLeading = leadingRun;
      } else if (leadingMode === "ensure") {
        normalizedLeading = "/";
      } else {
        normalizedLeading = "";
      }

      let normalizedTrailing;
      if (trailingMode === "preserve") {
        normalizedTrailing = trailingRun;
      } else if (trailingMode === "ensure") {
        normalizedTrailing = "/";
      } else {
        normalizedTrailing = "";
      }

      return `${normalizedLeading}${body}${normalizedTrailing}${suffix}`;
    },

    /**
     * Encode a single URL path segment while avoiding double-encoding. Trims
     * whitespace.
     * @param {*} segment URL path segment.
     * @returns {string} Encoded segment.
     */
    encodePathSegment(segment = "") {
      const normalized = normalizeText(segment) || "";
      if (!normalized) return "";
      return encodeURIComponent(safeDecodeURIComponent(normalized));
    },

    /**
     * Encode a value as a minimally escaped RFC3986 URI path segment. This
     * preserves the RFC3986 `pchar` set in a single segment, so reserved path
     * delimiters such as `/` and `?` remain percent-escaped. This is the
     * baseline rule DataONE references for identifier serialization in URL
     * paths:
     * https://dataone-architecture-documentation.readthedocs.io/en/latest/design/PIDs.html#serializing
     * @param {string} segment Candidate path-segment value.
     * @returns {string} Minimally escaped RFC3986 path segment.
     */
    encodeRFC3986PathSegment(segment = "") {
      return UrlUtilities.encodePathSegment(segment).replace(
        RFC3986_PCHAR_ESCAPE_PATTERN,
        (match) => RFC3986_PCHAR_ESCAPES[match.toUpperCase()] || match,
      );
    },

    /**
     * Decode a percent-escaped RFC3986 path segment.
     * @param {string} segment Candidate path-segment value.
     * @returns {string} Decoded path segment.
     */
    decodeRFC3986PathSegment(segment = "") {
      const normalized = normalizeText(segment) || "";
      if (!normalized) return "";
      return safeDecodeURIComponent(normalized);
    },

    /**
     * Encode a DataONE PID for use in a URL path segment. DataONE follows
     * RFC3986 path-segment encoding, but additionally requires `+` to be
     * percent-escaped as `%2B` to avoid ambiguity with legacy URL-decoder
     * behavior. See the DataONE serializing guidance:
     * https://dataone-architecture-documentation.readthedocs.io/en/latest/design/PIDs.html#serializing
     * @param {string} segment Candidate PID/path segment.
     * @returns {string} DataONE-safe path segment.
     */
    encodeDataONEPidForPath(segment = "") {
      return UrlUtilities.encodeRFC3986PathSegment(segment).replace(
        /\+/g,
        "%2B",
      );
    },

    /**
     * Decode a DataONE PID from a URL path segment. Literal `+` characters are
     * preserved before percent-decoding because older clients may have treated
     * `+` as a space. DataONE documents this as part of its identifier
     * serializing guidance.
     * @param {string} segment Candidate DataONE path-segment value.
     * @returns {string} Decoded DataONE PID.
     */
    decodeDataONEPidFromPath(segment = "") {
      const normalized = normalizeText(segment) || "";
      if (!normalized) return "";
      return UrlUtilities.decodeRFC3986PathSegment(
        normalized.replace(/\+/g, "%2B"),
      );
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
     * @param {SlashMode} [options.leadingSlash] Leading slash mode.
     * @param {SlashMode} [options.trailingSlash] Trailing slash mode.
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
     * @param {SlashMode} [options.trailingSlash] Trailing slash mode
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
     * @param {object} [options] Options.
     * @param {boolean} [options.encodePath] Whether to encode path segments
     * before joining.
     * @param {string} [options.fallbackOrigin] Fallback origin when baseUrl is
     * empty.
     * @returns {string} Full URL.
     */
    buildUrl(
      baseUrl = "",
      path = "",
      {
        encodePath = true,
        fallbackOrigin = globalThis.window?.location?.origin || "",
      } = {},
    ) {
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

      const urlPath =
        !correctedPath.startsWith("/") &&
        /^[A-Za-z][A-Za-z0-9+.-]*:/.test(correctedPath)
          ? `./${correctedPath}`
          : correctedPath;

      return UrlUtilities.normalizeUrl(new URL(urlPath, correctedBaseUrl));
    },

    /**
     * Get a direct object download URL for the given PID.
     * @param {string} pid DataONE object PID.
     * @param {object} [options] URL options.
     * @param {string} [options.baseUrl] Explicit object/resolve service base
     * URL. Defaults to resolveServiceUrl, then objectServiceUrl.
     * @returns {string} Object download URL, or "" when unavailable.
     * @since 0.0.0
     */
    getObjectDownloadUrl(pid, options = {}) {
      const { baseUrl } = options;
      const root =
        "baseUrl" in options
          ? baseUrl
          : MetacatUI.appModel.get("resolveServiceUrl") ||
            MetacatUI.appModel.get("objectServiceUrl") ||
            "";
      if (!pid || !root) return "";
      return `${UrlUtilities.normalizeUrl(root, "", {
        trailingSlash: "ensure",
      })}${encodeURIComponent(pid)}`;
    },

    /**
     * Get a URL for viewing a DataONE object with the given PID.
     * @param {string} pid ID for the DataONE object.
     * @returns {string} URL for viewing the object.
     */
    getViewLink(pid) {
      const root = MetacatUI.root || MetacatUI.appModel.get("baseUrl");
      return UrlUtilities.buildUrl(
        root,
        `view/${UrlUtilities.encodeDataONEPidForPath(pid)}`,
      );
    },
  };

  return UrlUtilities;
});
