define(["jquery", "underscore", "backbone", "promise"], (
  $,
  _,
  Backbone,
  Promise,
) => {
  "use strict";

  /**
   * @class Stats
   * @classdesc This model contains all a collection of statistics/metrics about
   * a collection of DataONE objects
   * @classcategory Models
   * @name Stats
   * @augments Backbone.Model
   * @class
   */
  const Stats = Backbone.Model.extend(
    /** @lends Stats.prototype */ {
      /**
       * Default attributes for Stats models
       * @type {object}
       * @property {string} query - The base query that defines the data
       * collection to get statistis about.
       * @property {string} postQuery - A copy of the `query`, but without any
       * URL encoding
       * @property {boolean} isSystemMetadataQuery - If true, the `query` set on
       * this model is only filtering on system metadata fields which are common
       * between both metadata and data objects.
       * @property {number} metadataCount - The number of metadata objects in
       * this data collection @readonly
       * @property {number} dataCount - The number of data objects in this data
       * collection
       * @property {number} totalCount - The number of metadata and data objects
       * in this data collection. Essentially this is the sum of metadataCount
       * and dataCount
       * @property {number|string[]} metadataFormatIDs - An array of metadata
       * formatIds and the number of metadata objects with that formatId. Uses
       * same structure as Solr facet counts: ["text/csv", 5]
       * @property {number|string[]} dataFormatIDs - An array of data formatIds
       * and the number of data objects with that formatId. Uses same structure
       * as Solr facet counts: ["text/csv", 5]
       * @property {string} firstUpdate - The earliest upload date for any
       * object in this collection, excluding uploads of obsoleted objects
       * @property {number|string[]} dataUpdateDates - An array of date strings
       * and the number of data objects uploaded on that date. Uses same
       * structure as Solr facet counts: ["2015-08-02", 5]
       * @property {number|string[]} metadataUpdateDates An array of date
       * strings and the number of data objects uploaded on that date. Uses same
       * structure as Solr facet counts: ["2015-08-02", 5]
       * @property {string} firstBeginDate - An ISO date string of the earliest
       * year that this data collection describes, from the science metadata
       * @property {string} lastEndDate - An ISO date string of the latest year
       * that this data collection describes, from the science metadata
       * @property {string} firstPossibleDate - The first possible date (as a
       * string) that data could have been collected. This is to weed out badly
       * formatted dates when sending queries.
       * @property {object} temporalCoverage A simple object of date ranges (the
       * object key) and the number of metadata objects uploaded in that date
       * range (the object value). Example: { "1990-2000": 5 }
       * @property {number} queryCoverageFrom - The year to start the temporal
       * coverage range query
       * @property {number} queryCoverageUntil - The year to end the temporal
       * coverage range query
       * @property {number} metadataTotalSize - The total number of bytes of all
       * metadata files
       * @property {number} dataTotalSize - The total number of bytes of all
       * data files
       * @property {number} totalSize - The total number of bytes or metadata
       * and data files
       * @property {boolean} hideMetadataAssessment - If true, metadata
       * assessment scores will not be retrieved
       * @property {Image} mdqScoresImage - The Image objet of an aggregated
       * metadata assessment chart
       * @property {number} maxQueryLength - The maximum query length that will
       * be sent via GET to the query service. Queries that go beyond this
       * length will be sent via POST, if POST is enabled in the AppModel
       * @property {string} mdqImageId - The identifier to use in the request
       * for the metadata assessment chart
       */
      defaults() {
        return {
          query: "*:* ",
          postQuery: "",
          isSystemMetadataQuery: false,

          metadataCount: 0,
          dataCount: 0,
          totalCount: 0,

          metadataFormatIDs: [],
          dataFormatIDs: [],

          firstUpload: 0,
          totalUploads: 0,
          metadataUploads: null,
          dataUploads: null,
          metadataUploadDates: null,
          dataUploadDates: null,

          firstUpdate: null,
          dataUpdateDates: null,
          metadataUpdateDates: null,

          firstBeginDate: null,
          lastEndDate: null,
          firstPossibleDate: "1800-01-01T00:00:00Z",
          temporalCoverage: 0,
          queryCoverageFrom: null,
          queryCoverageUntil: null,

          metadataTotalSize: null,
          dataTotalSize: null,
          totalSize: null,

          hideMetadataAssessment: false,
          mdqScoresImage: null,
          mdqImageId: null,

          // HTTP GET requests are typically limited to 2,083 characters. So
          // query lengths should have this maximum before switching over to
          // HTTP POST
          maxQueryLength: 2000,
        };
      },

      /**
       * This function serves as a shorthand way to get all of the statistics
       * stored in the model
       */
      getAll() {
        // Only get the MetaDIG scores if MetacatUI is configured to display
        // metadata assesments AND this model has them enabled, too.
        if (
          !MetacatUI.appModel.get("hideSummaryMetadataAssessment") &&
          !this.get("hideMetadataAssessment")
        ) {
          this.getMdqScores();
        }

        // Send the call the get both the metadata and data stats
        this.getMetadataStats();
        this.getDataStats();
      },

      /**
       * Queries for statistics about metadata objects
       */
      getMetadataStats() {
        let query = this.get("query");
        // Filter out the portal and collection documents
        const filterQuery =
          "-formatId:*dataone.org/collections* AND -formatId:*dataone.org/portals* AND formatType:METADATA AND -obsoletedBy:*";
        // Use the stats feature to get the sum of the file size
        const stats = "true";
        const statsField = "size";
        // Get the facet counts for formatIds
        const facet = "true";
        const facetFormatIdField = "formatId";
        const facetFormatIdMin = "1";
        const facetFormatIdMissing = "false";
        const facetLimit = "-1";
        // Get the upload counts for each month
        const facetRange = "dateUploaded";
        const facetRangeGap = "+1MONTH";
        const facetRangeStart = "1900-01-01T00:00:00.000Z";
        const facetRangeEnd = new Date().toISOString();
        const facetMissing = "true";
        // Query for the temporal coverage ranges
        const facetQueries = [];
        const facetBeginDateField = "beginDate";
        const facetEndDateField = "endDate";
        const facetDateMin = "1";
        const facetDateMissing = "false";
        // Don't return any result docs
        const rows = "0";
        // Use JSON for the response format
        const wt = "json";

        let beginDateLimit;
        let endDateLimit;

        // How many years back should we look for temporal coverage?
        const lastYear =
          this.get("queryCoverageUntil") || new Date().getUTCFullYear();
        const firstYear = this.get("queryCoverageFrom") || 1950;
        const totalYears = lastYear - firstYear;
        const today = new Date().getUTCFullYear();
        const yearsFromToday = {
          fromBeginning: today - firstYear,
          fromEnd: today - lastYear,
        };

        // Determine our year range/bin size
        let binSize = 1;

        if (totalYears > 10 && totalYears <= 20) {
          binSize = 2;
        } else if (totalYears > 20 && totalYears <= 50) {
          binSize = 5;
        } else if (totalYears > 50 && totalYears <= 100) {
          binSize = 10;
        } else if (totalYears > 100) {
          binSize = 25;
        }

        // Count all the datasets with coverage before the first year in the
        // year range queries
        beginDateLimit = new Date(
          Date.UTC(firstYear - 1, 11, 31, 23, 59, 59, 999),
        );
        facetQueries.push(
          `{!key=<${firstYear}}(beginDate:[* TO ${beginDateLimit.toISOString()}/YEAR])`,
        );

        // Construct our facet.queries for the beginDate and endDates, starting
        // with all years before this current year
        let key = "";

        for (
          let yearsAgo = yearsFromToday.fromBeginning;
          yearsAgo >= yearsFromToday.fromEnd && yearsAgo > 0;
          yearsAgo -= binSize
        ) {
          // The query logic here is: If the beginnning year is anytime before
          // or during the last year of the bin AND the ending year is anytime
          // after or during the first year of the bin, it counts.
          if (binSize === 1) {
            // Querying for just the current year needs to be treated a bit
            // differently and won't be caught in our for loop
            if (lastYear === today) {
              const oneYearFromNow = new Date(Date.UTC(today + 1, 0, 1));
              const now = new Date();

              facetQueries.push(
                `{!key=${lastYear}}(beginDate:[* TO ${oneYearFromNow.toISOString()}/YEAR] AND endDate:[${now.toISOString()}/YEAR TO *])`,
              );
            } else {
              key = today - yearsAgo;

              // The coverage should start sometime in this year range or
              // earlier.
              beginDateLimit = new Date(Date.UTC(today - (yearsAgo - 1), 0, 1));
              // The coverage should end sometime in this year range or later.
              endDateLimit = new Date(Date.UTC(today - yearsAgo, 0, 1));

              facetQueries.push(
                `{!key=${key}}(beginDate:[* TO ${beginDateLimit.toISOString()}/YEAR] AND endDate:[${endDateLimit.toISOString()}/YEAR TO *])`,
              );
            }
          }
          // If this is the last date range
          else if (yearsAgo <= binSize) {
            // Get the last year that will be included in this bin
            const firstYearInBin = today - yearsAgo;
            const lastYearInBin = lastYear;

            // Label the facet query with a key for easier parsing Because this
            // is the last year range, which could be uneven with the other year
            // ranges, use the exact end year
            key = `${firstYearInBin}-${lastYearInBin}`;

            // The coverage should start sometime in this year range or earlier.
            // Because this is the last year range, which could be uneven with
            // the other year ranges, use the exact end year
            beginDateLimit = new Date(
              Date.UTC(lastYearInBin, 11, 31, 23, 59, 59, 999),
            );
            // The coverage should end sometime in this year range or later.
            endDateLimit = new Date(Date.UTC(firstYearInBin, 0, 1));

            facetQueries.push(
              `{!key=${key}}(beginDate:[* TO ${beginDateLimit.toISOString()}/YEAR] AND endDate:[${endDateLimit.toISOString()}/YEAR TO *])`,
            );
          }
          // For all other bins,
          else {
            // Get the last year that will be included in this bin
            const firstYearInBin = today - yearsAgo;
            const lastYearInBin = today - yearsAgo + binSize - 1;

            // Label the facet query with a key for easier parsing
            key = `${firstYearInBin}-${lastYearInBin}`;

            // The coverage should start sometime in this year range or earlier.
            //  var beginDateLimit = new Date(Date.UTC(today - (yearsAgo -
            //  binSize), 0, 1));
            beginDateLimit = new Date(
              Date.UTC(lastYearInBin, 11, 31, 23, 59, 59, 999),
            );
            // The coverage should end sometime in this year range or later.
            endDateLimit = new Date(Date.UTC(firstYearInBin, 0, 1));

            facetQueries.push(
              `{!key=${key}}(beginDate:[* TO ${beginDateLimit.toISOString()}/YEAR] AND endDate:[${endDateLimit.toISOString()}/YEAR TO *])`,
            );
          }
        }

        const model = this;
        const successCallback = (data, _textStatus, _xhr) => {
          if (!data || !data.response || !data.response.numFound) {
            // Store falsey data
            model.set("totalCount", 0);
            model.trigger("change:totalCount");
            model.set("metadataCount", 0);
            model.trigger("change:metadataCount");
            model.set("metadataFormatIDs", ["", 0]);
            model.set("firstUpdate", null);
            model.set("metadataUpdateDates", []);
            model.set("temporalCoverage", 0);
            model.trigger("change:temporalCoverage");
          } else {
            // Save tthe number of metadata docs found
            model.set("metadataCount", data.response.numFound);
            model.set(
              "totalCount",
              model.get("dataCount") + data.response.numFound,
            );

            // Save the format ID facet counts
            if (
              data.facet_counts &&
              data.facet_counts.facet_fields &&
              data.facet_counts.facet_fields.formatId
            ) {
              model.set(
                "metadataFormatIDs",
                data.facet_counts.facet_fields.formatId,
              );
            } else {
              model.set("metadataFormatIDs", ["", 0]);
            }

            // Save the metadata update date counts
            if (
              data.facet_counts &&
              data.facet_counts.facet_ranges &&
              data.facet_counts.facet_ranges.dateUploaded
            ) {
              // Find the index of the first update date
              const updateFacets =
                data.facet_counts.facet_ranges.dateUploaded.counts;
              let cropAt = 0;

              for (let i = 1; i < updateFacets.length; i += 2) {
                // If there was at least one update/upload in this date range,
                // then save this as the first update
                if (
                  typeof updateFacets[i] === "number" &&
                  updateFacets[i] > 0
                ) {
                  // Save the first first update date
                  cropAt = i;
                  model.set("firstUpdate", updateFacets[i - 1]);
                  // Save the update dates, but crop out months that are empty
                  model.set(
                    "metadataUpdateDates",
                    updateFacets.slice(cropAt + 1),
                  );
                  i = updateFacets.length;
                }
              }

              // If no update dates were found, save falsey values
              if (cropAt === 0) {
                model.set("firstUpdate", null);
                model.set("metadataUpdateDates", []);
              }
            }

            // Save the temporal coverage dates
            if (data.facet_counts && data.facet_counts.facet_queries) {
              // Find the beginDate and facets so we can store the earliest
              // beginDate
              if (
                data.facet_counts.facet_fields &&
                data.facet_counts.facet_fields.beginDate
              ) {
                const earliestBeginDate = _.find(
                  data.facet_counts.facet_fields.beginDate,
                  (value) =>
                    typeof value === "string" &&
                    parseInt(value.substring(0, 4), 10) > 1000,
                );
                if (earliestBeginDate) {
                  model.set("firstBeginDate", earliestBeginDate);
                }
              }

              // Find the endDate and facets so we can store the latest endDate
              if (
                data.facet_counts.facet_fields &&
                data.facet_counts.facet_fields.endDate
              ) {
                let latestEndDate;
                const endDates = data.facet_counts.facet_fields.endDate;
                const nextYear = new Date().getUTCFullYear() + 1;
                let i = 0;

                // Iterate over each endDate and find the first valid one.
                // (After year 1000 but not after today)
                while (!latestEndDate && i < endDates.length) {
                  let endDate = endDates[i];
                  if (typeof endDate === "string") {
                    endDate = parseInt(endDate.substring(0, 3), 10);
                    if (endDate > 1000 && endDate < nextYear) {
                      latestEndDate = endDate;
                    }
                  }
                  i += 1;
                }

                // Save the latest endDate if one was found
                if (latestEndDate) {
                  model.set("lastEndDate", latestEndDate);
                }
              }

              // Save the temporal coverage year ranges
              const tempCoverages = data.facet_counts.facet_queries;
              model.set("temporalCoverage", tempCoverages);
            }

            // Get the total size of all the files in the index
            if (
              data.stats &&
              data.stats.stats_fields &&
              data.stats.stats_fields.size &&
              data.stats.stats_fields.size.sum
            ) {
              // Save the size sum
              model.set("metadataTotalSize", data.stats.stats_fields.size.sum);
              // If there is a data size sum,
              if (typeof model.get("dataTotalSize") === "number") {
                // Add it to the metadata size sum as the total sum
                model.set(
                  "totalSize",
                  model.get("dataTotalSize") + data.stats.stats_fields.size.sum,
                );
              }
            }
          }
        };

        let requestSettings = {};

        // Construct the full URL for the query
        const fullQueryURL = `${MetacatUI.appModel.get(
          "queryServiceUrl",
        )}q=${query}&fq=${filterQuery}&stats=${stats}&stats.field=${statsField}&facet=${facet}&facet.field=${facetFormatIdField}&facet.field=${facetBeginDateField}&facet.field=${facetEndDateField}&f.${facetFormatIdField}.facet.mincount=${facetFormatIdMin}&f.${facetFormatIdField}.facet.missing=${facetFormatIdMissing}&f.${facetBeginDateField}.facet.mincount=${facetDateMin}&f.${facetEndDateField}.facet.mincount=${facetDateMin}&f.${facetBeginDateField}.facet.missing=${facetDateMissing}&f.${facetEndDateField}.facet.missing=${facetDateMissing}&facet.limit=${facetLimit}&f.${facetRange}.facet.missing=${facetMissing}&facet.range=${facetRange}&facet.range.start=${facetRangeStart}&facet.range.end=${facetRangeEnd}&facet.range.gap=${encodeURIComponent(
          facetRangeGap,
        )}&facet.query=${facetQueries.join(
          "&facet.query=",
        )}&rows=${rows}&wt=${wt}`;

        if (this.getRequestType(fullQueryURL) === "POST") {
          if (this.get("postQuery")) {
            query = this.get("postQuery");
          } else if (this.get("searchModel")) {
            query = this.get("searchModel").getQuery(undefined, {
              forPOST: true,
            });
            this.set("postQuery", query);
          }

          const queryData = new FormData();
          queryData.append("q", decodeURIComponent(query));
          queryData.append("fq", filterQuery);
          queryData.append("stats", stats);
          queryData.append("stats.field", statsField);
          queryData.append("facet", facet);
          queryData.append("facet.field", facetFormatIdField);
          queryData.append("facet.field", facetBeginDateField);
          queryData.append("facet.field", facetEndDateField);
          queryData.append(
            `f.${facetFormatIdField}.facet.mincount`,
            facetFormatIdMin,
          );
          queryData.append(
            `f.${facetFormatIdField}.facet.missing`,
            facetFormatIdMissing,
          );
          queryData.append(
            `f.${facetBeginDateField}.facet.mincount`,
            facetDateMin,
          );
          queryData.append(
            `f.${facetEndDateField}.facet.mincount`,
            facetDateMin,
          );
          queryData.append(
            `f.${facetBeginDateField}.facet.missing`,
            facetDateMissing,
          );
          queryData.append(
            `f.${facetEndDateField}.facet.missing`,
            facetDateMissing,
          );
          queryData.append("facet.limit", facetLimit);
          queryData.append("facet.range", facetRange);
          queryData.append("facet.range.start", facetRangeStart);
          queryData.append("facet.range.end", facetRangeEnd);
          queryData.append("facet.range.gap", facetRangeGap);
          queryData.append(`f.${facetRange}.facet.missing`, facetMissing);
          queryData.append("rows", rows);
          queryData.append("wt", wt);

          // Add the facet queries to the POST body
          _.each(facetQueries, (facetQuery) => {
            queryData.append("facet.query", facetQuery);
          });

          // Create the request settings for POST requests
          requestSettings = {
            url: MetacatUI.appModel.get("queryServiceUrl"),
            type: "POST",
            contentType: false,
            processData: false,
            data: queryData,
            dataType: "json",
            success: successCallback,
          };
        } else {
          // Create the request settings for GET requests
          requestSettings = {
            url: fullQueryURL,
            type: "GET",
            dataType: "json",
            success: successCallback,
          };
        }

        // Send the request
        $.ajax(
          _.extend(
            requestSettings,
            MetacatUI.appUserModel.createAjaxSettings(),
          ),
        );
      },

      /**
       * Queries for statistics about data objects
       */
      getDataStats() {
        // Get the query string from this model
        let query = this.get("query") || "";
        // If there is a query set on the model, do a join on the resourceMap
        // field
        if (
          query.trim() !== "*:*" &&
          query.trim().length > 0 &&
          !this.get("isSystemMetadataQuery") &&
          MetacatUI.appModel.get("enableSolrJoins")
        ) {
          query = `{!join from=resourceMap to=resourceMap}${query}`;
        }

        // Filter out resource maps and metatdata objects
        const filterQuery = "formatType:DATA AND -obsoletedBy:*";
        // Use the stats feature to get the sum of the file size
        const stats = "true";
        const statsField = "size";
        // Get the facet counts for formatIds
        const facet = "true";
        const facetField = "formatId";
        const facetFormatIdMin = "1";
        const facetFormatIdMissing = "false";
        const facetLimit = "-1";
        // Get the upload counts for each month
        const facetRange = "dateUploaded";
        const facetRangeGap = "+1MONTH";
        const facetRangeStart = "1900-01-01T00:00:00.000Z";
        const facetRangeEnd = new Date().toISOString();
        const facetRangeMissing = "true";
        // Don't return any result docs
        const rows = "0";
        // Use JSON for the response format
        const wt = "json";

        const fullQueryURL = `${MetacatUI.appModel.get(
          "queryServiceUrl",
        )}q=${query}&fq=${filterQuery}&stats=${stats}&stats.field=${statsField}&facet=${facet}&facet.field=${facetField}&facet.limit=${facetLimit}&f.${facetField}.facet.mincount=${facetFormatIdMin}&f.${facetField}.facet.missing=${facetFormatIdMissing}&f.${facetRange}.facet.missing=${facetRangeMissing}&facet.range=${facetRange}&facet.range.start=${facetRangeStart}&facet.range.end=${facetRangeEnd}&facet.range.gap=${encodeURIComponent(
          facetRangeGap,
        )}&rows=${rows}&wt=${wt}`;

        const model = this;
        const successCallback = (data, _textStatus, _xhr) => {
          if (!data || !data.response || !data.response.numFound) {
            // Store falsey data
            model.set("dataCount", 0);
            model.trigger("change:dataCount");
            model.set("dataFormatIDs", ["", 0]);
            model.set("dataUpdateDates", []);
            model.set("dataTotalSize", 0);

            if (typeof model.get("metadataTotalSize") === "number") {
              // Use the metadata total size as the total size
              model.set("totalSize", model.get("metadataTotalSize"));
            }
          } else {
            // Save the number of data docs found
            model.set("dataCount", data.response.numFound);
            model.set(
              "totalCount",
              model.get("metadataCount") + data.response.numFound,
            );

            // Save the format ID facet counts
            if (
              data.facet_counts &&
              data.facet_counts.facet_fields &&
              data.facet_counts.facet_fields.formatId
            ) {
              model.set(
                "dataFormatIDs",
                data.facet_counts.facet_fields.formatId,
              );
            } else {
              model.set("dataFormatIDs", ["", 0]);
            }

            // Save the data update date counts
            if (
              data.facet_counts &&
              data.facet_counts.facet_ranges &&
              data.facet_counts.facet_ranges.dateUploaded
            ) {
              // Find the index of the first update date
              const updateFacets =
                data.facet_counts.facet_ranges.dateUploaded.counts;
              let cropAt = 0;

              for (let i = 1; i < updateFacets.length; i += 2) {
                // If there was at least one update/upload in this date range,
                // then save this as the first update
                if (
                  typeof updateFacets[i] === "number" &&
                  updateFacets[i] > 0
                ) {
                  // Save the first first update date
                  cropAt = i;
                  model.set("firstUpdate", updateFacets[i - 1]);
                  // Save the update dates, but crop out months that are empty
                  model.set("dataUpdateDates", updateFacets.slice(cropAt + 1));
                  i = updateFacets.length;
                }
              }

              // If no update dates were found, save falsey values
              if (cropAt === 0) {
                model.set("firstUpdate", null);
                model.set("dataUpdateDates", []);
              }
            }

            // Get the total size of all the files in the index
            if (
              data.stats &&
              data.stats.stats_fields &&
              data.stats.stats_fields.size &&
              data.stats.stats_fields.size.sum
            ) {
              // Save the size sum
              model.set("dataTotalSize", data.stats.stats_fields.size.sum);
              // If there is a metadata size sum,
              if (model.get("metadataTotalSize") > 0) {
                // Add it to the data size sum as the total sum
                model.set(
                  "totalSize",
                  model.get("metadataTotalSize") +
                    data.stats.stats_fields.size.sum,
                );
              }
            }
          }
        };

        // Default to GET requests
        let requestSettings = {
          url: fullQueryURL,
          type: "GET",
          dataType: "json",
          success: successCallback,
        };

        // If the query is too long, switch to POST requests
        if (this.getRequestType(fullQueryURL) === "POST") {
          if (this.get("postQuery")) {
            query = this.get("postQuery");
          } else if (this.get("searchModel")) {
            query = this.get("searchModel").getQuery(undefined, {
              forPOST: true,
            });
            this.set("postQuery", query);
          }

          const queryData = new FormData();
          queryData.append("q", decodeURIComponent(query));
          queryData.append("fq", filterQuery);
          queryData.append("stats", stats);
          queryData.append("stats.field", statsField);
          queryData.append("facet", facet);
          queryData.append("facet.field", facetField);
          queryData.append("facet.limit", facetLimit);
          queryData.append(`f.${facetField}.facet.mincount`, facetFormatIdMin);
          queryData.append(
            `f.${facetField}.facet.missing`,
            facetFormatIdMissing,
          );
          queryData.append(`f.${facetRange}.facet.missing`, facetRangeMissing);
          queryData.append("facet.range", facetRange);
          queryData.append("facet.range.start", facetRangeStart);
          queryData.append("facet.range.end", facetRangeEnd);
          queryData.append("facet.range.gap", facetRangeGap);
          queryData.append("rows", rows);
          queryData.append("wt", wt);

          // Create the request settings for POST requests
          requestSettings = {
            url: MetacatUI.appModel.get("queryServiceUrl"),
            type: "POST",
            contentType: false,
            processData: false,
            data: queryData,
            dataType: "json",
            success: successCallback,
          };
        }

        // Send the request
        $.ajax(
          _.extend(
            requestSettings,
            MetacatUI.appUserModel.createAjaxSettings(),
          ),
        );
      },

      /**
       * Retrieves an image of the metadata assessment scores
       */
      getMdqScores() {
        try {
          const myImage = new Image();
          const model = this;
          myImage.crossOrigin = ""; // or "anonymous"

          // Call the function with the URL we want to load, but then chain the
          // promise then() method on to the end of it. This contains two
          // callbacks
          const serviceUrl = MetacatUI.appModel.get("mdqScoresServiceUrl");

          if (!serviceUrl) {
            this.set("mdqScoresImage", this.defaults().mdqScoresImage);
            this.trigger("change:mdqScoresImage");
            return;
          }

          if (
            Array.isArray(MetacatUI.appModel.get("mdqAggregatedSuiteIds")) &&
            MetacatUI.appModel.get("mdqAggregatedSuiteIds").length
          ) {
            const suite = MetacatUI.appModel.get("mdqAggregatedSuiteIds")[0];

            let id;

            if (
              this.get("mdqImageId") &&
              typeof this.get("mdqImageId") === "string"
            ) {
              id = this.get("mdqImageId");
            } else if (MetacatUI.appView.currentView) {
              id = MetacatUI.appView.currentView.model.get("seriesId");
            }

            // If no ID was found, exit without getting the image
            if (!id) {
              return;
            }

            const url = `${serviceUrl}?id=${id}&suite=${suite}`;

            this.imgLoad(url).then((response) => {
              // The first runs when the promise resolves, with the
              // request.reponse specified within the resolve() method.
              const imageURL = window.URL.createObjectURL(response);
              myImage.src = imageURL;
              model.set("mdqScoresImage", myImage);
              // The second runs when the promise is rejected, and logs the
              // Error specified with the reject() method.
            });
          } else {
            this.set("mdqScoresImage", this.defaults().mdqScoresImage);
          }
        } catch (e) {
          // If the image fails to load, set the mdqScoresImage to null
          this.set("mdqScoresImage", this.defaults().mdqScoresImage);
          this.trigger("change:mdqScoresImage");
          this.set("mdqScoresError", e.message || "Image failed to load");
        }
      },

      /**
       * Retrieves an image via a Promise. Primarily used by
       * {@link Stats#getMdqScores}
       * @param {string} url - The URL of the image
       * @returns {Promise} A Promise that resolves with the image Blob if the
       * request is successful, or rejects with an Error if it fails
       */
      imgLoad(url) {
        // Create new promise with the Promise() constructor; This has as its
        // argument a function with two parameters, resolve and reject
        const model = this;
        return new Promise((resolve, reject) => {
          // Standard XHR to load an image
          const request = new XMLHttpRequest();
          request.open("GET", url);
          request.responseType = "blob";

          // When the request loads, check whether it was successful
          request.onload = () => {
            if (request.status === 200) {
              // If successful, resolve the promise by passing back the request
              // response
              resolve(request.response);
            } else {
              // If it fails, reject the promise with a error message
              reject(
                new Error(
                  `Image didn't load successfully; error code:${request.statusText}`,
                ),
              );
              model.set("mdqScoresError", request.statusText);
            }
          };

          request.onerror = () => {
            // Also deal with the case when the entire request fails to begin
            // with This is probably a network error, so reject the promise with
            // an appropriate message
            reject(new Error("There was a network error."));
          };

          // Send the request
          request.send();
        });
      },

      /**
       * Sends a Solr query to get the earliest beginDate. If there are no
       * beginDates in the index, then it searches for the earliest endDate.
       */
      getFirstBeginDate() {
        const model = this;

        // Define a success callback when the query is successful
        const successCallback = (data, _textStatus, _xhr) => {
          // If nothing was found...
          if (!data || !data.response || !data.response.numFound) {
            // Construct a query to find the earliest endDate
            const query =
              `${model.get("query")} AND endDate:[${model.get(
                "firstPossibleDate",
              )} TO ${new Date().toISOString()}]` + // Use date filter to weed out badly formatted data
              ` AND -obsoletedBy:*`;
            // Get one row only
            const rows = "1";
            // Sort the results in ascending order
            const sort = "endDate asc";
            // Return only the endDate field
            const fl = "endDate";

            const successCallbackNested = (
              endDateData,
              _textStatusNested,
              _xhrNested,
            ) => {
              // If not endDates or beginDates are found, there is no temporal
              // data in the index, so save falsey values
              if (
                !endDateData ||
                !endDateData.response ||
                !endDateData.response.numFound
              ) {
                model.set("firstBeginDate", null);
                model.set("lastEndDate", null);
              } else {
                model.set(
                  "firstBeginDate",
                  new Date(endDateData.response.docs[0].endDate),
                );
              }
            };

            let requestSettings = {};

            if (model.get("usePOST")) {
              const queryData = new FormData();
              queryData.append("q", decodeURIComponent(query));
              queryData.append("rows", rows);
              queryData.append("sort", sort);
              queryData.append("fl", fl);
              queryData.append("wt", "json");

              requestSettings = {
                url: MetacatUI.appModel.get("queryServiceUrl"),
                type: "POST",
                contentType: false,
                processData: false,
                data: queryData,
                dataType: "json",
                success: successCallbackNested,
              };
            } else {
              // Find the earliest endDate if there are no beginDates
              requestSettings = {
                url: `${MetacatUI.appModel.get(
                  "queryServiceUrl",
                )}q=${query}&rows=${rows}&sort=${sort}&fl=${fl}&wt=json`,
                type: "GET",
                dataType: "json",
                success: successCallbackNested,
              };
            }

            $.ajax(
              _.extend(
                requestSettings,
                MetacatUI.appUserModel.createAjaxSettings(),
              ),
            );
          } else {
            // Save the earliest beginDate
            model.set(
              "firstBeginDate",
              new Date(data.response.docs[0].beginDate),
            );
            model.trigger("change:firstBeginDate");
          }
        };

        // Construct a query
        const specialQueryParams = ` AND beginDate:[${this.get(
          "firstPossibleDate",
        )} TO ${new Date().toISOString()}] AND -obsoletedBy:* AND -formatId:*dataone.org/collections* AND -formatId:*dataone.org/portals*`;
        let query = this.get("query") + specialQueryParams;
        // Get one row only
        const rows = "1";
        // Sort the results in ascending order
        const sort = "beginDate asc";
        // Return only the beginDate field
        const fl = "beginDate";

        let requestSettings = {};

        if (this.get("usePOST")) {
          // Get the unencoded query string
          if (this.get("postQuery")) {
            query = this.get("postQuery") + specialQueryParams;
          } else if (this.get("searchModel")) {
            query = this.get("searchModel").getQuery(undefined, {
              forPOST: true,
            });
            this.set("postQuery", query);
            query += specialQueryParams;
          }

          const queryData = new FormData();
          queryData.append("q", decodeURIComponent(query));
          queryData.append("rows", rows);
          queryData.append("sort", sort);
          queryData.append("fl", fl);
          queryData.append("wt", "json");

          requestSettings = {
            url: MetacatUI.appModel.get("queryServiceUrl"),
            type: "POST",
            contentType: false,
            processData: false,
            data: queryData,
            dataType: "json",
            success: successCallback,
          };
        } else {
          requestSettings = {
            url: `${MetacatUI.appModel.get(
              "queryServiceUrl",
            )}q=${query}&rows=${rows}&fl=${fl}&sort=${sort}&wt=json`,
            type: "GET",
            dataType: "json",
            success: successCallback,
          };
        }

        // Send the query
        $.ajax(
          _.extend(
            requestSettings,
            MetacatUI.appUserModel.createAjaxSettings(),
          ),
        );
      },

      // Getting total number of replicas for repository profiles
      getTotalReplicas(memberNodeID) {
        const model = this;

        const requestSettings = {
          url:
            `${MetacatUI.appModel.get(
              "queryServiceUrl",
            )}q=replicaMN:${memberNodeID} AND  -datasource:${memberNodeID} AND formatType:METADATA` +
            ` AND -obsoletedBy:*` +
            ` &wt=json&rows=0`,
          type: "GET",
          dataType: "json",
          success(data, _textStatus, _xhr) {
            model.set("totalReplicas", data.response.numFound);
          },
          error(_data, _textStatus, _xhr) {
            model.set("totalReplicas", 0);
          },
        };

        $.ajax(
          _.extend(
            requestSettings,
            MetacatUI.appUserModel.createAjaxSettings(),
          ),
        );
      },

      /**
       * Gets the latest endDate from the Solr index
       */
      getLastEndDate() {
        const model = this;

        const now = new Date();

        // Get the latest temporal data coverage year
        const specialQueryParams =
          ` AND endDate:[${this.get(
            "firstPossibleDate",
          )} TO ${now.toISOString()}]` + // Use date filter to weed out badly formatted data
          ` AND -obsoletedBy:* AND -formatId:*dataone.org/collections* AND -formatId:*dataone.org/portals*`;
        let query = this.get("query") + specialQueryParams;
        const rows = 1;
        const fl = "endDate";
        const sort = "endDate desc";
        const wt = "json";

        const successCallback = (response, _textStatus, _xhr) => {
          let data = response;
          if (typeof data === "string") {
            data = JSON.parse(data);
          }

          if (!data || !data.response || !data.response.numFound) {
            // Save some falsey values if none are found
            model.set("lastEndDate", null);
          } else {
            // Save the earliest beginDate and total found in our model - but do
            // not accept a year greater than this current year
            if (
              new Date(data.response.docs[0].endDate).getUTCFullYear() >
              now.getUTCFullYear()
            ) {
              model.set("lastEndDate", now);
            } else {
              model.set("lastEndDate", new Date(data.response.docs[0].endDate));
            }

            model.trigger("change:lastEndDate");
          }
        };

        let requestSettings = {};
        if (this.get("usePOST")) {
          // Get the unencoded query string
          if (this.get("postQuery")) {
            query = this.get("postQuery") + specialQueryParams;
          } else if (this.get("searchModel")) {
            query = this.get("searchModel").getQuery(undefined, {
              forPOST: true,
            });
            this.set("postQuery", query);
            query += specialQueryParams;
          }

          const queryData = new FormData();
          queryData.append("q", decodeURIComponent(query));
          queryData.append("rows", rows);
          queryData.append("sort", sort);
          queryData.append("fl", fl);
          queryData.append("wt", "json");

          requestSettings = {
            url: MetacatUI.appModel.get("queryServiceUrl"),
            type: "POST",
            contentType: false,
            processData: false,
            data: queryData,
            dataType: "json",
            success: successCallback,
          };
        } else {
          // Query for the latest endDate
          requestSettings = {
            url: `${MetacatUI.appModel.get(
              "queryServiceUrl",
            )}q=${query}&rows=${rows}&fl=${fl}&sort=${sort}&wt=${wt}`,
            type: "GET",
            dataType: "json",
            success: successCallback,
          };
        }

        $.ajax(
          _.extend(
            requestSettings,
            MetacatUI.appUserModel.createAjaxSettings(),
          ),
        );
      },

      /**
       * Given the query or URL, determine whether this model should send GET or
       * POST requests, because of URL length restrictions in browsers.
       * @param {string} queryOrURLString - The full query or URL that will be
       * sent to the query service
       * @returns {string} The request type to use. Either `GET` or `POST`
       */
      getRequestType(queryOrURLString) {
        // If POSTs to the query service are disabled completely, use GET
        if (MetacatUI.appModel.get("disableQueryPOSTs")) {
          return "GET";
        }
        // If POSTs are enabled and the URL is over the maximum, use POST
        if (
          queryOrURLString &&
          queryOrURLString.length > this.get("maxQueryLength")
        ) {
          return "POST";
        }
        // Otherwise, default to GET

        return "GET";
      },

      /**
       * @deprecated as of MetacatUI version 2.12.0. Use
       * {@link Stats#getMetadataStats} and {@link Stats#getDataStats} to get
       * the formatTypes. This function may be removed in a future release.
       */
      getFormatTypes() {
        this.getMetadataStats();
        this.getDataStats();
      },

      /**
       * @deprecated as of MetacatUI version 2.12.0. Use
       * {@link Stats#getDataStats} to get the formatTypes. This function may be
       * removed in a future release.
       */
      getDataFormatIDs() {
        this.getDataStats();
      },

      /**
       * @deprecated as of MetacatUI version 2.12.0. Use
       * {@link Stats#getMetadataStats} to get the formatTypes. This function
       * may be removed in a future release.
       */
      getMetadataFormatIDs() {
        this.getMetadataStats();
      },

      /**
       * @deprecated as of MetacatUI version 2.12.0. Use
       * {@link Stats#getMetadataStats} and {@link Stats#getDataStats} to get
       * the formatTypes. This function may be removed in a future release.
       */
      getUpdateDates() {
        this.getMetadataStats();
        this.getDataStats();
      },

      /**
       * @deprecated as of MetacatUI version 2.12.0. Use
       * {@link Stats#getMetadataStats} to get the formatTypes. This function
       * may be removed in a future release.
       */
      getCollectionYearFacets() {
        this.getMetadataStats();
      },
    },
  );
  return Stats;
});
