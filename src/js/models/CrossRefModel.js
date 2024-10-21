define(["backbone"], (Backbone) => {
  const CACHE_PREFIX = "crossref_";
  /**
   * @class CrossRef
   * @classdesc Handles querying CrossRef API for metadata about a DOI.
   * @classcategory Models
   * @augments Backbone.Model
   * @constructs
   * @augments Backbone.Model
   * @since 0.0.0
   */
  const CrossRef = Backbone.Model.extend(
    /** @lends CrossRef.prototype */
    {
      /** @inheritdoc */
      type: "CrossRef",

      /**
       * Defaults for the CrossRef model.
       * @type {object}
       * @property {string} baseURL - The base URL for the CrossRef API.
       * @property {string} email - The email address to use for "polite"
       * requests. See https://github.com/CrossRef/rest-api-doc#good-manners--more-reliable-service).
       */
      defaults() {
        return {
          baseURL:
            MetacatUI.appModel.get("crossRefAPI") ||
            "https://api.crossref.org/works/",
          email: MetacatUI.appModel.get("emailContact") || "",
        };
      },

      /** @inheritdoc */
      url() {
        let doi = this.get("doi");
        if (!doi) return null;
        // Make sure the DOI is formatted correctly
        doi = MetacatUI.appModel.removeAllDOIPrefixes(doi);
        this.set("doi", doi);
        const doiStr = encodeURIComponent(doi);
        const email = this.get("email");
        const emailStr = email ? `?mailto:${email}` : "";
        const baseURL = this.get("baseURL");
        const url = `${baseURL}${doiStr}${emailStr}`;
        return url;
      },

      /** @inheritdoc */
      fetch() {
        // first check if there's a cached response
        const doi = this.get("doi");
        const cachedResponse = this.getCachedResponse(doi);
        if (cachedResponse) {
          this.set(cachedResponse);
          this.trigger("sync");
          return;
        }

        const url = this.url();
        if (!url) return;
        const model = this;
        // Make the request using native fetch
        fetch(url)
          .then((response) => {
            if (!response.ok) {
              throw new Error("Network response was not ok");
            }
            return response.json();
          })
          .then((responseJSON) => {
            const parsedData = responseJSON.message;
            model.cacheResponse(doi, parsedData);
            model.set(parsedData);
            model.trigger("sync");
          })
          .catch((error) => {
            model.trigger("error", error);
            model.set("error", "fetchError");
            model.set("errorMessage", error.message);
          });
      },

      /**
       * Cache the response from the CrossRef API
       * @param {string} doi The DOI for the response
       * @param {object} response The response from the CrossRef API
       */
      cacheResponse(doi, response) {
        localStorage.setItem(`${CACHE_PREFIX}${doi}`, JSON.stringify(response));
      },

      /**
       * Get the cached response for a DOI
       * @param {string} doi The DOI to get the cached response for
       * @returns {object|null} The cached response or null if there is no cached response
       */
      getCachedResponse(doi) {
        const cachedResponse = localStorage.getItem(`${CACHE_PREFIX}${doi}`);
        if (!cachedResponse) return null;
        return JSON.parse(cachedResponse);
      },

      /** Clear the cache of CrossRef responses */
      clearCache() {
        const keysToRemove = Object.keys(localStorage).filter((key) =>
          key.startsWith(CACHE_PREFIX),
        );
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      },
    },
  );

  return CrossRef;
});
