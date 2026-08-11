"use strict";

define(["uriTemplatesEs"], ({ UriTemplate }) => {
  /**
   * Parse template expressions into a small operator/variable metadata shape.
   * @param {string} template A URI template string.
   * @returns {{ operator: string, varNames: string[] }[]} Parsed expressions.
   * @since 0.0.0
   */
  const extractTemplateExpressions = (template) => {
    const expressions = [];
    const templateString = typeof template === "string" ? template : "";
    const expressionRegex = /\{([+#./;?&]?)([^}]+)\}/g;
    let match = expressionRegex.exec(templateString);

    while (match) {
      const operator = match[1] || "";
      const varNames = match[2]
        .split(",")
        .map((name) => name.trim().replace(/\*$/, "").split(":")[0])
        .filter((name) => name.length > 0);

      expressions.push({ operator, varNames });
      match = expressionRegex.exec(templateString);
    }

    return expressions;
  };

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
    const expressions = extractTemplateExpressions(template);
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
      expressions,
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
   * Remove query/hash parts from a candidate URL that are not described by the
   * template so strict URI-template parsing can still recover allow-listed
   * values from URLs that contain additional app state.
   * @param {string} template URI template used as the allow-list contract.
   * @param {URL} url Parsed URL emitted by an embedded app.
   * @returns {string} Sanitized URL string.
   * @since 0.0.0
   */
  const sanitizeUrlForTemplate = (template, url) => {
    const sanitized = new URL(url.toString());
    const expressions = extractTemplateExpressions(template);
    const allowedQueryNames = new Set(
      expressions
        .filter(({ operator }) => ["?", "&", ";"].includes(operator))
        .flatMap(({ varNames }) => varNames),
    );
    const hasHashExpression = expressions.some(
      ({ operator }) => operator === "#",
    );

    if (allowedQueryNames.size) {
      const keysToDelete = [];
      sanitized.searchParams.forEach((_value, key) => {
        if (!allowedQueryNames.has(key)) keysToDelete.push(key);
      });
      keysToDelete.forEach((key) => {
        sanitized.searchParams.delete(key);
      });
    } else {
      sanitized.search = "";
    }

    if (!hasHashExpression) {
      sanitized.hash = "";
    }

    return sanitized.toString();
  };

  /**
   * Fallback extraction for query/hash/basic path variables when strict
   * template parsing fails.
   * @param {string} template URI template used as the allow-list contract.
   * @param {URL} url Parsed URL emitted by an embedded app.
   * @returns {object} Parsed values keyed by allowed template variable names.
   * @since 0.0.0
   */
  const extractFallbackValuesFromUrl = (template, url) => {
    const expressions = extractTemplateExpressions(template);
    const values = {};

    expressions.forEach(({ operator, varNames }) => {
      if (["?", "&", ";"].includes(operator)) {
        varNames.forEach((name) => {
          const value = url.searchParams.get(name);
          if (value != null && value.length > 0) {
            values[name] = value;
          }
        });
        return;
      }

      if (operator === "#" && varNames.length === 1 && url.hash.length > 1) {
        values[varNames[0]] = decodeURIComponent(url.hash.slice(1));
        return;
      }

      if (!["", "+", "/"].includes(operator) || varNames.length !== 1) {
        return;
      }

      const baseUrl = toUrl(getTemplateBaseUrl(template));
      let relativePath = url.pathname;

      if (baseUrl && baseUrl.origin === url.origin) {
        const basePath = baseUrl.pathname || "/";
        if (basePath !== "/" && relativePath.startsWith(basePath)) {
          relativePath = relativePath.slice(basePath.length);
        }
      }

      relativePath = decodeURIComponent(relativePath.replace(/^\/+/, ""));
      if (relativePath.length > 0) {
        values[varNames[0]] = relativePath;
      }
    });

    return values;
  };

  /**
   * Extract query, hash, and basic path variable values from a URL based on
   * template operators and variable names.
   * @param {string} template URI template used as the allow-list contract.
   * @param {string} urlString URL emitted by an embedded app.
   * @returns {object} Parsed values keyed by allowed template variable names.
   * @since 0.0.0
   */
  const extractValuesFromUrl = (template, urlString) => {
    const instance = createTemplate(template);
    const url = toUrl(urlString);
    if (!url) return {};

    const normalizedUrl = url.toString();
    let parsed = instance.fromUri(normalizedUrl);

    if (!parsed || typeof parsed !== "object") {
      parsed = instance.fromUri(sanitizeUrlForTemplate(template, url));
    }

    const allowList = getTemplateVarNames(template);
    const values = {};

    if (!parsed || typeof parsed !== "object") {
      return extractFallbackValuesFromUrl(template, url);
    }

    allowList.forEach((name) => {
      if (parsed[name] != null && String(parsed[name]).length > 0) {
        values[name] = parsed[name];
      }
    });

    return values;
  };

  return {
    expandTemplate,
    extractValuesFromUrl,
    getTemplateBaseUrl,
    getTemplateVarNames,
    parseTemplate,
  };
});