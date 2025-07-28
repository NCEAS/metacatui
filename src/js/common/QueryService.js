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
     * Execute a Solr query and obtain the raw JSON response.
     * @param {QueryOptions} opts Query parameters & flags.
     * @returns {jqXHR} jQuery AJAX promise.
     */
    static query(opts = {}) {
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
        useAuth = true,
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
      });

      const shouldPost = QueryService.decidePost({
        explicit: usePost,
        queryParams,
        urlBase,
      });

      let ajaxSettings = shouldPost
        ? QueryService.buildPostSettings(urlBase, queryParams)
        : QueryService.buildGetSettings(urlBase, queryParams);

      if (useAuth) {
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
        const fieldsArray = [].concat(fields).flat().filter(Boolean);
        if (fieldsArray.length) {
          params.fl = fieldsArray.join(",");
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
        params.stats = "true";
        statsFieldsArray.forEach((field) => {
          params["stats.field"] = params["stats.field"] || [];
          params["stats.field"].push(field);
        });
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
      const auth = MetacatUI.appUserModel.createAjaxSettings();
      return { ...ajaxOpts, ...auth };
    }
  }

  return QueryService;
});
