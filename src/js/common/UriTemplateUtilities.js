"use strict";

define(["uriTemplatesEs"], ({ UriTemplate }) => {
  /**
   * Build a UriTemplate instance from a template string.
   * @param {string} template A URI template string.
   * @returns {UriTemplate} The parsed uri-templates-es instance.
   * @since 0.0.0
   */
  const createTemplate = (template) =>
    new UriTemplate(typeof template === "string" ? template : "");

  /**
   * Parse a URI template into reusable metadata.
   * @param {string} template A URI template string.
   * @returns {{ template: string, expressions: object[], varNames: string[] }} Parsed metadata.
   * @since 0.0.0
   */
  const parseTemplate = (template) => {
    const instance = createTemplate(template);
    let varNames = [];

    if (Array.isArray(instance.varNames)) {
      varNames = instance.varNames;
    } else if (Array.isArray(instance.substitutions)) {
      instance.substitutions.forEach((substitution) => {
        if (Array.isArray(substitution?.varNames)) {
          varNames = varNames.concat(substitution.varNames);
        }
      });
    }

    return {
      template: String(instance),
      expressions: [],
      varNames,
    };
  };

  /**
   * Get all variable names in a template.
   * @param {string} template A URI template string.
   * @returns {string[]} Unique variable names in appearance order.
   * @since 0.0.0
   */
  const getTemplateVarNames = (template) => parseTemplate(template).varNames;

  /**
   * Expand a URI template using the provided values.
   * @param {string} template The URI template to expand.
   * @param {object} [values] Values keyed by template variable names.
   * @returns {string} Expanded URI string.
   * @since 0.0.0
   */
  const expandTemplate = (template, values = {}) => {
    const instance = createTemplate(template);
    return instance.fillFromObject(values || {});
  };

  /**
   * Expand a template with no values to produce its base URL.
   * @param {string} template The URI template.
   * @returns {string} Base URL with template expressions stripped.
   * @since 0.0.0
   */
  const getTemplateBaseUrl = (template) => {
    const expanded = expandTemplate(template, {});
    return expanded.replace(/[?#&;]+$/, "");
  };

  /**
   * Safely parse a URL string.
   * @param {string} urlString The candidate URL.
   * @returns {URL|null} Parsed URL or null when invalid.
   * @since 0.0.0
   */
  const toUrl = (urlString) => {
    try {
      return new URL(urlString);
    } catch (_e) {
      return null;
    }
  };

  /**
   * Append query parameters to a URL string.
   * @param {string} urlString The base URL.
   * @param {object} [queryParams] Query parameters to merge into the URL.
   * @returns {string} URL with the merged query parameters.
   * @since 0.0.0
   */
  const appendQueryParams = (urlString, queryParams = {}) => {
    const url = toUrl(urlString);
    if (!url || typeof queryParams !== "object" || !queryParams) {
      return urlString;
    }

    Object.entries(queryParams).forEach(([key, value]) => {
      if (value == null) return;

      if (Array.isArray(value)) {
        url.searchParams.delete(key);
        value.forEach((item) => {
          if (item == null) return;
          url.searchParams.append(key, String(item));
        });
        return;
      }

      url.searchParams.set(key, String(value));
    });

    return url.toString();
  };

  /**
   * Extract allow-listed values from a URL using strict URI-template parsing.
   * This is intentionally brittle: the URL must satisfy `fromUri()` exactly
   * and only allow-listed values are returned.
   * @param {string} template URI template used as the allow-list contract.
   * @param {string} urlString URL emitted by an embedded app.
   * @returns {object} Parsed values keyed by allowed template variable names.
   * @since 0.0.0
   */
  const extractValuesFromUrl = (template, urlString) => {
    const instance = createTemplate(template);
    const url = toUrl(urlString);
    if (!url) return {};

    const parsed = instance.fromUri(url.toString());
    if (!parsed || typeof parsed !== "object") return {};

    const allowList = getTemplateVarNames(template);
    const values = {};

    allowList.forEach((name) => {
      if (parsed[name] != null && String(parsed[name]).length > 0) {
        values[name] = parsed[name];
      }
    });

    return values;
  };

  return {
    appendQueryParams,
    expandTemplate,
    extractValuesFromUrl,
    getTemplateBaseUrl,
    getTemplateVarNames,
    parseTemplate,
  };
});