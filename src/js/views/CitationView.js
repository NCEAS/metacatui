define([
  "jquery",
  "underscore",
  "backbone",
  "models/SolrResult",
  "text!templates/citationView.html",
  "text!templates/citationArchived.html",
], function ($, _, Backbone, SolrResult, Template, ArchivedTemplate) {
  "use strict";

  /**
   * @class CitationView
   * @classdesc The CitationView shows a formatted citation for a package,
   * including title, authors, year, UUID/DOI, etc.
   * @classcategory Views
   * @extends Backbone.View
   * @screenshot views/CitationView.png
   * @constructor
   */
  var CitationView = Backbone.View.extend(
    /** @lends CitationView.prototype */ {
      /**
       * The name of this type of view
       * @type {string}
       */
      type: "Citation",

      /**
       * The HTML tag name for this view's element
       * @type {string}
       */
      tagName: "cite",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "citation",

      /**
       * Reference to the main templates for this view. HTML files are converted to
       * Underscore.js templates
       * @type {Underscore.Template}
       */
      template: _.template(Template),

      /**
       * Reference to templates that is used for this view when the object being
       * cited has been archived.
       * @type {Underscore.Template}
       */
      archivedTemplate: _.template(ArchivedTemplate),

      /**
       * The message to display in place of a citation when the object is
       * archived.
       * @type {string}
       */
      archivedMessage: "This content has been archived.",

      /**
       * The ID for the object to be cited. If this is provided and neither a
       * metadata model nor model is provided, then a query will be performed to
       * find the object given the ID. If a model or metadata model is provided,
       * then the ID will be overwritten with the ID of the object to cite (e.g.
       * DOI or UUID).
       * @type {string}
       */
      id: null,

      /**
       * A model to get citation info from
       * Option used by CitationListView, MDQRun, MetadataView, ProvChart, EML211EditorView
       * @type {Package...}
       */
      model: null,

      /**
       * A model to get citation info from
       * Option used by SearchResultsView
       * @type {SolrResult, Package ..., collection, portal}
       */
      metadata: null,

      /**
       * A default title for when there isn't one (e.g. a new document being edited)
       * Option used by EML211EditorView
       * @type {string}
       */
      title: null,

      /**
       * TODO
       * Used by CitationListView, MDQRun, MetadataView, ProvChart, EML211EditorView
       * @type {boolean}
       */
      createLink: true,

      /**
       * TODO
       * Used by MDQRun, EML211EditorView
       * @type {boolean}
       */
      createTitleLink: true,

      /**
       * Is executed when a new CitationView is created
       * @param {Object} options - A literal object with options to pass to the
       * view
       */
      initialize: function (options) {
        // Get all the options and apply them to this view
        if (!options || typeof options != "object") {
          options = {};
        }
        Object.keys(options).forEach(function (key) {
          this[key] = options[key];
        }, this);

        this.setUpModel();

        // this.setUpListeners();
      },

      setUpModel: function () {
        // If a metadata doc was passed but no data or package model, then save
        // the metadata as our model, too
        if (!this.model && this.metadata) this.model = this.metadata;
        // If the model is a Package, then get the metadata doc in this package
        else if (this.model && this.model.type == "Package")
          this.metadata = this.model.getMetadata();
        // If the model is a metadata doc and there was no other metadata
        // specified, then use the model
        else if (
          this.model &&
          this.model.getType &&
          this.model.getType() == "metadata" &&
          !this.metadata
        )
          this.metadata = this.model;

        // Check if the given metadata object is a portal or collection
        if (this.metadata) {
          this.isCollection =
            this.metadata.getType() == "collection" ||
            this.metadata.getType() == "portal";
        }

        if (!this.metadata) {
          this.metadata = this.model;
        }

        // If we don't have a model or metadata model yet, then do a query given
        // the provided ID
        // if (!this.model && !this.metadata && this.id) {
        //   this.metadata = this.model = new SolrResult({ id: this.id });
        //   this.model.getCitationInfo();
        //   return;
        // }
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
       * Given a list of authors, format them as a single string for display in
       * a citation.
       * @param {string|EMLParty[]} authors - An array of strings or EMLParty
       * models representing the list of authors
       * @param {number} [maxAuthors=5] - The maximum number of authors to
       * display. The string will be truncated with et al. if there are more
       * authors than this limit.
       * @returns string
       */
      getAuthorString: function (authors, maxAuthors = 5) {
        try {
          let str = "";

          if (!authors) {
            return str;
          }

          const numAuthors = authors.length;
          maxAuthors = maxAuthors || numAuthors;
          const displayAuthors = authors.slice(0, maxAuthors);
          // const extraAuthors = authors.slice(maxAuthors)

          displayAuthors.forEach(function (author, i) {
            // Convert EML parties to strings & check for incorrectly escaped
            // characters
            author = this.formatAuthor(author);
            // Add separator between this author and the previous one
            if (i > 0) {
              if (numAuthors > 2) str += ",";
              if (i + 1 == numAuthors) str += " and";
              if (numAuthors > 1) str += " ";
            }
            // Append the author to the string
            str += author;
          }, this);

          // Add et al if needed, plus period and space.
          if (numAuthors > maxAuthors) str += ", et al";
          str += ". ";

          return str;
        } catch (error) {
          console.log(
            "There was an error formatting the authors. " +
              "Authors will not be shown in the citation",
            error
          );
          return "";
        }
      },

      /**
       * Render the template for when the document/object being cited is
       * archived
       * @returns {CitationView} the citation view
       */
      showArchived() {
        try {
          this.$el.html(
            this.archivedTemplate({
              message: this.archivedMessage,
              id: this.createIDElement(), // TODO!!!
            })
          );
          return this;
        } catch (error) {
          console.log(
            "There was an error showing a citation for an archived document " +
              "in a CitationView. Error details: ".error
          );
        }
      },

      findAuthors: function () {
        const model = this.model;
        const metadata = this.metadata;
        // Find the author text and create a string
        let authors = [];
        // i. citation
        if (model.type == "CitationModel") {
          const authorStr = model.get("origin") || "";
          if (authorStr.length > 0) {
            authors = authorStr.split(", ");
          }
        } else if (metadata) {
          // ii. metadata
          if (metadata.type == "EML") {
            authors = metadata.get("creator");
          } else {
            // ii. other metadata
            authors = metadata.get("origin");
          }
          // iv. other: If there is no metadata doc, then this is probably a data doc without
          // science metadata. So create the citation from the index values
        } else {
          authors = [model.get("rightsHolder") || model.get("submitter") || ""];
        }
        return authors;
      },

      /*
       * Creates a Citation View
       */
      render: function () {
        let model = this.model;
        let metadata = this.metadata;
        const view = this;

        if (metadata) {
          // If this object is in progress of saving, don't RErender this view.
          if (
            metadata.get("uploadStatus") == "p" &&
            view.$el.children().length
          ) {
            return;
          }
          // If the content has been archived and is not index, show a warning
          // and stop rendering.
          if (
            metadata.get("archived") &&
            !MetacatUI.appModel.get("archivedContentIsIndexed")
          ) {
            this.showArchived();
            return;
          }
        } else if (!model) {
          // No metadata and no model. Don't render until we have at least one.
          if (!this.id) {
            return this;
          } else {
            // Create a model, retrieve the citation info for this model and
            // then render
            this.metadata = metadata = new SolrResult({ id: this.id });
            this.model = model = metadata;
            view.stopListening(view.model, "change");
            view.listenTo(view.model, "change", view.render);
            model.getCitationInfo();
            return this;
          }
        }

        // Clear the element in case we are re-rendering...
        this.$el.html("");

        // Collections will get the collection class added
        if (this.isCollection) {
          this.el.classList.add("collection");
        } else {
          this.el.classList.remove("collection");
        }

        // 1. AUTHOR ===========================================================
        const authorText = this.getAuthorString(this.findAuthors());

        // 2. OTHER ATTRIBUTES =================================================
        let title = "";
        // If the model is retrieved from the Metrics Service and of type
        // CitationModel, simply set the fields as retrieved from the response
        if (model.type == "CitationModel") {
          var datasource = model.get("journal");
          var dateUploaded = model.get("year_of_publishing");
          title = model.get("title");

          // Not used:
          // var volume = model.get("volume");
          // var page = model.get("page");``
          // var citationMetadata = model.get("citationMetadata");
          // var sourceId = model.get("source_id");
          // var journal = model.get("publisher");
        }

        // META DATA DOC
        // Get pubDate, dateUploaded, datasource, title
        else if (metadata) {
          var pubDate = metadata.get("pubDate");
          var dateUploaded = metadata.get("dateUploaded");
          var datasource = metadata.get("datasource");
          title = metadata.get("title");
          title = Array.isArray(title) ? title[0] : title;
          title = title ? title : this.title || "";
        }
        // DATA DOC
        // If there is no metadata doc, then this is probably a data doc without
        // science metadata. So create the citation from the index values
        else {
          var dateUploaded = model.get("dateUploaded"),
            datasource = model.get("datasource");
        }

        // ===========================================================
        // Get the publish date and publisher if this is not a collection or
        // portal (Why not for portals or collections??? - TODO)
        const authorEl = (this.authorEl = document.createElement("span"));
        authorEl.classList.add("author");

        const pubDateEl = (this.pubDateEl = document.createElement("span"));
        pubDateEl.classList.add("pubdate");

        const publisherEl = (this.publisherEl = document.createElement("span"));
        publisherEl.classList.add("publisher");

        if (!this.isCollection) {
          // PUB DATE TEXT
          const pubDateText =
            new Date(pubDate).getUTCFullYear() || dateUploaded || "";

          // PUBLISHER
          let publisherText = "";
          const currentMN = MetacatUI.nodeModel.get("currentMemberNode");

          if (datasource) {
            const datasourceMember = MetacatUI.nodeModel.getMember(datasource);
            const isCurrentNode =
              datasource == MetacatUI.appModel.get("nodeId");
            const repoName = MetacatUI.appModel.get("repositoryName");
            if (datasourceMember) {
              publisherText = datasourceMember.name;
            } else if (isCurrentNode) {
              publisherText = repoName;
            } else {
              publisherText = datasource;
            }
          } else if (currentMN) {
            publisherText = MetacatUI.nodeModel.getMember(currentMN).name;
          }
          publisherText = publisherText ? publisherText + ". " : "";

          // ADD TEXT TO ELEMENTS
          if (authorText) authorEl.textContent = authorText;
          if (pubDateText) pubDateEl.textContent = pubDateText + ". ";
          if (publisherText) publisherEl.textContent = publisherText;
        }

        // ADD ID ==============================================================
        // ⭐️ CITATION MODEL-SPECIFIC ID
        if (model.type == "CitationModel") {
          // Make the ID element different for a Citation Model - WHY?
          // displaying decoded source url
          const sourceUrl = this.model.get("source_url");
          var idEl = $(document.createElement("span")).addClass("publisher-id");
          idEl.append(
            decodeURIComponent(sourceUrl),
            $(document.createElement("span")).text(". ")
          );
        } else {
          // The ID
          var idEl = this.createIDElement();
        }

        // ADD TITLE ===========================================================
        // Make the title HTML element
        let titleEl = document.createElement("span");
        if (title) {
          // Format Title
          if (title.trim().charAt(title.length - 1) != ".")
            title = title.trim() + ". ";
          else title = title.trim() + " ";

          // ⭐️ CITATION MODEL-SPECIFIC ID TITLE FORMATTING
          if (model.type == "CitationModel") {
            const sourceUrl = this.model.get("source_url");
            // Appending the title as a link
            titleEl = $(document.createElement("a"))
              .addClass("metrics-route-to-metadata")
              .attr("data-id", model.get("id"))
              .attr("href", sourceUrl)
              .attr("target", "_blank")
              .append(title);
            // ALL OTHER TITLE FORMATTING
          } else {
            // Don't make the title a link for all other models.
            titleEl = $(document.createElement("span"))
              .addClass("title")
              .attr("data-id", metadata.get("id"))
              .text(title);
          }
        }

        // Create a link and put all the citation parts together
        if (this.createLink) {
          // ⭐️ CITATION MODEL-SPECIFIC LINK
          if (model.type == "CitationModel") {
            this.createCitationModelLink();
          } else {
            // ALL OTHER LINKS
            var linkEl = $(document.createElement("a"))
              .addClass("route-to-metadata")
              .attr("data-id", model.get("id"))
              // .attr("href", metadata.createViewURL())
              .append(
                this.authorEl,
                this.pubDateEl,
                titleEl,
                this.publisherEl,
                idEl
              );
          }
          this.$el.append(linkEl);
        }

        // Only append the citation link when we have non-zero dataset. Append
        // the cited dataset text to the link element
        if (this.createTitleLink) {
          var linkEl = $(document.createElement("a"))
            .addClass("route-to-metadata")
            .attr("data-id", model.get("seriesId"))
            // .attr("href", metadata.createViewURL())
            .append(titleEl);
          this.$el.append(
            this.authorEl,
            this.pubDateEl,
            linkEl,
            this.publisherEl,
            idEl
          );
        } else {
          this.$el.append(authorEl, pubDateEl, titleEl, publisherEl, idEl);
        }

        // TODO: should we set these listeners before render?
        this.setUpListeners();

        return this;
      },

      /**
       * Create a link element specifically for a citation model TODO - why does
       * this differ so much from how we create citations for all the other
       * models?
       * @returns {HTMLElement}
       */
      createCitationModelLink: function () {
        const model = this.model;
        var volume = model.get("volume");
        var page = model.get("page");
        const sourceUrl = this.model.get("source_url");

        var idEl = $(document.createElement("span")).addClass("publisher-id");
        idEl.append(
          decodeURIComponent(sourceUrl),
          $(document.createElement("span")).text(". ")
        );

        const authorEl = (this.authorEl = document.createElement("span"));
        authorEl.classList.add("author");
        const pubDateEl = (this.pubDateEl = document.createElement("span"));
        pubDateEl.classList.add("pubdate");
        const publisherEl = (this.publisherEl = document.createElement("span"));
        publisherEl.classList.add("publisher");
        const titleEl = document.createElement("span");

        var citationMetadata = model.get("citationMetadata");
        // Creating a volume element to display in Citations Modal Window
        if (volume === "NULL") {
          var volumeText = "";
        } else {
          var volumeText = "Vol. " + volume + ". ";
        }
        var volumeEl = $(document.createElement("span"))
          .addClass("publisher")
          .text(volumeText);

        // Creating a 'pages' element to display in Citations Modal Window
        if (page === "NULL") {
          var pageText = "";
        } else {
          var pageText = "pp. " + page + ". ";
        }
        var pageEl = $(document.createElement("span"))
          .addClass("publisher")
          .text(pageText);

        var datasetLinkEl = $(document.createElement("span")).text(
          "Cites Data: "
        );

        // Generate links for the cited datasets
        var citationMetadataCounter = 0;
        if (citationMetadata != undefined) {
          for (var key in citationMetadata) {
            citationMetadataCounter += 1;

            var commaSeperator =
              citationMetadataCounter < Object.keys(citationMetadata).length
                ? ","
                : ".";

            var mdPID = key,
              mdAuthorText = "",
              additionalAuthors = "",
              mdText = "",
              mdDateText = "";

            // Display first author in the dataset link
            if (
              citationMetadata[key]["origin"] != undefined &&
              Array.isArray(citationMetadata[key]["origin"])
            ) {
              mdAuthorText = citationMetadata[key]["origin"][0];
              additionalAuthors =
                citationMetadata[key]["origin"].length > 1 ? " et al." : "";

              mdText = "(" + mdAuthorText + additionalAuthors + " ";
            }

            // save the date
            if (citationMetadata[key]["datePublished"] != undefined) {
              mdDateText = citationMetadata[key]["datePublished"].slice(0, 4);
              if (mdText.length == 0) {
                mdText = "(";
              }
              mdText += mdDateText;
            } else if (citationMetadata[key]["dateUpdated"] != undefined) {
              mdDateText = citationMetadata[key]["dateUpdated"].slice(0, 4);
              if (mdText.length == 0) {
                mdText = "(";
              }
              mdText += mdDateText;
            } else if (citationMetadata[key]["dateModified"] != undefined) {
              mdDateText = citationMetadata[key]["dateModified"].slice(0, 4);
              if (mdText.length == 0) {
                mdText = "(";
              }
              mdText += mdDateText;
            }

            // retrieve the PID
            if (citationMetadata[key]["id"] != undefined) {
              mdPID = citationMetadata[key]["id"];
            } else if (key.startsWith("10.")) {
              mdPID = "doi:" + key;
            }

            if (mdText.length > 0) {
              mdText += ")" + commaSeperator + " ";

              var targetLinkEl = $(document.createElement("a"))
                .addClass("metrics-route-to-metadata")
                .attr("data-id", key)
                .attr(
                  "href",
                  MetacatUI.root + "/view/" + encodeURIComponent(mdPID)
                )
                .attr("target", "_blank")
                .text(mdText);

              datasetLinkEl.append(targetLinkEl);
            }
          }
        }

        // creating citation display string
        var linkEl = $(document.createElement("span")).append(
          authorEl,
          pubDateEl,
          titleEl,
          publisherEl,
          volumeEl,
          pageEl,
          idEl
        );

        if (datasetLinkEl !== "undefined" && citationMetadataCounter > 0) {
          // Displaying the cites data on the new line
          linkEl.prepend("<br>");
        }

        return linkEl;
      },

      /**
       * Create the HTML element that holds the unique ID for the object being
       * cited.
       * @returns {HTMLElement} Returns a span element containing the ID as text
       */
      createIDElement: function () {
        const model = this.metadata || this.model;
        const id = model.get("id");
        const seriesId = model.get("seriesId");
        const datasource = model.get("datasource");
        const isPANGAEA = datasource && datasource === "urn:node:PANGAEA";

        const idEl = document.createElement("span");
        idEl.classList.add("id");
        const seriesIDEl = document.createElement("span");
        const separatorEl = document.createElement("span");
        const pidEl = document.createElement("span");
        const suffixEl = document.createElement("span");

        // Series ID
        if (seriesId) {
          idEl.append(seriesIDEl, separatorEl);

          // Create a link for the identifier if it is a DOI
          if (model.isDOI(seriesId) && !this.createLink) {
            seriesIDEl.innerHTML = this.createDoiLink(seriesId);
          } else {
            seriesIDEl.textContent = seriesId;
          }
          // If this is a PANGAEA dataset with a seriesId, then don't show the
          // pid. Return now.
          if (isPANGAEA) {
            separatorEl.textContent = ". ";
            return idEl;
          } else {
            separatorEl.textContent = ", version: ";
          }
        }

        // PID
        idEl.append(pidEl, suffixEl);
        if (model.isDOI(id) && !this.createLink) {
          pidEl.innerHTML = this.createDoiLink(id);
        } else {
          pidEl.textContent = id;
        }
        suffixEl.textContent = ". ";

        return idEl;
      },

      /**
       * Specify the online location of the object we are citing when it has a
       * DOI
       * @param {string} doi The DOI string with or without the "doi:" prefix
       * @returns The DOI URL
       */
      createDoiUrl: function (doi) {
        if (doi.indexOf("http") == 0) {
          return doi;
        } else if (doi.indexOf("doi:") == 0) {
          return "https://doi.org/" + doi.substring(4);
        } else {
          return "https://doi.org/" + doi;
        }
      },

      /**
       * Create an HTML link for the DOI
       * @param {string} doi The DOI string with or without the "doi:" prefix
       * @returns {string} The DOI link as an HTML string
       */
      createDoiLink: function (doi) {
        return `<a href="${this.createDoiUrl(doi)}">${doi}</a>`;
      },

      /**
       * Add listeners to this view that listen for changes to the metadata
       * model and rerender as required.
       */
      setUpListeners: function () {
        if (!this.metadata) return;

        this.stopListening();

        // If anything in the model changes, rerender this citation
        this.listenTo(
          this.metadata,
          "change:origin change:creator change:pubDate change:dateUploaded change:title change:seriesId change:id change:datasource",
          this.render
        );

        // If this model is an EML211 model, then listen differently
        if (this.metadata.type == "EML") {
          var creators = this.metadata.get("creator");

          // Listen to the names
          for (var i = 0; i < creators.length; i++) {
            this.listenTo(
              creators[i],
              "change:individualName change:organizationName change:positionName",
              this.render
            );
          }
        }
      },
    }
  );

  return CitationView;
});
