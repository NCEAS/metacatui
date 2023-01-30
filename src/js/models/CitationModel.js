/* global define */
"use strict";

define(["jquery", "underscore", "backbone"], function ($, _, Backbone) {
  /**
   * @class Citation
   * @classdesc A Citation Model represents a single Citation Object returned by
   * the metrics-service. A citation model can alternatively be populated with
   * an EML model or a DataONE object model...
   * @classcategory Models
   * @extends Backbone.Model
   * @see https://app.swaggerhub.com/apis/nenuji/data-metrics/1.0.0.3
   */
  var Citation = Backbone.Model.extend({
    /**
     * The name of this type of model
     * @type {string}
     */
    type: "CitationModel",

    /**
     * The default Citation fields
     * @name CitationModel#defaults
     * @type {Object}
     * @property {string} origin - text of authors who published the source
     * dataset / document / article
     * @property {string[]} originArray - array of authors who published the
     * source dataset / document / article. Same as origin, but split on commas
     * and trimmed.
     * @property {string} title - Title of the source dataset / document /
     * article
     * @property {number} year_of_publishing - Year in which the source dataset
     * / document / article was published
     * @property {string} source_url - URL to the source dataset / document /
     * article
     * @property {string} source_id - Unique identifier to the source dataset /
     * document / article that cited the target dataset
     * @property {string} target_id - Unique identifier to the target DATAONE
     * dataset. This is the dataset that was cited.
     * @property {string} publisher - Publisher for the source dataset /
     * document / article
     * @property {string} journal - The journal where the the document was
     * published
     * @property {number|string} volume - The volume of the journal where the
     * document was published
     * @property {number} page - The page of the journal where the document was
     * published
     * @property {Backbone.Model} citationMetadata - A model containing the
     * metadata (TODO - check this)
     * @property {Backbone.Model} inputModel - The model that was used to
     * populate this citation (same as CitationMetadata?)
     * @property {string} pid - The pid of the object being cited
     * @property {string} seriesId - The seriesId of the object being cited
     */
    defaults: function () {
      return {
        origin: null,
        originArray: [],
        title: null,
        year_of_publishing: null,
        source_url: null,
        source_id: null,
        target_id: null,
        publisher: null,
        journal: null,
        volume: null,
        page: null,
        citationMetadata: null, // TODO - what is this?
        inputModel: null, // The model that was used to populate this citation (same as CitationMetadata?)
        pid: null,
        seriesId: null,
      };
    },

    /**
     * Initialize the Citation model
     * @param {*} attrs
     * @param {*} options
     */
    initialize: function (attrs, options) {
      try {
        // Set the attributes on this model
        if (typeof attrs == "object") {
          this.set(attrs);
        }

        // Keep the origin array in sync with the origin string
        this.originToArray();
        this.stopListening(this, "change:origin", this.originToArray);
        this.listenTo(this, "change:origin", this.originToArray);

        // TODO
        // if this.inputModel instanceof SolrResult
        // this.populateFromSolrResult(this.inputModel)
        // this.stopListening(this, "change:inputModel", this.populateFromSolrResult)
        // this.listenTo(this, "change:inputModel", this.populateFromSolrResult)
        // this.listenTo(this.inputModel, "change", this.populateFromSolrResult)
      } catch (error) {
        console.log("CitationModel.initialize() Error: ", error);
      }
    },

    /**
     * Populate this citation model's attributes from a SolrResult model
     * @param {SolrResult} solrResult - The SolrResult model to populate from
     * @see SolrResult
     * @since x.x.x
     */
    populateFromSolrResult: function (solrResult) {
      try {
        if (!solrResult) return;

        // YEAR
        let year = new Date(solrResult.get("pubDate")).getUTCFullYear();
        if (!year || year == "NaN") {
          year = new Date(solrResult.get("!!TODO!!")).getUTCFullYear() || null;
        }
        year = year == "NaN" ? null : year;

        // TITLE
        let title = solrResult.get("title");
        title = Array.isArray(title) ? title[0] : title;

        // JOURNAL (node/datasource)
        let journal = null;
        const datasource = solrResult.get("datasource");
        const mn = MetacatUI.nodeModel.getMember(datasource);
        const currentMN = MetacatUI.nodeModel.get("currentMemberNode");
        if (datasource) {
          if (mn) {
            journal = mn.name;
          } else if (datasource == MetacatUI.appModel.get("nodeId")) {
            journal = MetacatUI.appModel.get("repositoryName");
          }
        }
        if (!journal && currentMN) {
          const mnCurrent = MetacatUI.nodeModel.getMember(currentMN);
          journal = mnCurrent ? mnCurrent.name : null;
        }

        // Match the citation model attributes to the solr result attributes
        this.set({
          originArray: solrResult.get("origin"),
          title: title,
          year_of_publishing: year,
          journal: publisher,
          inputModel: solrResult,
        });
      } catch (error) {
        console.log(
          "There was an error populating the citation from the Solr result.",
          error
        );
      }
    },

    /**
     * Checks if the citation is for a DataONE object from a specific node
     * (e.g. PANGAEA)
     * @param {string} node - The node id to check, e.g. "urn:node:PANGAEA"
     * @returns {boolean} - True if the citation is for a DataONE object from
     * the given node
     * @since x.x.x
     */
    isFromNode: function (node) {
      try {
        return (
          this.inputModel &&
          this.inputModel.get &&
          this.inputModel.get("datasource") &&
          this.inputModel.get("datasource") === node
        );
      } catch (error) {
        console.log(
          `There was an error checking if the citation is from node ${node}.` +
            `Returning false.`,
          error
        );
        return false;
      }
    },

    /**
     * Convert the origin string to an array of authors
     * @since x.x.x
     */
    originToArray: function () {
      try {
        const originStr = this.get("origin");
        const originArray = originStr ? originStr.split(", ") : [];
        this.set("originArray", originArray);
      } catch (error) {
        console.log(
          "There was an error converting the origin string to an array.",
          error
        );
      }
    },

    /**
     * Returns true if the citation is for a DataONE object that has been
     * archived and archived content is not available in the search index.
     * @returns {boolean} - True if the citation has no content because it is
     * archived and archived content is not indexed.
     * @see AppModel#archivedContentIsIndexed
     * @since x.x.x
     */
    isArchivedAndNotIndexed: function () {
      try {
        return this.isArchived() && !this.archivedContentIsIndexed();
      } catch (error) {
        console.log(
          "There was an error checking if the citation is archived and not " +
            "indexed. The error was: ",
          error
        );
      }
    },

    /**
     * Checks if the object being cited is archived, according to the
     * `archived` attribute of the input model.
     * @returns {boolean} - True if the input model has an `archived` attribute
     * that is true.
     * @since x.x.x
     */
    isArchived: function () {
      return (
        this.inputModel &&
        this.inputModel.get &&
        this.inputModel.get("archived")
      );
    },

    /**
     * Checks if archived content is available in the search index.
     * @see AppModel#archivedContentIsIndexed
     * @returns {boolean} - True if archived content is available in the search
     * index.
     * @since x.x.x
     */
    archivedContentIsIndexed: function () {
      return MetacatUI.appModel.get("archivedContentIsIndexed");
    },

    /**
     * Checks if a string is a DOI.
     * @param {string} str - The string to check
     * @returns {boolean} - True if the string is a DOI
     * @see DataONEObject#isDOI
     * @see SolrResult#isDOI
     * @since x.x.x
     */
    isDOI(str) {
      try {
        if(!str) return false;
        // isDOI is a function available in both the SolrResult and
        // DataONEObject models
        return this.inputModel.isDOI(str);
      } catch (e) {
        console.log(`Error checking if ${str} is a DOI. Returning false.`, e);
        return false;
      }
    },

    /**
     * Checks if the citation has a DOI in the seriesId or pid attributes.
     * @returns {string} - The DOI of the seriesID, if it is a DOI, or the DOI
     * of the pid, if it is a DOI. Otherwise, returns null.
     * @since x.x.x
     */
    findDOI: function () {
      try {
        const seriesID = this.get("seriesId");
        const pid = this.get("pid");
        if (isDOI(seriesID)) return seriesID;
        if (isDOI(pid)) return pid;
        return null;
      } catch (error) {
        console.log(
          "There was an error finding the DOI for the citation. Returning null",
          error
        );
        return null;
      }
    },

    /**
     * Checks if the citation has a DOI in the seriesId or pid attributes.
     * @returns {boolean} - True if the citation has a DOI
     * @since x.x.x
     */
    hasDOI: function () {
      return this.findDOI() ? true : false;
    },

    /**
     * Get the URL for the online location of the object being cited when it has
     * a DOI. If the DOI is not passed to the function, it will try to get the
     * DOI from the seriesId first, then the PID.
     * @param {string} [doi] - The DOI string with or without the "doi:" prefix
     * @returns {string} - The DOI URL
     * @since x.x.x
     */
    getDoiUrl: function (doi) {
      try {
        doi = doi || this.findDOI();
        if (!doi) return null;

        return doi.indexOf("http") == 0
          ? doi
          : "https://doi.org/" + doi.replace(/^doi:/, "");
      } catch (e) {
        console.log(
          "Error getting the DOI URL for the citation. Returning null.",
          e
        );
        return null;
      }
    },
  });

  return Citation;
});
