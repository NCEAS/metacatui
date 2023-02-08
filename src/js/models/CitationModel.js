/* global define */
"use strict";

define(["jquery", "underscore", "backbone"], function ($, _, Backbone) {
  /**
   * @class Citation
   * @classdesc A Citation Model represents a single Citation Object returned by
   * the metrics-service. A citation model can alternatively be populated with a
   * SolrResultsModel or a DataONEObjectModel, or an extension of either of
   * those models. A Citation Model can represent a citation to a local
   * MetacatUI object, or an external document or publication.
   * @classcategory Models
   * @extends Backbone.Model
   * @see https://app.swaggerhub.com/apis/nenuji/data-metrics
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
     * article. This is usually an external publication that cites one or more
     * DataONE datasets.
     * @property {string} source_id - Unique identifier for the source dataset /
     * document / article that cited the target dataset. This is usually an
     * external publication that cites one or more DataONE datasets.
     * @property {string} target_id - Unique identifier to the target DATAONE
     * dataset. This is the dataset that was cited by the "source" document.
     * @property {string} publisher - Publisher for the source dataset /
     * document / article
     * @property {string} journal - The journal where the the document was
     * published
     * @property {number|string} volume - The volume of the journal where the
     * document was published
     * @property {number} page - The page of the journal where the document was
     * published
     * @property {Citations} citationMetadata - When this Citation Model refers
     * to an external document, citationMetadata is a collection of DataONE
     * datasets that the external document cites. This info is retrieved by the
     * metrics service, then parsed and stored as a collection of Citation
     * Models. This attribute is used in the Portals view, for example, where we
     * display a list of external publications that cite the portal data. In
     * this case, each publication's citationMetadata is the list of local
     * MetacatUI data packages cited in the publication.
     * @property {Backbone.Model} sourceModel - The model to use to populate
     * this citation model. This can be a SolrResultsModel, a
     * DataONEObjectModel, or an extension of either of those models. Do not set
     * this attribute directly. Instead, use the setSourceModel() method.
     * @property {string} pid - The pid or unique identifier of the object being
     * cited.
     * @property {string} seriesId - The seriesId of the object being cited
     * @property {string} view_url - For citations that are in the local
     * MetacatUI repository, this is the URL to the metadata view page for the
     * object being cited.
     * @property {string} pid_url - If the pid is a DOI, then this is the URL to
     * the DOI landing page for the object being cited. This will automatically
     * be set when the pid attribute is set.
     * @property {string} seriesId_url - If the seriesId is a DOI, then this is
     * the URL to the DOI landing page for the object being cited. This will
     * automatically be set when the seriesId attribute is set.
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
        view_url: null,
        pid_url: null,
        seriesId_url: null,
      };
    },

    /**
     * Override the default Backbone.Model.parse() method to convert the
     * citationMetadata object into a nested collection of CitationModels.
     * @param {Object} response - The response from the metrics-service API
     * @param {Object} options - Options to pass to the parse() method.
     * @returns {Object} The parsed response
     */
    parse(response, options) {
      try {
        // cm = DataONE datasets cited by this citation (external document)
        const cm = response.citationMetadata;
        // strings that need formatting when coming from the metrics-service:
        const toFormat = ["journal", "page", "volume", "publisher"];
        toFormat.forEach((attr) => {
          response[attr] = this.formatMetricsServiceString(response[attr]);
        });
        if (cm) {
          // MUST import Citations collection using the inline require syntax to
          // avoid circular dependencies. CitationModel requires Citations and
          // Citations requires CitationModel. See
          // https://requirejs.org/docs/api.html#circular
          const Citations = require("collections/Citations");
          if (cm && !(cm instanceof Citations)) {
            const citationMetadata = Object.entries(cm).map(([pid, data]) => {
              // Convert format from {id: {data}} to {data, id}
              const item = { ...data, pid };
              // Origin returned by metrics-service is actually an array, not a
              // string
              item.originArray = item.origin;
              delete item.origin;
              // Get the publish year
              const date =
                item.datePublished || item.dateUpdated || item.dateModified;
              item.year_of_publishing = date
                ? new Date(date).getUTCFullYear()
                : null;

              // Because the citation metadata is always referencing an object
              // in the local MetacatUI repository, we assume that the view_url
              // exists for the given PID.
              // DOIs from the metrics service are not prefixed with "doi:"
              if (this.isDOI(pid) && !pid.startsWith("doi:")) {
                pid = "doi:" + pid;
              }
              item.view_url =
                MetacatUI.root + "/view/" + encodeURIComponent(pid);

              return item;
            });
            const citations = new Citations(citationMetadata);
            response.citationMetadata = citations;
          }
        }
        return response;
      } catch (error) {
        console.log(
          "Error parsing a CitationModel. Returning response as-is.",
          error
        );
        return response;
      }
    },

    // /**
    //  * Initialize the Citation model
    //  */
    // initialize: function () {
    //   try {
    //   } catch (error) {
    //     console.log("CitationModel.initialize() Error: ", error);
    //   }
    // },

    /**
     * Override the default Backbone.Model.set() method to format the title,
     * page, and volume attributes before setting them, and ensure that
     * attributes that are different formats of the same value are in sync,
     * including: origin and originArray; pid and pid_url; seriesId and
     * seriesId_url. This method will prevent the sourceModel attribute from
     * being set here.
     *
     * @param {string|Object} key - The attribute name to set, or an object of
     * attribute names and values to set.
     * @param {string|number|Object} val - The value to set the attribute to.
     * @param {Object} options - Options to pass to the set() method.
     * @see https://backbonejs.org/#Model-set
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

        // Don't allow setting the sourceModel attribute here.
        // TODO: how to handle this better?
        delete attrs.sourceModel;

        // If the title attribute is being set, then format it first
        if (Object.keys(attrs).includes("title")) {
          attrs.title = this.formatTitle(attrs.title);
        }

        // Ensure origin and originArray contain the same data, with preference
        // given to originArray. If originArray has content, then overwrite
        // origin with the a string created from originArray. If *only* origin
        // has content, then overwrite originArray with an array created from
        // origin.
        if (
          Object.keys(attrs).includes("originArray") ||
          Object.keys(attrs).includes("origin")
        ) {
          const strToArray = this.originToArray(attrs.origin);
          const arrayToStr = this.originArrayToString(attrs.originArray);
          if (!!arrayToStr) {
            attrs.origin = arrayToStr;
          } else {
            attrs.originArray = strToArray;
          }
        }

        // Ensure that the pid_url and seriesId_url attributes match the pid and
        // seriesId attributes being set, and vice versa. If they don't match,
        // then set them to the correct values. Prefer the content of the IDs
        // over the URLs.
        const idProperties = [
          { id: "pid", url: "pid_url" },
          { id: "seriesId", url: "seriesId_url" },
        ];

        idProperties.forEach(({ id, url }) => {
          if (
            Object.keys(attrs).includes(id) ||
            Object.keys(attrs).includes(url)
          ) {
            if (!!attrs[id] && !attrs[url]) {
              attrs[url] = this.DOItoURL(attrs[id]);
            } else if (!!attrs[url] && !attrs[id]) {
              attrs[id] = this.URLtoDOI(attrs[url]);
            } else if (!!attrs[id] && !!attrs[url]) {
              attrs[url] = this.DOItoURL(attrs[id]);
            }
          }
        });

        // Set modified attributes in the regular Backbone way
        Backbone.Model.prototype.set.call(this, attrs, options);
      } catch (error) {
        console.log(
          "Error in custom set() method on CitationModel. Will attempt to set" +
            " using with Backbone set(). Attributes and error stack trace:",
          { key, val, options },
          error
        );
        Backbone.Model.prototype.set.call(this, key, val, options);
      }
    },

    /**
     * Sets the sourceModel attribute and calls the method to populate the
     * Citation Model with the sourceModel attributes. Also removes any existing
     * listeners on the previous sourceModel and readds them to the new
     * sourceModel. Use this method to set or change the sourceModel attribute.
     * @param {Backbone.Model} newSourceModel - The new sourceModel
     * @since x.x.x
     */
    setSourceModel(newSourceModel) {
      try {
        const EMLPartyAttrs =
          "change:individualName change:organizationName change:positionName";
        newSourceModel =
          newSourceModel && newSourceModel.type == "Package"
            ? newSourceModel.getMetadata()
            : newSourceModel;

        if (this.sourceModel) {
          this.stopListening(this.sourceModel, "change");
          this.sourceModel.get("creators") ||
            []
              .filter(Array.isArray)
              .forEach((creator) => this.stopListening(creator, EMLPartyAttrs));
        }

        if (newSourceModel) {
          this.listenTo(newSourceModel, "change", this.populateFromModel);
          newSourceModel.get("creators") ||
            []
              .filter(Array.isArray)
              .forEach((creator) =>
                this.listenTo(creator, EMLPartyAttrs, () =>
                  this.populateFromModel(newSourceModel)
                )
              );
        }
        Backbone.Model.prototype.set.call(this, "sourceModel", newSourceModel);
        this.populateFromModel(newSourceModel);
      } catch (error) {
        console.log("Error in CitationModel.setSourceModel(). Error:", error);
      }
    },

    /**
     * Do not call this method directly. Instead, call setSourceModel(), which
     * will update listeners and then call this method. This method will
     * populate this citation model's attributes from another model, such as a
     * SolrResult model or a DataONEObject model. This will reset and overwrite
     * any existing attributes on this model.
     * @param {Backbone.Model} model - The model to populate from, accepts
     * SolrResult or a model that is a DataONEObject or an extended
     * DataONEObject. If no model is passed, then the model will be reset to the
     * default attributes.
     * @since x.x.x
     */
    populateFromModel: function (newSourceModel) {
      try {
        // Populate this model from the new sourceModel

        const newAttrs = this.defaults();

        if (!newSourceModel) {
          this.set(newAttrs);
          return;
        }

        const attrGetters = {
          year_of_publishing: this.getYearFromSourceModel,
          title: this.getTitleFromSourceModel,
          journal: this.getJournalFromSourceModel,
          pid: this.getPidFromSourceModel,
          seriesId: this.getSeriesIdFromSourceModel,
          originArray: this.getOriginArrayFromSourceModel,
          view_url: this.getViewUrlFromSourceModel,
        };

        Object.entries(attrGetters).forEach(([attrName, getter]) => {
          const attrValue = getter.call(this, newSourceModel);
          if (attrValue) newAttrs[attrName] = attrValue;
        });

        this.set(newAttrs);
      } catch (error) {
        console.log(
          "Error populating a CitationModel from the model: ",
          newSourceModel,
          " Error: ",
          error
        );
      }
    },

    /**
     * Get the year from the sourceModel. First look for pubDate, then
     * dateUploaded (both in SolrResult & ScienceMetadata/EML models). Lastly
     * check datePublished (found in ScienceMetadata/EML models only.)
     * @param {Backbone.Model} sourceModel - The model to get the year from
     * @returns {Number} - The year
     * @since x.x.x
     */
    getYearFromSourceModel(sourceModel) {
      try {
        const year =
          this.yearFromDate(sourceModel.get("pubDate")) ||
          this.yearFromDate(sourceModel.get("dateUploaded")) ||
          this.yearFromDate(sourceModel.get("datePublished"));
        return year;
      } catch (error) {
        console.log(
          "Error getting year from the sourceModel. Model and error:",
          sourceModel,
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
        // If this is a Data object, there may not be a title, so try to get the
        // title from the file name
        if (!title && sourceModel.get("fileName")) {
          let fn = sourceModel.get("fileName");
          const extRegex = /\.[^/.]+$/;
          // Save the extension
          let ext = fn ? fn.match(extRegex) : null;
          // remove the period and make it all uppercase
          ext = ext ? ext[0].replace(".", "").toUpperCase() : ext;
          // Remove the extension and replace underscores with spaces
          fn = fn.replace(extRegex, "").replace(/_+/g, " ");
          title = fn ? fn : title;
          title = title && ext ? title + " [" + ext + "]" : title;
        }
        return title;
      } catch (error) {
        console.log(
          "Error getting title from the sourceModel. Model and error:",
          sourceModel,
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
          "Error getting journal from the sourceModel. Model and error:",
          sourceModel,
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
          "";

        // otherwise, this is probably a base D1 object model. Don't use
        // rightsHolder or submitter for now, because it might not always be the
        // author.

        // sourceModel.get("rightsHolder") ||
        // sourceModel.get("submitter");

        // Convert EML parties to strings & check for incorrectly escaped
        // characters
        if (authors) {
          authors = Array.isArray(authors) ? authors : [authors];
          authors = authors.map((author) => this.formatAuthor(author));
        }
        return authors;
      } catch (error) {
        console.log(
          "Error getting originArray from the sourceModel. Model and error:",
          sourceModel,
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
        const pid =
          sourceModel.get("id") || sourceModel.get("identifier") || null;
        return pid;
      } catch (error) {
        console.log(
          "Error getting the pid from the sourceModel. Model and error:",
          sourceModel,
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
          "Error getting the seriesId from the sourceModel. Model and error:",
          sourceModel,
          error
        );
        return this.defaults().seriesId;
      }
    },

    /**
     * Use the sourceModel's createViewURL() method to get the viewUrl for the
     * citation. This method is built into DataONEObject models, SolrResult
     * models, as  well as Portal models. If the sourceModel doesn't have a
     * createViewURL() method, then use the default viewUrl (null)
     * @param {Backbone.Model} sourceModel - The model to get the viewUrl from
     * @returns {String} - The viewUrl, or null if the sourceModel doesn't have
     * a createViewURL() method.
     * @since x.x.x
     */
    getViewUrlFromSourceModel(sourceModel) {
      try {
        if (sourceModel && sourceModel.createViewURL) {
          return sourceModel.createViewURL();
        } else {
          return this.defaults().viewUrl;
        }
      } catch (error) {
        console.log(
          "Error getting the viewUrl from the sourceModel. Model and error:",
          sourceModel,
          error
        );
        return this.defaults().viewUrl;
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

        // Update the origin array asynchonously if the author is an ORCID
        if (this.isOrcid(author)) this.originArrayFromOrcid(author);

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
     * Cleans up the title for display within a citation. Removes a period from
     * the end of the title if it exists and trims whitespace.This method is
     * called any time a title is set on the Citation model.
     * @param {string} title The title to format
     * @returns {string} Returns the title with a period removed from the end if
     * it exists.
     * @since x.x.x
     */
    formatTitle: function (title) {
      if (!title) return "";
      return title.replace(/\.+$/, "").trim();
    },

    /**
     * Cleans up the metrics service string for display within a citation.
     * Replaces "NULL" with an empty string, removes a period from the end of
     * the string if it exists, removes curly braces, and trims whitespace.
     * @param {string} str The metrics service string to format
     * @returns {string} Returns the metrics service string with "NULL" replaced
     * with an empty string.
     * @since x.x.x
     */
    formatMetricsServiceString: function (str) {
      if (!str) return "";
      // The metrics service returns "NULL" if there is no data
      str = str === "NULL" ? "" : str;
      // Replace period at the end of the string
      str = str.replace(/\.+$/, "");
      // Remove curly braces
      str = str.replace(/{|}/g, "");
      // Remove any leading or trailing whitespace
      str = str.trim();
      return str;
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
     * Check if a string is a valid ORCID.
     * @param {string} orcid The ORCID to check
     * @returns {boolean} Returns true if the ORCID is valid, false otherwise
     */
    isOrcid: function (orcid) {
      try {
        if (!orcid) return false;
        const regex = new RegExp(
          "^https?:\\/\\/orcid.org\\/(\\d{4}-){3}(\\d{3}[0-9X])$"
        );
        return regex.test(orcid);
      } catch {
        return false;
      }
    },

    /**
     * Use the App Lookup model's get Accounts method to get the name of the
     * author from their ORCID, then asynchronously set the originArray to
     * contain that name.
     * @param {string} orcid The ORCID to get the name for
     */
    originArrayFromOrcid: function (orcid) {
      try {
        const request = { term: orcid };
        const model = this;

        const callback = function (response) {
          let name = null;
          if (response) {
            if (Array.isArray(response)) {
              const label = response[0].label;
              if (label) {
                // Name is the format "Min Liew
                // (http://orcid.org/0000-0002-5156-4610)" We want to return
                // "Min Liew". It will always be two spaces and a "("
                name = label.split("  (")[0];
              }
            }
          }
          if (name) {
            console.log("Setting originArray to ", [name]);
            model.set("originArray", [name]);
          }
        };
        MetacatUI.appLookupModel.getAccountsAutocomplete(request, callback);
      } catch (error) {
        console.log(
          "There was an error getting the name from the orcid.",
          error
        );
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
        const sourceModel = this.get("sourceModel");
        return (
          sourceModel &&
          sourceModel.get &&
          sourceModel.get("datasource") &&
          sourceModel.get("datasource") === node
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
        return originArray.join(", ");
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
      return this.isArchived() && !this.archivedContentIsIndexed();
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
     * Remove all DOI prefixes from a DOI string, including https, http, doi.org,
     * dx.doi.org, and doi:.
     * @param {string} str - The DOI string to remove prefixes from.
     * @returns {string} - The DOI string without any prefixes.
     * @since x.x.x
     */
    removeAllDOIPrefixes: function (str) {
      if (!str) return "";
      // Remove https and http prefixes
      str = str.replace(/^(https?:\/\/)?/, "");
      // Remove domain prefixes, like doi.org and dx.doi.org
      str = str.replace(/^(doi\.org\/|dx\.doi\.org\/)/, "");
      // Remove doi: prefix
      str = str.replace(/^doi:/, "");
      return str;
    },

    /**
     * Check if a string is a valid DOI.
     * @param {string} doi - The string to check.
     * @returns {boolean} - True if the string is a valid DOI, false otherwise.
     * @since x.x.x
     */
    isDOI: function (str) {
      try {
        if (!str) return false;
        str = this.removeAllDOIPrefixes(str);
        const doiRegex = /^10\.[0-9]{4,}(?:[.][0-9]+)*\/[^\s"<>]+$/;
        return doiRegex.test(str);
      } catch (e) {
        console.error("Error checking if string is a DOI", e);
        return false;
      }
    },

    /**
     * Get the URL for the online location of the object being cited when it has
     * a DOI. If the DOI is not passed to the function, or if the string is not
     * a DOI, then an empty string is returned.
     * @param {string} [str] - The DOI string with or without the "doi:" prefix.
     * It may already be a URL, or it may be a DOI string. It also handles the
     * case where the DOI is already a URL.
     * @returns {string} - The DOI URL
     * @since x.x.x
     */
    DOItoURL: function (str) {
      if (!str) return "";
      str = this.removeAllDOIPrefixes(str);
      if (!this.isDOI(str)) return "";
      return "https://doi.org/" + str;
    },

    /**
     * Get the DOI from a DOI URL. The URL can be http or https, can include the
     * "doi:" prefix or not, and can use "dx.doi.org" or "doi.org" as the
     * domain. If a string is not passed to the function, or if the string is
     * not for a DOI URL, then an empty string is returned.
     * @param {string} url - The DOI URL
     * @returns {string} - The DOI string, including the "doi:" prefix
     * @since x.x.x
     */
    URLtoDOI: function (url) {
      if (!url) return "";
      const doiURLRegex =
        /https?:\/\/(dx\.)?doi\.org\/(doi:)?(10\.[0-9]{4,}(?:[.][0-9]+)*\/[^\s"<>]+)/;
      const doiURLMatch = url.match(doiURLRegex);
      if (doiURLMatch) return "doi:" + doiURLMatch[3];
      return "";
    },

    /**
     * Checks if the citation has a DOI in the seriesId or pid attributes.
     * @returns {string} - The DOI of the seriesID, if it is a DOI, or the DOI
     * of the pid, if it is a DOI. Otherwise, returns null.
     * @since x.x.x
     */
    findDOI: function () {
      try {
        if (!this.sourceModel || !this.sourceModel.isDOI) return null;
        const seriesID = this.get("seriesId");
        const pid = this.get("pid");
        if (this.sourceModel.isDOI(seriesID)) return seriesID;
        if (this.sourceModel.isDOI(pid)) return pid;
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
     * If this citation has a source model, and if that source model is a
     * DataONEObject, then return the results of the DataONEObject's
     * `getUploadStatus` function
     * @returns {string} - The upload status of the source model, if it is a
     * DataONEObject, or null if it is not.
     * @since x.x.x
     * @see DataONEObject#getUploadStatus
     */
    getUploadStatus: function () {
      return this.sourceModel ? this.sourceModel.get("uploadStatus") : null;
    },
  });

  return Citation;
});
