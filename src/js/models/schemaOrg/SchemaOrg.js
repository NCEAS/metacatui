"use strict";

define(["backbone"], (Backbone) => {
  // These limits come from the Google Dataset requirements, see:
  // https://developers.google.com/search/docs/appearance/structured-data/dataset#structured-data-type-definitions
  const MAX_DESCRIPTION_LENGTH = 5000;
  const MIN_DESCRIPTION_LENGTH = 50;

  /**
   * @class SchemaOrgModel
   * @classdesc Creates a schema.org model for inserting JSON-LD into the
   * document head.
   * @classcategory Models/schemaOrg
   * @since 2.32.0
   * @augments Backbone.Model
   */
  const SchemaOrgModel = Backbone.Model.extend({
    /** @lends SchemaOrgModel.prototype */

    /** @inheritdoc */
    defaults() {
      return {
        "@context": {
          "@vocab": "https://schema.org/",
        },
      };
    },

    /** @inheritdoc */
    serialize() {
      const json = this.toJSON();

      // Pad or truncate description if too short or too long
      if (json.description) {
        json.description = this.adjustDescriptionLength(json.description);
      }

      // Remove any empty properties
      Object.keys(json).forEach((key) => {
        if (!json[key]) {
          delete json[key];
        }
        // If it's an object, remove any empty properties. Remove entire object
        // if all properties are empty.
        if (typeof json[key] === "object") {
          const obj = json[key];
          const keys = Object.keys(obj);
          let empty = true;
          keys.forEach((k) => {
            if (obj[k]) {
              empty = false;
            } else {
              delete obj[k];
            }
          });
          if (empty) {
            delete json[key];
          }
        }
      });
      return JSON.stringify(json);
    },

    /**
     * Lengthens or shortens a description to fit within the limits of the
     * ____ TODO
     * @param {string} str - The description to adjust
     * @returns {string} - The adjusted description
     */
    adjustDescriptionLength(str) {
      const link = this.get("url") || this.get("name") || "DataONE";
      // Note this string must be at least 50 characters long to add enough
      // padding to very short descriptions
      const descEnd = `Visit ${link} for complete metadata about this dataset.`;
      let adjusted = this.truncateDescription(str, descEnd);
      adjusted = this.padDescription(adjusted, descEnd);
      return adjusted;
    },

    /**
     * Truncates a description to a maximum length. Returns string unchanged if
     * it is already shorter than the maximum length.
     * @param {string} str - The description to truncate
     * @param {string} descEnd - The text to append to the end of the
     * description that has been truncated
     * @returns {string} - The truncated description
     */
    truncateDescription(str, descEnd) {
      const descEndEllipsis = `... ${descEnd}`;
      if (str.length > MAX_DESCRIPTION_LENGTH) {
        const maxLength = MAX_DESCRIPTION_LENGTH - descEndEllipsis.length;
        return str.slice(0, maxLength) + descEndEllipsis;
      }
      return str;
    },
    /**
     * Pads a description to a minimum length. Returns string unchanged if it is
     * already longer than the minimum length.
     * @param {string} str - The description to pad
     * @param {string} descEnd - The text to append to the end of descriptions
     * that are too short
     * @returns {string} - The padded description
     */
    padDescription(str, descEnd) {
      let newStr = str;
      if (str.length < MIN_DESCRIPTION_LENGTH) {
        newStr = `${str}. ${descEnd}`;
      }
      return newStr;
    },

    /**
     * Removes any previous attributes and sets new ones based on the type of
     * page being viewed.
     * @param {"Dataset"|"DataCatalog"} type - The type of page being viewed. If
     * the type is neither "Dataset" nor "DataCatalog", the model is reset.
     * @param {SolrResult} [model] - the model to get Dataset metadata from for
     * "Dataset" type only
     */
    setSchema(type, model = null) {
      this.reset(true);
      switch (type) {
        case "Dataset":
          this.setDatasetSchema(model);
          break;
        case "DataCatalog":
          this.setDataCatalogSchema();
          break;
        default:
          this.reset();
      }
    },

    /**
     * Given a stringified JSON template, set the attributes on this model from
     * the template.
     * @param {string} template - A stringified JSON template
     */
    setSchemaFromTemplate(template) {
      if (!template) {
        this.reset();
        return;
      }
      try {
        if (typeof template === "string") {
          this.set(JSON.parse(template));
        }
      } catch (e) {
        this.model.set("parseError", e);
        this.reset();
      }
    },

    /**
     * Reset the model to its default values
     * @param {boolean} [silent] - Whether to suppress change events. Default is
     * false.
     */
    reset(silent = false) {
      // Silient because this.set will trigger a change event, only need one.
      this.clear({ silent: true });
      this.set(this.defaults(), { silent });
    },

    /**
     * Generate Schema.org-compliant JSONLD for a data catalog and set it on the
     * model
     */
    setDataCatalogSchema() {
      const allNodes = MetacatUI.nodeModel.get("members");

      const elJSON = {
        "@type": "DataCatalog",
      };

      if (!allNodes || !allNodes.length) {
        this.listenToOnce(MetacatUI.nodeModel, "change:members", () => {
          // if the type is still DataCatalog, try again. Otherwise we've
          // already switched to a different page.
          if (this.get("@type") === "DataCatalog") {
            this.setDataCatalogSchema();
          }
        });
        this.set(elJSON);
        return;
      }

      const nodeId = MetacatUI.nodeModel.get("currentMemberNode");
      const node = allNodes.find((n) => n.identifier === nodeId);

      if (!node) {
        this.set(elJSON);
        return;
      }

      this.set({
        "@type": "DataCatalog",
        description: node.description,
        identifier: node.identifier,
        url: node.url,
        name: node.name,
        image: node.logo,
      });
    },

    /**
     * Generate Schema.org-compliant JSONLD for a dataset and set it on the model
     * @param {SolrResult} model The model to generate JSONLD for
     */
    setDatasetSchema(model) {
      if (!model) {
        this.reset();
        this.set({
          "@type": "Dataset",
          description:
            "No description is available. Visit DataONE for complete metadata about this dataset.",
        });
        return;
      }

      const datasource = model.get("datasource");
      const id = model.get("id");
      const seriesId = model.get("seriesId");
      const url = `https://dataone.org/datasets/${encodeURIComponent(id)}`;

      const north = model.get("northBoundCoord");
      const east = model.get("eastBoundCoord");
      const south = model.get("southBoundCoord");
      const west = model.get("westBoundCoord");

      const beginDate = model.get("beginDate");
      const endDate = model.get("endDate");

      const title = model.get("title");
      const origin = model.get("origin");
      const attributeName = model.get("attributeName");
      const abstract = model.get("abstract");
      const keywords = model.get("keywords");

      const DOIURL = this.getDOIURL(id, seriesId);

      // First: Create a minimal Schema.org Dataset with just the fields we
      // know will come back from Solr (System Metadata fields). Add the rest
      // in conditional on whether they are present.
      const elJSON = {
        "@type": "Dataset",
        "@id": url,
        datePublished: model.get("pubDate") || model.get("dateUploaded"),
        dateModified: model.get("dateModified"),
        publisher: {
          "@type": "Organization",
          name: MetacatUI.nodeModel.getMember(datasource)?.name || datasource,
        },
        identifier: this.generateIdentifier(id, seriesId),
        version: model.get("version"),
        url,
        schemaVersion: model.get("formatId"),
        isAccessibleForFree: true,
      };
      // Second: Add in optional fields

      if (DOIURL) elJSON.sameAs = DOIURL;
      if (title) elJSON.name = model.get("title");

      // Creator
      if (origin) {
        elJSON.creator = origin.map((creator) => ({
          "@type": "Person",
          name: creator,
        }));
      }

      const spatial = this.generateSpatialCoverage(north, east, south, west);
      if (spatial) {
        elJSON.spatialCoverage = spatial;
      }

      if (beginDate) {
        elJSON.temporalCoverage = beginDate;
        if (endDate) {
          elJSON.temporalCoverage += `/${endDate}`;
        }
      }

      // Dataset/variableMeasured
      if (attributeName) elJSON.variableMeasured = attributeName;

      // Dataset/description
      if (abstract) {
        elJSON.description = abstract;
      } else {
        elJSON.description = `No description is available. Visit ${url} for complete metadata about this dataset.`;
      }

      // Dataset/keywords
      if (keywords) {
        elJSON.keywords = keywords.join(", ");
      }

      this.set(elJSON);
    },

    /**
     * Given a DOI and/or seriesId, return a URL to the DOI resolver
     * @param {string} id The ID from the Solr index
     * @param {string} seriesId The seriesId from the Solr index
     * @returns {string|null} The URL to the DOI resolver or null if neither the id
     * nor the seriesId is a DOI
     */
    getDOIURL(id, seriesId) {
      return (
        MetacatUI.appModel.DOItoURL(id) || MetacatUI.appModel.DOItoURL(seriesId)
      );
    },

    /**
     * Generate a Schema.org/identifier from the model's id. Tries to use the
     * PropertyValue pattern when the identifier is a DOI and falls back to a
     * Text value otherwise
     * @param {string} id The ID from the Solr index
     * @param {string} seriesId The seriesId from the Solr index
     * @returns {object|string} - A Schema.org/PropertyValue object or a string
     */
    generateIdentifier(id, seriesId) {
      // DOItoURL returns null if the string is not a DOI
      const doiURL = this.getDOIURL(id, seriesId);

      if (!doiURL) return id;

      return {
        "@type": "PropertyValue",
        propertyID: "https://registry.identifiers.org/registry/doi",
        value: doiURL.replace("https://doi.org/", "doi:"),
        url: doiURL,
      };
    },

    /**
     * Generate a Schema.org/Place/geo from bounding coordinates. Either
     * generates a GeoCoordinates (when the north and east coords are the same)
     * or a GeoShape otherwise.
     * @param {number} north - North bounding coordinate
     * @param {number} east - East bounding coordinate
     * @param {number} south - South bounding coordinate
     * @param {number} west - West bounding coordinate
     * @returns {object} - A Schema.org/Place/geo object
     */
    generateSpatialCoverage(north, east, south, west) {
      if (!north || !east || !south || !west) return null;
      let geo = {
        "@type": "GeoShape",
        box: `${west}, ${south} ${east}, ${north}`,
      };
      if (north === south) {
        geo = {
          "@type": "GeoCoordinates",
          latitude: north,
          longitude: west,
        };
      }
      const spatialCoverage = {
        "@type": "Place",
        additionalProperty: [
          {
            "@type": "PropertyValue",
            additionalType:
              "http://dbpedia.org/resource/Coordinate_reference_system",
            name: "Coordinate Reference System",
            value: "http://www.opengis.net/def/crs/OGC/1.3/CRS84",
          },
        ],
        geo,
        subjectOf: {
          "@type": "CreativeWork",
          fileFormat: "application/vnd.geo+json",
          text: this.generateGeoJSONString(north, east, south, west),
        },
      };
      return spatialCoverage;
    },

    /**
     * Creates a (hopefully) valid geoJSON string from the a set of bounding
     * coordinates from the Solr index (north, east, south, west).
     *
     * This function produces either a GeoJSON Point or Polygon depending on
     * whether the north and south bounding coordinates are the same.
     *
     * Part of the reason for factoring this out, in addition to code
     * organization issues, is that the GeoJSON spec requires us to modify the
     * raw result from Solr when the coverage crosses -180W which is common
     * for datasets that cross the Pacific Ocean. In this case, We need to
     * convert the east bounding coordinate from degrees west to degrees east.
     *
     * e.g., if the east bounding coordinate is 120 W and west bounding
     * coordinate is 140 E, geoJSON requires we specify 140 E as 220
     * @param {number} north - North bounding coordinate
     * @param {number} east - East bounding coordinate
     * @param {number} south - South bounding coordinate
     * @param {number} west - West bounding coordinate
     * @returns {string} - A stringified GeoJSON object
     */
    generateGeoJSONString(north, east, south, west) {
      if (north === south) {
        return this.generateGeoJSONPoint(north, east);
      }
      return this.generateGeoJSONPolygon(north, east, south, west);
    },

    /**
     * Generate a GeoJSON Point object
     * @param {number} north - North bounding coordinate
     * @param {number} east - East bounding coordinate
     * @returns {string} - A stringified GeoJSON Point object
     * @example
     * {
     *  "type": "Point",
     *  "coordinates": [
     *      -105.01621,
     *      39.57422
     * ]}
     */
    generateGeoJSONPoint(north, east) {
      const preamble = '{"type":"Point","coordinates":';
      const inner = `[${east},${north}]`;
      const postamble = "}";

      return preamble + inner + postamble;
    },

    /**
     * Generate a GeoJSON Polygon object from
     * @param {number} north - North bounding coordinate
     * @param {number} east - East bounding coordinate
     * @param {number} south - South bounding coordinate
     * @param {number} west - West bounding coordinate
     * @returns {string} - A stringified GeoJSON Polygon object
     * @example
     * {
     *   "type": "Polygon",
     *   "coordinates": [[
     *     [ 100, 0 ],
     *     [ 101, 0 ],
     *     [ 101, 1 ],
     *     [ 100, 1 ],
     *     [ 100, 0 ]
     * ]}
     */
    generateGeoJSONPolygon(north, east, south, west) {
      const preamble =
        '{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[';

      // Handle the case when the polygon wraps across the 180W/180E boundary
      const fixedEast = east < west ? 360 - east : east;

      const inner =
        `[${west},${south}],` +
        `[${fixedEast},${south}],` +
        `[${fixedEast},${north}],` +
        `[${west},${north}],` +
        `[${west},${south}]`;

      const postamble = "]]}}";

      return preamble + inner + postamble;
    },
  });

  return SchemaOrgModel;
});
