define([
  "jquery",
  "underscore",
  "backbone",
  "uuid",
  "models/QualityCheckModel",
], ($, _, Backbone, uuid, QualityCheck) => {
  /**
   *  @class QualityReport
   *  @classdesc A DataPackage represents a hierarchical collection of
   *  packages, metadata, and data objects, modeling an OAI-ORE RDF graph.
   *  TODO: incorporate Backbone.UniqueModel
   * @classcategory Collections
   *  @augments Backbone.Collection
   *  @class
   */
  const QualityReport = Backbone.Collection.extend(
    /** @lends QualityReport.prototype */ {
      // The name of this type of collection
      type: "QualityReport",
      runStatus: null,
      errorDescription: null,
      timestamp: null,

      /** @inheritdoc */
      initialize(_models, options = {}) {
        // Set the id or create a new one
        this.id = options.pid || `urn:uuid:${uuid.v4()}`;

        // this.on("add", this.handleAdd);
        // this.on("successSaving", this.updateRelationships);

        return this;
      },

      /*
       * The QualityReport collection stores a metadata quality
       * report that is generated from the MetaDIG quality engine.
       */
      model: QualityCheck,

      /** @inheritdoc */
      parse(response, _options) {
        // runStatus can be one of "success", "failure", "queued"
        this.runStatus = response.runStatus;
        this.errorDescription = response.errorDescription;
        this.timestamp = response.timestamp;
        return response.result;
      },

      /** @inheritdoc */
      fetch(options) {
        const collectionRef = this;
        let fetchOptions = {};
        if (!options) {
          return null;
        }
        fetchOptions = _.extend(options, {
          url: options.url,
          cache: false,
          contentType: false, // "multipart/form-data",
          processData: false,
          type: "GET",
          // headers: { 'Access-Control-Allow-Origin': 'http://localhost:8081' },
          headers: {
            Accept: "application/json",
          },
          success(_collection, _jqXhr, _options) {
            // collectionRef.run = data;
            collectionRef.trigger("fetchComplete");
          },
          error(_collection, jqXhr, _options) {
            collectionRef.fetchResponse = jqXhr;
            collectionRef.trigger("fetchError");
          },
        });
        // fetchOptions = _.extend(fetchOptions, MetacatUI.appUserModel.createAjaxSettings());
        return Backbone.Collection.prototype.fetch.call(
          collectionRef,
          fetchOptions,
        );
      },

      /**
       * Returns a list of all the results in the collection, grouped by color.
       * @param {Array} results - An array of QualityCheck models.
       * @returns {object} An object with keys for each color (BLUE, GREEN,
       * ORANGE, RED) and an array of results for each color.
       */
      groupResults(results) {
        const groupedResults = _.groupBy(results, (result) => {
          let color;

          const check = result.get("check");
          const status = result.get("status");
          // simple cases
          // always blue for info and skip
          if (check.level === "INFO") {
            color = "BLUE";
            return color;
          }
          if (status === "SKIP") {
            color = "BLUE";
            return color;
          }
          // always green for success
          if (status === "SUCCESS") {
            color = "GREEN";
            return color;
          }

          // handle failures and warnings
          if (status === "FAILURE") {
            color = "RED";
            if (check.level === "OPTIONAL") {
              color = "ORANGE";
            }
          }
          if (status === "ERROR") {
            color = "ORANGE";
            if (check.level === "REQUIRED") {
              color = "RED";
            }
          }
          return color;
        });

        // make sure we have everything, even if empty
        if (!groupedResults.BLUE) {
          groupedResults.BLUE = [];
        }
        if (!groupedResults.GREEN) {
          groupedResults.GREEN = [];
        }
        if (!groupedResults.ORANGE) {
          groupedResults.ORANGE = [];
        }
        if (!groupedResults.RED) {
          groupedResults.RED = [];
        }

        // if (groupedResults.BLUE) {
        //  total = total - groupedResults.BLUE.length;
        // }

        return groupedResults;
      },

      /**
       * Groups the results by their type, excluding those that should not be
       * counted in the totals (ERROR, SKIP, and optional failures).
       * @param {Array} results - An array of QualityCheck models.
       * @returns {object} An object with keys for each check type and an array
       * of results for each type.
       */
      groupByType(results) {
        const groupedResults = _.groupBy(results, (result) => {
          const check = result.get("check");
          const status = result.get("status");

          if (status === "ERROR" || status === "SKIP") {
            // orange or blue
            return "removeMe";
          }
          if (status === "FAILURE" && check.level === "OPTIONAL") {
            // orange
            return "removeMe";
          }

          let type = "";
          // Convert check type to lower case, so that the checks will be
          // grouped correctly, even if one check type has an incorrect capitalization.
          if (check.type != null) {
            // Normalize check type by converting entire string to lowercase
            type = check.type.toLowerCase();
            // Now convert to title case
            type = type.charAt(0).toUpperCase() + type.slice(1);
          }

          return type || "uncategorized";
        });

        // get rid of the ones that should not be counted in our totals
        delete groupedResults.removeMe;

        return groupedResults;
      },

      /**
       * Get the number of results in each group, including a total count.
       * @param {object} groupedResults - An object with keys for each group and
       * an array of results for each group. If not provided, it will use the
       * results from this.models, grouped by color.
       * @returns {object} An object with keys for each group and the count of
       * results in that group, plus a total count.
       * @since 0.0.0
       */
      getCountsPerGroup(groupedResults) {
        const data = groupedResults || this.groupResults(this.models);
        const counts = {};
        Object.entries(data).forEach(([group, items]) => {
          counts[group] = items.length;
        });
        counts.total = this.models.length;
        return counts;
      },

      /**
       * For each result in the collection, check the outputs for identifiers
       * and return a list of all unique ids.
       * @returns {Array} An array of unique output identifiers.
       * @since 0.0.0
       */
      getAllOutputIdentifiers() {
        const identifiers = new Set();
        this.models.forEach((result) => {
          const outputs = result.get("output") || [];
          outputs.forEach((output) => {
            if (output.identifier) {
              identifiers.add(output.identifier);
            }
          });
        });
        return Array.from(identifiers);
      },

      /**
       * For all result outputs in the collection that include identifiers, get
       * the names of those outputs from the Solr index. This is done in batches
       * to avoid exceeding maximum lengths of Solr queries.
       * @returns {Promise<object>} A promise that resolves to an object mapping
       * output identifiers to their names.
       * @since 0.0.0
       */
      async getAllOutputNames() {
        // too many ids per request will make the resust too long, so send in
        // batches.
        const batchSize = 10;
        const ids = this.getAllOutputIdentifiers();
        const promises = [];
        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize);
          promises.push(this.getOutputNames(batch));
        }
        const results = await Promise.all(promises);
        const mergedResults = results.reduce(
          (acc, curr) => ({ ...acc, ...curr }),
          {},
        );
        return mergedResults;
      },

      /**
       * Given a batch of output identifiers, fetch their names from the Solr
       * index. Call getAllOutputNames instead of calling this directly.
       * @param {Array} ids - An array of output identifiers.
       * @returns {Promise<object>} A promise that resolves to an object mapping
       * output identifiers to their names.
       * @since 0.0.0
       */
      getOutputNames(ids) {
        return new Promise((resolve, reject) => {
          // eslint-disable-next-line import/no-dynamic-require
          require(["collections/SolrResults"], (SolrResults) => {
            const query = ids
              .map((id) => `id:"${id}" OR seriesId:"${id}"`)
              .join(" OR ");
            const rows = ids.length * 5; // Set a reasonable limit for the number of search
            const search = new SolrResults([], { query, rows });
            search.setfields("id,title,fileName");
            search.fetch({
              success: (collection) => {
                const results = {};
                collection.each((m) => {
                  results[m.get("id")] = m.get("title") || m.get("fileName");
                });
                resolve(results);
              },
              error: (_collection, response) => {
                reject(response);
              },
            });
          });
        });
      },
    },
  );
  return QualityReport;
});
