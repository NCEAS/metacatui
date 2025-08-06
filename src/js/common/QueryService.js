"use strict";

define(["jquery"], ($) => {
  const DEFAULT_MAX_QUERY_LEN = 2000;

  /**
   *
   * @typedef {object} QueryOptions
   * @property {string}  q Solr query (Lucene syntax). Default `*:*`.
   * @property {string[]|string} [filterQueries] Filter queries (fq) to apply.
   * @property {string[]|string} [fields] Fields to return (fl).
   * @property {string} [sort] Sort clause, e.g., `'dateUploaded desc'`.
   * @property {number} [rows] Result row count. Default `25`.
   * @property {number} [start] Result offset. Default `0`.
   * @property {string[]} [facets] Fields to facet on.
   * @property {string[]} [facetQueries] Facet queries (fq) to apply.
   * @property {string[]} [statsFields] Fields for statistics (stats.field).
   * @property {number} [facetLimit] Default `-1` (no limit).
   * @property {number} [facetMinCount] Default `1`.
   * @property {boolean} [usePost] Force POST / GET (overrides auto-choice).
   * @property {boolean} [useAuth=true] Inject MetacatUI auth headers?
   * @property {boolean} [archived] Include archived items? Default `false`.
   * @property {boolean} [group] Use Solr grouping (group=true)?
   * @property {string} [groupField] Field to group by (if `group` is true).
   * @property {number} [groupLimit] Limit of groups to return (if `group` is true).
   * @property {boolean} [disableQueryPOSTs] Disable POST requests for queries?
   */

  /**
   * QueryService provides methods to execute Solr queries against the
   * configured query service URL. It supports both GET and POST requests,
   * handles query parameters, and can include facets, filter queries, and
   * statistics fields.
   * @class QueryService
   * @example
   */
  class QueryService {
    // --------------------------------------------------------------------- //
    //  Public API
    // --------------------------------------------------------------------- //

    /**
     * Common logic to extract query configuration from options.
     * @param {QueryOptions} opts
     * @returns {object} { queryParams, urlBase, shouldPost }
     */
    static getQueryConfig(opts = {}) {
      const {
        q = "*:*",
        filterQueries = [],
        fields = [],
        sort = "dateUploaded desc",
        rows = 25,
        start = 0,
        facets = [],
        facetQueries = [],
        statsFields = [],
        facetLimit = -1,
        facetMinCount = 1,
        usePost,
        archived = false,
        group = false,
        groupField,
        groupLimit,
      } = opts;

      const endpoint = QueryService.queryServiceUrl();
      const urlBase = endpoint.replace(/\?$/, "");
      const queryParams = QueryService.buildQueryObject({
        q,
        filterQueries,
        fields,
        sort,
        rows,
        start,
        facets,
        facetQueries,
        statsFields,
        facetLimit,
        facetMinCount,
        archived,
        group,
        groupField,
        groupLimit,
      });

      const shouldPost = QueryService.decidePost({
        explicit: usePost,
        queryParams,
        urlBase,
      });

      return { queryParams, urlBase, shouldPost };
    }

    /**
     * Execute a Solr query using the native Fetch API. Returns a Promise
     * resolving to the parsed JSON response.
     * NOTE: This method is not jqXHR-compatible and should not be used in
     * Backbone sync/fetch overrides.
     * @param {QueryOptions} opts Query parameters & flags.
     * @returns {Promise<object>} A promise resolving to the JSON result.
     * @throws {Error} On network failure or non-2xx status.
     */
    static async queryWithFetch(opts = {}) {
      const config = QueryService.getQueryConfig(opts);
      const { queryParams, shouldPost } = config;
      let { urlBase } = config;

      let fetchOptions = {
        method: shouldPost ? "POST" : "GET",
        headers: {},
      };

      if (shouldPost) {
        const fd = new FormData();
        Object.entries(queryParams).forEach(([k, v]) => {
          // TODO: Handle groups and other complex types if needed.... make a separate method?
          if (Array.isArray(v)) {
            v.forEach((item) => fd.append(k, item));
          } else {
            fd.append(k, v);
          }
        });
        fetchOptions.body = fd;
      } else {
        const qs = QueryService.toQueryString(queryParams);
        urlBase += (urlBase.includes("?") ? "" : "?") + qs;
      }

      if (opts.useAuth !== false) {
        fetchOptions = {
          ...fetchOptions,
          ...MetacatUI.appUserModel.createFetchSettings(),
        };
      }

      const res = await fetch(urlBase, fetchOptions);
      if (!res.ok) {
        throw new Error(`QueryService.queryWithFetch(): HTTP ${res.status}`);
      }
      return res.json();
    }

    /**
     * Execute a Solr query and obtain the raw JSON response.
     * @param {QueryOptions} opts Query parameters & flags.
     * @returns {jqXHR} jQuery AJAX promise.
     */
    static query(opts = {}) {
      const { queryParams, urlBase, shouldPost } =
        QueryService.getQueryConfig(opts);

      let ajaxSettings = shouldPost
        ? QueryService.buildPostSettings(urlBase, queryParams)
        : QueryService.buildGetSettings(urlBase, queryParams);

      if (opts.useAuth !== false) {
        ajaxSettings = QueryService.mergeAuth(ajaxSettings);
      }

      return $.ajax(ajaxSettings);
    }

    /**
     * Build query parameters as a plain object (useful for tests or logging).
     * @param {QueryOptions} opts Query options.
     * @returns {object} Query parameters object.
     */
    static buildQueryParams(opts = {}) {
      return QueryService.buildQueryObject(opts);
    }

    /**
     * Perform basic clean up of a Solr response JSON, including removing
     * empty values and trimming resourceMap fields.
     * @param {object} response The Solr response JSON object.
     * @returns {object[]} The cleaned-up array of documents (docs).
     */
    static parseResponse(response) {
      // If the response is not an object, cannot parse it
      if (typeof response !== "object" || !response?.response) {
        throw new Error(
          "QueryService.parseResponse(): Response is not a valid object.",
        );
      }

      if (
        !Array.isArray(response.response.docs) ||
        !response.response.docs?.length
      ) {
        // If there are no docs, return an empty array
        return [];
      }

      const docs = response.response.docs;
      QueryService.removeEmptyValues(docs);
      QueryService.parseResourceMapFields(docs);

      // Default to returning the raw response
      return docs;
    }

    /**
     * Parses the resourceMap fields from the Solr response JSON.
     * @param {object[]} json - The "docs" part of a JSON object from the Solr
     * response
     * @returns {object[]} The updated docs with parsed resourceMap fields,
     * though the original docs are modified in place.
     */
    static parseResourceMapFields(docs) {
      if (!Array.isArray(docs) || !docs.length) {
        return [];
      }
      docs.forEach((doc) => {
        if (doc.resourceMap) {
          doc.resourceMap = QueryService.parseResourceMapField(doc);
        }
      });
      return docs;
    }

    /**
     * Builds a common query for a PID and optional SID. The query will search
     * for the PID in either the `id` or `seriesId` fields, and if a SID is
     * provided, it will also filter by that. If no PID is provided, it will
     * search for the SID in the `seriesId` field, excluding any versions that
     * have been obsoleted.
     * @param {string} pid - The PID to search for.
     * @param {string} sid - The series ID to search for.
     * @returns {string} The constructed query string.
     */
    static buildIdQuery(pid, sid) {
      let query = "";
      const getQueryPart = QueryService.getQueryPart;
      // If there is no pid set, then search for sid or pid
      if (!sid)
        query += `(${getQueryPart("id", pid)} OR ${getQueryPart("seriesId", pid)})`;
      // If a seriesId is specified, then search for that
      else if (sid && pid)
        query += `(${getQueryPart("id", pid)} AND ${getQueryPart("seriesId", sid)})`;
      // If only a seriesId is specified, then just search for the most recent
      // version
      else if (sid && !pid)
        query += `${getQueryPart("seriesId", sid)} -obsoletedBy:*`;
      return query;
    }

    /**
     * Escape special characters in a Lucene query string. Lucene is the query
     * language used by Solr.
     * @param {string} value The string to escape.
     * @returns {string} The escaped string.
     */
    static escapeLucene(value) {
      if (typeof value !== "string") {
        throw new TypeError(
          "QueryService.escapeLucene(): value must be a string.",
        );
      }
      return value.replace(/([+\-!(){}\[\]^"~*?:\\/])/g, "\\$1");
    }

    /**
     * Build a query part for a field and value, escaping the value for Lucene.
     * @param {string} field The field name.
     * @param {string} value The value to search for.
     * @returns {string} The formatted query part, e.g., `field:"value"`.
     */
    static getQueryPart(field, value) {
      if (typeof field !== "string" || typeof value !== "string") {
        throw new TypeError(
          "QueryService.queryPart(): field and value must be strings.",
        );
      }
      return `${field}:"${QueryService.escapeLucene(value)}"`;
    }

    /**
     * Parses the resourceMap field from the Solr response JSON.
     * @param {object} json - The JSON object from the Solr response
     * @returns {string|string[]} The resourceMap parsed. If it is a string,
     * it returns the trimmed string. If it is an array, it returns an array
     * of trimmed strings. If it is neither, it returns an empty array.
     */
    static parseResourceMapField(doc) {
      if (!doc || !doc.resourceMap) {
        return [];
      }
      const rms = doc.resourceMap;
      if (typeof rms === "string") {
        return [rms.trim()];
      } else if (Array.isArray(rms)) {
        return rms
          .map((rMapId) => {
            return typeof rMapId === "string" ? rMapId.trim() : rMapId;
          })
          .filter(Boolean); // Filter out any falsy values
      }
      // If nothing works so far, return an empty array
      return [];
    }

    /**
     * Remove empty values from an array of documents. This modifies the
     * documents in place, removing any properties that are `null`, `undefined`,
     * or an empty string.
     * @param {object[]} docs The array of documents to clean.
     * @returns {object[]} The cleaned array of documents.
     */
    static removeEmptyValues(docs) {
      if (!Array.isArray(docs) || !docs.length) {
        return [];
      }
      docs.forEach((doc) => {
        Object.keys(doc).forEach((key) => {
          if (doc[key] === null || doc[key] === undefined || doc[key] === "") {
            delete doc[key];
          }
        });
      });
      return docs;
    }

    // --------------------------------------------------------------------- //
    //  Private helpers
    // --------------------------------------------------------------------- //

    /**
     * Get the configured query service URL from MetacatUI's appModel. Throws an
     * error if not configured.
     * @returns {string} The query service URL.
     * @throws {Error} If queryServiceUrl is not configured.
     */
    static queryServiceUrl() {
      if (!MetacatUI?.appModel?.get("queryServiceUrl")) {
        throw new Error(
          "QueryService.queryServiceUrl(): queryServiceUrl is not configured.",
        );
      }
      return MetacatUI.appModel.get("queryServiceUrl");
    }

    /**
     * Construct a query object for Solr. Formats the parameters according to
     * Solr's expectations, including facets, filter queries, and stats fields.
     * Applies defaults for missing parameters.
     * @param {QueryOptions} opts Query options.
     * @returns {object} Query parameters object.
     */
    static buildQueryObject({
      q,
      filterQueries,
      fields,
      sort,
      rows,
      start,
      facets,
      facetQueries,
      statsFields,
      facetLimit,
      facetMinCount,
      archived,
      group,
      groupField,
      groupLimit,
    }) {
      const params = {
        q,
        rows,
        start,
        wt: "json",
      };

      // fq
      const fqArray = [].concat(filterQueries).flat().filter(Boolean);
      fqArray.forEach((fq) => {
        params.fq = params.fq || [];
        params.fq.push(fq);
      });

      // fl
      if (fields) {
        // If fields is a string, assume it is already formatted
        // as a comma-separated list of fields.
        if (typeof fields === "string") {
          params.fl = fields;
        } else if (Array.isArray(fields)) {
          const fieldsArray = [].concat(fields).flat().filter(Boolean);
          if (fieldsArray.length) {
            params.fl = fieldsArray.join(",");
          }
        }
      }

      // sort
      if (sort) params.sort = sort.replace(/\+/g, " ");

      // facets
      const facetsArray = [].concat(facets).flat().filter(Boolean);
      if (facetsArray.length) {
        params.facet = "true";
        facetsArray.forEach((field) => {
          params["facet.field"] = params["facet.field"] || [];
          params["facet.field"].push(field);
        });
        params["facet.mincount"] = facetMinCount;
        params["facet.limit"] = facetLimit;
        params["facet.sort"] = "index";
      }

      // facet queries
      const facetQueriesArray = [].concat(facetQueries).flat().filter(Boolean);
      if (facetQueriesArray.length) {
        params.facet = "true";
        facetQueriesArray.forEach((fq) => {
          params["facet.query"] = params["facet.query"] || [];
          params["facet.query"].push(fq);
        });
      }

      // stats
      const statsFieldsArray = [].concat(statsFields).flat().filter(Boolean);
      if (statsFieldsArray.length) {
        params["stats"] = "true";
        statsFieldsArray.forEach((field) => {
          params["stats.field"] = params["stats.field"] || [];
          params["stats.field"].push(field);
        });
      }

      // TODO - are there other values possible for the archived param?
      if (archived) {
        params["archived"] = "archived:*";
      }

      // groups
      if (group) {
        params.group = "true";
        if (groupField) {
          if (typeof groupField === "string") {
            params["group.field"] = groupField;
          } else if (Array.isArray(groupField)) {
            params["group.field"] = groupField.join(",");
          } else {
            throw new TypeError(
              "QueryService.buildQueryObject(): groupField must be a string or array.",
            );
          }
        }
        if (typeof groupLimit === "number") {
          params["group.limit"] = groupLimit;
        }
      }

      return params;
    }

    /**
     * Decide whether to use POST or GET for the query. If `explicit` is
     * provided, it overrides the auto-decision. If `disableQueryPOSTs` is set,
     * always use GET. If the query string length exceeds `maxQueryLength`, use
     * POST.
     * @param {object} options The options to decide POST/GET.
     * @param {boolean} [options.explicit] Explicitly force POST or GET.
     * @param {object} options.queryParams The query parameters to evaluate.
     * @param {string} options.urlBase The base URL for the query service.
     * @returns {boolean} `true` for POST, `false` for GET.
     */
    static decidePost({ explicit, queryParams, urlBase }) {
      if (typeof explicit === "boolean") return explicit;

      // Safely read disableQueryPOSTs; default to false
      const disablePost = !!MetacatUI?.appModel?.get("disableQueryPOSTs");
      if (disablePost) return false;

      // Use default when maxQueryLength isn’t configured
      const maxLen =
        MetacatUI?.appModel?.get("maxQueryLength") ?? DEFAULT_MAX_QUERY_LEN;

      const qs = QueryService.toQueryString(queryParams);
      return urlBase.length + 1 + qs.length > maxLen;
    }

    /**
     * Convert an object to a URL query string. Handles arrays by appending each
     * item with the same key.
     * @param {object} obj The object to convert.
     * @returns {string} The URL-encoded query string.
     */
    static toQueryString(obj) {
      const usp = new URLSearchParams();
      Object.entries(obj).forEach(([k, v]) => {
        if (Array.isArray(v)) {
          v.forEach((item) => usp.append(k, item));
        } else {
          usp.append(k, v);
        }
      });
      return usp.toString();
    }

    /**
     * Build GET ajax settings for a query.
     * @param {string} urlBase The base URL for the query service.
     * @param {object} queryParams The query parameters to include.
     * @returns {object} jQuery AJAX settings object.
     */
    static buildGetSettings(urlBase, queryParams) {
      const qs = QueryService.toQueryString(queryParams);
      const url = urlBase + (urlBase.includes("?") ? "" : "?") + qs;
      return {
        url,
        type: "GET",
        dataType: "json",
      };
    }

    /**
     * Build POST ajax settings for a query.
     * @param {string} urlBase The base URL for the query service.
     * @param {object} queryParams The query parameters to include.
     * @returns {object} jQuery AJAX settings object.
     */
    static buildPostSettings(urlBase, queryParams) {
      const fd = new FormData();
      Object.entries(queryParams).forEach(([k, v]) => {
        if (Array.isArray(v)) {
          v.forEach((item) => fd.append(k, item));
        } else {
          fd.append(k, v);
        }
      });
      return {
        url: urlBase,
        type: "POST",
        data: fd,
        contentType: false,
        processData: false,
        dataType: "json",
      };
    }

    /**
     * Merge authentication settings into AJAX options. If `appUserModel` is not
     * available, returns the original options.
     * @param {object} ajaxOpts The AJAX options to merge with auth.
     * @returns {object} Merged AJAX options with authentication headers.
     */
    static mergeAuth(ajaxOpts) {
      if (!MetacatUI.appUserModel?.createAjaxSettings) return ajaxOpts;
      const auth = MetacatUI.appUserModel?.createAjaxSettings();
      return { ...ajaxOpts, ...auth };
    }
  }

  return QueryService;
});
