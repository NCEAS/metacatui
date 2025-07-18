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
    },
  );
  return QualityReport;
});
