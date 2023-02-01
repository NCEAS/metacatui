/* global define */
"use strict";

define(["jquery", "underscore", "backbone"], function ($, _, Backbone) {
  /**
   * @class Citation
   * @classdesc A Citation Model represents a single Citation Object returned by
   * the metrics-service. A citation model can alternatively be populated with
   * a SolrResultsModel or a DataONEObjectModel, or an extension of either of
   * those models.
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
     * @property {Backbone.Model} citationMetadata - TODO - what is this?
     * @property {Backbone.Model} sourceModel - The model to use to populate
     * this citation model. This can be a SolrResultsModel, a
     * DataONEObjectModel, or an extension of either of those models. When this
     * attribute is set, then the Citation model will be re-populated and all
     * other attributes will be overwritten.
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
        citationMetadata: null,
        sourceModel: null,
        pid: null,
        seriesId: null,
      };
    },

    /**
     * Initialize the Citation model
     * @param {*} attrs
     * @param {*} options
     */
    initialize: function (attrs) {
      try {
        // Keep the origin array and origin string in sync with one another.
        // Since a change event won't be triggered if the origin string is set
        // to the same value, we don't need to worry about an infinite loop.

        // Make sure that the origin and the originArray are in sync to start
        const originArray = this.originToArray(this.get("origin"));
        this.set("originArray", originArray);
        const origin = this.originArrayToString(this.get("originArray"));
        this.set("origin", origin);

        this.stopListening(this, "change:origin", this.originToArray);
        this.listenTo(this, "change:origin", function (m, newOrigin) {
          const newOriginArray = this.originToArray(newOrigin);
          this.set("originArray", newOriginArray);
        });

        this.stopListening(
          this,
          "change:originArray",
          this.originArrayToString
        );
        this.listenTo(this, "change:originArray", function (m, newOriginArray) {
          const newOrigin = this.originArrayToString(newOriginArray);
          this.set("origin", newOrigin);
        });
      } catch (error) {
        console.log("CitationModel.initialize() Error: ", error);
      }
    },

    /**
     * Reset this citation model's attributes to the default values. By default,
     * this will not trigger a change event on the sourceModel attribute. If you
     * want to trigger a change event on the sourceModel attribute, then pass
     * true as the first argument.
     * @param {boolean} [triggerSourceModelChange = false] If true, then trigger
     * a change event on the sourceModel attribute
     * @since x.x.x
     */
    set: function (key, val, options) {
      try {
        if (key == null) return this;

        // Handle both `"key", value` and `{key: value}` -style arguments.
        let attrs = {};
        if (typeof key === "object") {
          attrs = key;
          options = val;
        } else {
          (attrs = {})[key] = val;
        }

        // Set all attributes in the regular Backbone way, except for
        // sourceModel. Set this attribute last, using the setSourceModel
        // method. This must happen AFTER setting all the other attributes,
        // because we want to populate the Citation Model with sourceModel
        // attributes, and not have them overwritten by the other attributes
        // being set during this call to set().
        const sourceModel = attrs.sourceModel;
        let setSourceModel = false;
        if (Object.keys(attrs).includes("sourceModel")) {
          setSourceModel = true;
          delete attrs.sourceModel;
        }
        Backbone.Model.prototype.set.call(this, attrs, options);
        if (setSourceModel) {
          this.setSourceModel(sourceModel);
        }
      } catch (error) {
        console.log(
          "Error running the custom set() method on CitationModel." +
            `The arguments passed to set() were: KEY: ${key}, VAL: ${val}, ` +
            `OPTIONS: ${options}. The error was:` +
            error,
          "Will attempt to set using the default set() method."
        );
        Backbone.Model.prototype.set.call(this, key, val, options);
      }
    },

    /**
     * Sets the sourceModel attribute and calls the method to populate the
     * Citation Model with the sourceModel attributes. Also removes any existing
     * listeners on the previous sourceModel and readds them to the new
     * sourceModel.
     * @param {Backbone.Model} newSourceModel - The new sourceModel
     * @since x.x.x
     */
    setSourceModel(newSourceModel) {
      try {
        // If the model is a Package, then get the metadata doc in this package
        if (newSourceModel && newSourceModel.type == "Package") {
          newSourceModel = newSourceModel.getMetadata();
        }

        const EMLPartyAttrs =
          "change:individualName change:organizationName change:positionName";

        // Stop listening to the old sourceModel and any old EMLParty models in
        // the creators array
        if (this.sourceModel) {
          this.stopListening(this.sourceModel, "change");
          const oldCreators = this.sourceModel.get("creators");
          if (oldCreators && Array.isArray(oldCreators)) {
            oldCreators.forEach((creator) => {
              this.stopListening(creator, EMLPartyAttrs);
            });
          }
        }

        // Set new listeners
        if (newSourceModel) {
          // If any of the attributes on the sourceModel change, call the
          // populateFromModel method again to update the citation.
          this.listenTo(newSourceModel, "change", this.populateFromModel);

          // Listen for changes to the attributes on EMLParty models in the
          // creators array. If any of those change, then update the citation.
          const creators = newSourceModel.get("creators");
          if (creators && Array.isArray(creators)) {
            creators.forEach((creator) => {
              this.listenTo(creator, EMLPartyAttrs, function () {
                this.populateFromModel(newSourceModel);
              });
            });
          }
        }

        // Populate this model from the new sourceModel
        this.populateFromModel(newSourceModel);
      } catch (error) {
        console.log("Error setting sourceModel in a CitationModel: ", error);
      }
    },

    /**
     * Populate this citation model's attributes from another model, such as a
     * SolrResult model or a DataONEObject model. This will reset and overwrite
     * any existing attributes on this model.
     * @param {Backbone.Model} model - The model to populate from, accepts
     * SolrResult or a model that is a DataONEObject or an extended
     * DataONEObject
     * @since x.x.x
     */
    populateFromModel: function (sourceModel) {
      try {
        // Start with the default attributes so that we reset any attributes
        // that are no longer in the sourceModel.
        const newAttrs = this.defaults();
        // Set the sourceModel with the regular backbone set (not the custom
        // setSourceModel method), so that we don't trigger a change event on
        // the sourceModel attribute and cause an infinite loop.
        Backbone.Model.prototype.set.call(this, "sourceModel", sourceModel);
        delete newAttrs.sourceModel;

        if (!sourceModel) {
          // If there is no sourceModel, then set the new attributes and return
          this.set(newAttrs);
          return;
        }

        const year = this.getYearFromSourceModel(sourceModel);
        const title = this.getTitleFromSourceModel(sourceModel);
        const journal = this.getJournalFromSourceModel(sourceModel);

        const pid = this.getPidFromSourceModel(sourceModel);
        const seriesId = this.getSeriesIdFromSourceModel(sourceModel);

        // Make the origin string as well, since both the string and array
        // should be in sync
        const originArray = this.getOriginArrayFromSourceModel(sourceModel);
        const origin = this.originArrayToString(originArray);

        // Match the citation model attributes to the source model attributes
        if (year) newAttrs.year_of_publishing = year;
        if (title) newAttrs.title = title;
        if (journal) newAttrs.journal = journal;

        if (pid) newAttrs.pid = pid;
        if (seriesId) newAttrs.seriesId = seriesId;

        if (originArray) newAttrs.originArray = originArray;
        if (origin) newAttrs.origin = origin;

        this.set(newAttrs);
      } catch (error) {
        console.log(
          "Error populating a CitationModel from the model: ",
          sourceModel,
          " Error: ",
          error
        );
      }
    },

    /**
     * Get the year from the sourceModel. First look for pubDate, then
     * dateUploaded (both in SolrResult & ScienceMetadata/EML models). Lasly
     * check datePublished (found in ScienceMetadata/EML models only.)
     * @param {Backbone.Model} sourceModel - The model to get the year from
     * @returns {Number} - The year
     * @since x.x.x
     */
    getYearFromSourceModel(sourceModel) {
      // get
      try {
        const year =
          this.yearFromDate(sourceModel.get("pubDate")) ||
          this.yearFromDate(sourceModel.get("dateUploaded")) ||
          this.yearFromDate(sourceModel.get("datePublished"));
        return year;
      } catch (error) {
        console.log(
          "Error getting the year from the sourceModel: ",
          sourceModel,
          " Error: ",
          error
        );
        return this.defaults().year_of_publishing;
      }
    },

    /**
     * Get the title from the sourceModel
     * @param {Backbone.Model} sourceModel - The model to get the title from
     * @returns {String} - The title
     * @since x.x.x
     */
    getTitleFromSourceModel(sourceModel) {
      try {
        let title = sourceModel.get("title");
        title = Array.isArray(title) ? title[0] : title;
        return title;
      } catch (error) {
        console.log(
          "Error getting the title from the sourceModel: ",
          sourceModel,
          " Error: ",
          error
        );
        return this.defaults().title;
      }
    },

    /**
     * Get the journal (datasource/node) from the sourceModel. If there is a
     * datasource attribute on the sourceModel, then get the name of the member
     * node that has that datasource ID. If we can't find a member node that
     * matches the datasource, then check if the datasource is the current node.
     * If it is, then use the repository name. If there is no datasource
     * attribute, then use the current member node's name.
     * @param {Backbone.Model} sourceModel - The model to get the journal from
     * @returns {String} - The journal
     * @since x.x.x
     */
    getJournalFromSourceModel(sourceModel) {
      try {
        let journal = null;
        const datasource = sourceModel.get("datasource");
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
        return journal;
      } catch (error) {
        console.log(
          "Error getting the journal from the sourceModel: ",
          sourceModel,
          " Error: ",
          error
        );
        return this.defaults().journal;
      }
    },

    /**
     * Get the array of authors ("origin") from the sourceModel. First look for
     * creator (EML), then origin (science metadata & solr results), then
     * rightsHolder & submitter (base D1 object model). Convert EML parties to
     * strings & check for incorrectly escaped characters.
     * @param {Backbone.Model} sourceModel - The model to get the originArray
     * from
     * @returns {Array} - The originArray
     * @since x.x.x
     */
    getOriginArrayFromSourceModel(sourceModel) {
      try {
        // AUTHORS
        let authors =
          // If it's an EML document, there will be a creator field
          sourceModel.get("creator") ||
          // If it's a science metadata model or solr results, use origin
          sourceModel.get("origin") ||
          // otherwise, this is probably a base D1 object model
          sourceModel.get("rightsHolder") ||
          sourceModel.get("submitter");

        // Convert EML parties to strings & check for incorrectly escaped
        // characters
        if (authors) {
          authors = Array.isArray(authors) ? authors : [authors];
          authors = authors.map((author) => this.formatAuthor(author));
        }
        return authors;
      } catch (error) {
        console.log(
          "Error getting the originArray from the sourceModel: ",
          sourceModel,
          " Error: ",
          error
        );
        return this.defaults().originArray;
      }
    },

    /**
     * Get the pid from the sourceModel. First look for id, then identifier.
     * @param {Backbone.Model} sourceModel - The model to get the pid from
     * @returns {String} - The pid
     * @since x.x.x
     */
    getPidFromSourceModel(sourceModel) {
      try {
        const pid = sourceModel.get("id") || model.get("identifier") || null;
        return pid;
      } catch (error) {
        console.log(
          "Error getting the pid from the sourceModel: ",
          sourceModel,
          " Error: ",
          error
        );
        return this.defaults().pid;
      }
    },

    /**
     * Get the seriesId from the sourceModel. Simply looks for the seriesId
     * attribute.
     * @param {Backbone.Model} sourceModel - The model to get the seriesId from
     * @returns {String} - The seriesId
     * @since x.x.x
     */
    getSeriesIdFromSourceModel(sourceModel) {
      try {
        const seriesId = sourceModel.get("seriesId") || null;
        return seriesId;
      } catch (error) {
        console.log(
          "Error getting the seriesId from the sourceModel: ",
          sourceModel,
          " Error: ",
          error
        );
        return this.defaults().seriesId;
      }
    },

    /**
     * Format an individual author for display within a citation.
     * @param {string|EMLParty} author The author to format
     * @returns {string} Returns the author as a string if it was an EMLParty
     * with any incorrectly escaped characters corrected.
     */
    formatAuthor: function (author) {
      try {
        // If author is an EMLParty model, then convert it to a string with
        // given name + sur name, or organization name
        if (typeof author.getName === "function") {
          author = author.getName();
        }

        // Checking for incorrectly escaped characters
        if (/&amp;[A-Za-z0-9]/.test(author)) {
          // initializing the DOM parser
          var parser = new DOMParser();

          // parsing the incorrectly escaped `&amp;`
          var unescapeAmpersand = parser.parseFromString(author, "text/html");

          // unescaping the & and retrieving the actual character
          var unescapedString = parser.parseFromString(
            unescapeAmpersand.body.textContent,
            "text/html"
          );

          // saving the correct author text before displaying
          author = unescapedString.body.textContent;
        }
        return author;
      } catch (error) {
        console.log(
          "There was an error formatting an author, returning " +
            "the author input as is.",
          error
        );
        return author;
      }
    },

    /**
     * Given a date, extract the year as a number.
     * @param {Date|String|Number} date The date to extract the year from
     * @returns {Number} Returns the year as a number, or null if the date is
     * invalid.
     */
    yearFromDate: function (date) {
      try {
        if (!date) return null;
        // If Date is already a year (Number object with 4 digits), return it
        if (Number.isInteger(date) && date.toString().length == 4) {
          return date;
        }
        // If it is a string with 4 digits, return it as an integer. Use regex.
        if (typeof date == "string" && /^\d{4}$/.test(date)) {
          return parseInt(date);
        }
        // Check if the date is a Date object
        if (!(date instanceof Date)) {
          date = new Date(date);
        }
        const yr = date.getUTCFullYear();
        return yr == "NaN" ? null : yr;
      } catch (error) {
        console.log(
          "There was an error getting the year from the date, returning null.",
          error
        );
        return null;
      }
    },

    /**
     * Checks if the citation is for a DataONE object from a specific node (e.g.
     * PANGAEA)
     * @param {string} node - The node id to check, e.g. "urn:node:PANGAEA"
     * @returns {boolean} - True if the citation is for a DataONE object from
     * the given node
     * @since x.x.x
     */
    isFromNode: function (node) {
      try {
        return (
          this.sourceModel &&
          this.sourceModel.get &&
          this.sourceModel.get("datasource") &&
          this.sourceModel.get("datasource") === node
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
     * Convert the comma-separated origin string to an array of authors.
     * @param {string} origin - The origin string to convert to an array. If a
     * falsy value is passed in, then the default originArray attribute of the
     * model is returned.
     * @returns {Array} - An array of authors
     * @since x.x.x
     */
    originToArray: function (origin) {
      try {
        if (!origin) {
          return this.defaults().originArray;
        }
        const originArray = origin ? origin.split(", ") : [];
        return originArray;
      } catch (error) {
        console.log(
          "There was an error converting the origin string to an array.",
          error
        );
        return this.defaults().originArray;
      }
    },

    /**
     * Convert the origin array to a string.
     * @returns {string} - The origin string. If a falsy value is passed in,
     * then the default origin attribute of the model is returned.
     * @since x.x.x
     */
    originArrayToString: function (originArray) {
      try {
        if (!originArray) {
          return this.defaults().origin;
        }
        const originStr = originArray ? originArray.join(", ") : "";
        return originStr;
      } catch (error) {
        console.log(
          "There was an error converting the origin array to a string.",
          error
        );
        return this.defaults().origin;
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
     * Checks if the object being cited is archived, according to the `archived`
     * attribute of the source model.
     * @returns {boolean} - True if the source model has an `archived` attribute
     * that is true.
     * @since x.x.x
     */
    isArchived: function () {
      return (
        this.sourceModel &&
        this.sourceModel.get &&
        this.sourceModel.get("archived")
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
        if (!str) return false;
        // isDOI is a function available in both the SolrResult and
        // DataONEObject models
        return this.sourceModel.isDOI(str);
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
