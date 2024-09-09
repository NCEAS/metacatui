define([
  "jquery",
  "underscore",
  "backbone",
  "gmaps",
  "common/Utilities",
  "models/SolrResult",
  "views/DownloadButtonView",
  "text!templates/loading.html",
  "text!templates/alert.html",
  "text!templates/attribute.html",
  "text!templates/dataDisplay.html",
], (
  $,
  _,
  Backbone,
  gmaps,
  Utilities,
  SolrResult,
  DownloadButtonView,
  LoadingTemplate,
  alertTemplate,
  AttributeTemplate,
  DataDisplayTemplate,
) => {
  const MetadataIndexView = Backbone.View.extend({
    type: "MetadataIndex",

    id: "Metadata",

    className: "metadata-index container form-horizontal",

    tagName: "article",

    template: null,

    loadingTemplate: _.template(LoadingTemplate),

    attributeTemplate: _.template(AttributeTemplate),

    alertTemplate: _.template(alertTemplate),

    dataDisplayTemplate: _.template(DataDisplayTemplate),

    semanticFields: null,

    events: {},

    initialize(options) {
      this.pid = options.pid || null;
      // this.el.id = this.id + "-" + this.pid; //Give this element a specific ID in case multiple MetadataIndex views are on one page
      this.parentView = options.parentView || null;

      // use these to tailor the annotation ui widget
      this.semanticFields = {
        attribute: "sem_annotation",
        attributeName: "sem_annotation",
        attributeLabel: "sem_annotation",
        attributeDescription: "sem_annotation",
        attributeUnit: "sem_annotation",
        origin: "orcid_sm",
        investigator: "orcid_sm",
      };
    },

    render() {
      if (!this.pid) return false;

      const view = this;

      // Get all the fields from the Solr index
      const query = `q=(id:"${encodeURIComponent(
        this.pid,
      )}"+OR+seriesId:"${encodeURIComponent(
        this.pid,
      )}")&rows=1&start=0&fl=*&wt=json`;
      var requestSettings = {
        url: MetacatUI.appModel.get("queryServiceUrl") + query,
        success(data, textStatus, xhr) {
          try {
            if (!data?.response?.numFound) {
              if (view.parentView && view.parentView.model) {
                // Show a "not indexed" message if there is system metadata but nothing in
                // the index
                if (view.parentView.model.get("systemMetadata")) {
                  view.showNotIndexed();
                }
                // Show a "not found" message if there is no system metadata and no results in the index
                else {
                  view.parentView.model.set("notFound", true);
                  view.parentView.showNotFound();
                }
              }

              view.flagComplete();
            } else {
              view.docs = data.response.docs;

              _.each(data.response.docs, (doc, i, list) => {
                // If this is a data object and there is a science metadata doc that describes it, then navigate to that Metadata View.
                if (
                  doc.formatType == "DATA" &&
                  doc.isDocumentedBy &&
                  doc.isDocumentedBy.length
                ) {
                  view.onClose();
                  MetacatUI.uiRouter.navigate(
                    `view/${doc.isDocumentedBy[0]}`,
                    true,
                  );
                  return;
                }

                const metadataEl = $(document.createElement("section")).attr(
                  "id",
                  "metadata-index-details",
                );
                const { id } = doc;
                const creator = doc.origin;
                const { title } = doc;
                const { pubDate } = doc;
                const { dateUploaded } = doc;
                let keys = Object.keys(doc);
                const docModel = new SolrResult(doc);

                // Extract General Info details that we want to list first
                const generalInfoKeys = [
                  "title",
                  "id",
                  "abstract",
                  "pubDate",
                  "keywords",
                ];
                keys = _.difference(keys, generalInfoKeys);
                $(metadataEl).append(
                  view.formatAttributeSection(
                    docModel,
                    generalInfoKeys,
                    "General",
                  ),
                );

                // Extract Spatial details
                const spatialKeys = [
                  "site",
                  "southBoundCoord",
                  "northBoundCoord",
                  "westBoundCoord",
                  "eastBoundCoord",
                ];
                keys = _.difference(keys, spatialKeys);
                $(metadataEl).append(
                  view.formatAttributeSection(
                    docModel,
                    spatialKeys,
                    "Geographic Region",
                  ),
                );

                // Extract Temporal Coverage details
                const temporalKeys = ["beginDate", "endDate"];
                keys = _.difference(keys, temporalKeys);
                $(metadataEl).append(
                  view.formatAttributeSection(
                    docModel,
                    temporalKeys,
                    "Temporal Coverage",
                  ),
                );

                // Extract Taxonomic Coverage details
                const taxonKeys = [
                  "order",
                  "phylum",
                  "family",
                  "genus",
                  "species",
                  "scientificName",
                ];
                keys = _.difference(keys, taxonKeys);
                $(metadataEl).append(
                  view.formatAttributeSection(
                    docModel,
                    taxonKeys,
                    "Taxonomic Coverage",
                  ),
                );

                // Extract People details
                const peopleKeys = [
                  "origin",
                  "investigator",
                  "contactOrganization",
                  "project",
                ];
                keys = _.difference(keys, peopleKeys);
                $(metadataEl).append(
                  view.formatAttributeSection(
                    docModel,
                    peopleKeys,
                    "People and Associated Parties",
                  ),
                );

                // Extract Access Control details
                const accessKeys = [
                  "isPublic",
                  "submitter",
                  "rightsHolder",
                  "writePermission",
                  "readPermission",
                  "changePermission",
                  "authoritativeMN",
                ];
                keys = _.difference(keys, accessKeys);
                $(metadataEl).append(
                  view.formatAttributeSection(
                    docModel,
                    accessKeys,
                    "Access Control",
                  ),
                );

                // Add the rest of the metadata
                $(metadataEl).append(
                  view.formatAttributeSection(docModel, keys, "Other"),
                );

                view.$el.html(metadataEl);

                view.flagComplete();
              });
            }
          } catch (e) {
            console.log(`Error parsing Solr response: ${e}`);
            console.log(`Solr response: ${data}`);
            view.parentView.showNotFound();
          }
        },
        error() {
          const msg = "<h4>Sorry, no dataset was found.</h4>";
          view.$el.html(view.alertTemplate({ msg, classes: "alert-danger" }));
        },
      };

      $.ajax(
        _.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()),
      );

      // Send a request for the EML doc itself to extract certain info
      if (this.parentView && this.parentView.model) {
        const formatId = this.parentView.model.get("formatId");
        if (formatId.indexOf("eml://") >= 0) {
          const url = `${
            MetacatUI.appModel.get("baseUrl") +
            MetacatUI.appModel.get("context") +
            MetacatUI.appModel.get("d1Service")
          }/object/${encodeURIComponent(this.parentView.model.get("id"))}`;

          var requestSettings = {
            url,
            success(data, textStatus, xhr) {
              if (!data || !$(data).length) return;

              // Find the distribution information
              const emlDoc = $(data)
                .find("distribution")
                .each((i, dist) => {
                  const onlineDist = $(dist).children("online");
                  if (onlineDist.length) {
                    var linkText = $(onlineDist).text();

                    if (linkText.indexOf("ecogrid") >= 0) {
                      // Clean up the link text
                      const start = linkText.lastIndexOf("/");
                      const ecogridPid = linkText.substr(start + 1).trim();
                      let dataObjects = [];

                      // Iterate over each id in the package and try to fuzzily match the ecogrid link to the id
                      if (view.parentView.packageModels) {
                        // Get all the data objects in this metadata's packages
                        _.each(view.parentView.packageModels, (pckg) => {
                          dataObjects.push(pckg.get("members"));
                        });

                        dataObjects = _.flatten(dataObjects);
                      }
                      for (var i = 0; i < dataObjects.length; i++) {
                        // If we find a match, replace the ecogrid links with a DataONE API link to the object
                        if (dataObjects[i].get("id").indexOf(ecogridPid) > -1) {
                          var linkText = dataObjects[i].get("url");

                          // We can stop looking now
                          i = dataObjects.length;
                        }
                      }
                    }

                    const link = $(document.createElement("a"))
                      .attr("href", linkText)
                      .text(linkText);
                    const fullHTML = view.formatAttribute(
                      "Online Distribution Info",
                      link,
                    );

                    // Find the "General" section of this page
                    if (view.$(".General").length)
                      view.$(".General").after(fullHTML);
                    else view.$el.append(fullHTML);
                  }
                });
            },
          };

          $.ajax(
            _.extend(
              requestSettings,
              MetacatUI.appUserModel.createAjaxSettings(),
            ),
          );
        }
      }

      return this;
    },

    formatAttributeSection(doc, keys, title, className) {
      if (keys.length == 0) return "";

      if (typeof title === "string") {
        var titleHTML = $(document.createElement("h4")).text(title);
        var titleText = title;
      } else if (typeof title === "undefined") {
        var titleHTML = $(document.createElement("h4"));
        var titleText = "";
      } else {
        var titleHTML = title;
        var titleText = titleHTML.text();
      }

      let html = "";
      const sectionClass =
        typeof className === "undefined"
          ? titleText.replace(/ /g, "")
          : className;
      const view = this;
      let populated = false;

      _.each(keys, (key, keyNum, list) => {
        if (typeof key === "object" && doc.get(key.field)) {
          html += view.formatAttribute(key.display, doc.get(key.field));
          populated = true;
        } else if (doc.get(key)) {
          html += view.formatAttribute(key, doc.get(key));
          populated = true;
        }
      });

      if (populated) {
        const section = $(document.createElement("section"))
          .addClass(sectionClass)
          .append(titleHTML)
          .append(html);

        return section;
      }
      return null;
    },

    formatAttribute(attribute, value) {
      let html = "";
      const view = this;
      let embeddedAttributes = "";
      let type = "sem_annotation";

      // see if there is special handling for this field
      if (this.semanticFields[attribute]) {
        type = this.semanticFields[attribute];
      }

      // If this is a multi-valued field from Solr, the attribute value is actually multiple embedded attribute templates
      const numAttributes =
        Array.isArray(value) && value.length > 1 ? value.length : 0;
      for (let i = 0; i < numAttributes; i++) {
        embeddedAttributes += view.attributeTemplate({
          attribute: "",
          formattedAttribute: view.transformCamelCase(attribute),
          value: value[i].toString(),
          id: `${attribute}_${i + 1}`,
          type,
          resource: `#xpointer(//${attribute}[${i + 1}])`,
        });
      }

      if (!embeddedAttributes && value instanceof $) {
        value = value[0].outerHTML;
      }

      html += view.attributeTemplate({
        attribute,
        formattedAttribute: view.transformCamelCase(attribute),
        value: embeddedAttributes || value.toString(),
        id: attribute,
        type,
        resource: `#xpointer(//${attribute})`,
      });

      return html;
    },

    transformCamelCase(string) {
      const result = string
        .replace(/([A-Z]+)/g, " $1")
        .replace(/([A-Z][a-z])/g, " $1");
      const finalResult = result.charAt(0).toUpperCase() + result.slice(1);

      return finalResult;
    },

    insertDataDetails() {
      const view = this;

      // Get the Package Model - it is attached with the parent Metadata View
      const pkg = this.parentView.packageModel;
      if (!pkg) return;

      if (pkg.get("members").length <= 1) return;

      // Start some html
      const html = $(document.createElement("section"));

      _.each(pkg.get("members"), (solrResult, i) => {
        if (solrResult.get("formatType") != "DATA") return;

        solrResult.set(
          "formattedSize",
          Utilities.bytesToSize(solrResult.get("size")),
        );

        // Add a section for the data details, just like the other attribute sections
        const keys = [
          "id",
          { field: "formattedSize", display: "size" },
          "views",
          "pubDate",
          "dataSource",
          "formatId",
        ];

        // Determine the icon type based on format id
        const type = solrResult.getType();
        var icon = "";
        if (type == "program") icon = "icon-code";
        else if (type == "metadata") icon = "icon-file-text";
        else if (type == "image") icon = "icon-picture";
        else if (type == "pdf") icon = "icon-file pdf";
        else icon = "icon-table";

        var icon = $(document.createElement("i")).addClass(icon);
        const title = $(document.createElement("span"))
          .text(solrResult.get("id"))
          .addClass("title");
        const downloadBtn = new DownloadButtonView({ model: solrResult });
        const anchor = $(document.createElement("a")).attr(
          "name",
          encodeURIComponent(solrResult.get("id")),
        );
        const header = $(document.createElement("h4"))
          .append(anchor)
          .append(icon)
          .append(title)
          .append(downloadBtn.render().el);

        // Create the section
        const entityDetailsSection = view
          .formatAttributeSection(solrResult, keys, header, "entitydetails")
          .attr("data-id", solrResult.get("id"));

        // Create an image thumbnail, if this is an image
        if (type == "image") {
          // var thumbnail = view.parentView.createThumbnail(solrResult.get("id"));
          // $(entityDetailsSection).prepend(thumbnail);
        }

        // Mark this section with an anchor tag with the doc id
        $(entityDetailsSection).prepend(
          $(document.createElement("a")).attr(
            "id",
            solrResult.get("id").replace(/[^A-Za-z0-9]/g, "-"),
          ),
        );

        $(html).append(entityDetailsSection);
      });

      // Glue together the header and attribute info section
      const header = $(document.createElement("h4")).text(
        "Data Table, Image, and Other Data Details",
      );
      const section = $(html).prepend(header);

      // Insert into the DOM right after the "general" information
      this.$(".General").after(section);
    },

    // Shows a message to the user that indicates this object has not been indexed
    showNotIndexed() {
      const message = this.alertTemplate({
        classes: "alert-warning",
        msg:
          "<h4>There is limited information about this content.</h4>" +
          "<p>This data or science metadata is available to download, but " +
          "there seems to be an issue with displaying details on this webpage. " +
          "If this content was recently submitted, it may still be in the processing queue.</p>",
        includeEmail: true,
      });
      this.$el.append(message);

      // If this metadata doc is not indexed, we need to search the system metadata
      // to see if it is publicly accessible.
      if (this.parentView && this.parentView.model) {
        // Get the system metadata string
        let sysMeta = this.parentView.model.get("systemMetadata");
        if (sysMeta) {
          // Parse it into XML nodes
          sysMeta = $.parseXML(sysMeta);
          // Find the allow permission for the public
          const publicPermission = $(sysMeta).find(
            "allow subject:contains('public')",
          );
          if (publicPermission.length) {
            // Remove the "private" icon
            $("#metadata-controls-container .private").remove();
          }
        }
        // If there is no system metadata, default to hiding the private icon
        else {
          $("#metadata-controls-container .private").remove();
        }
      }
    },

    flagComplete() {
      this.complete = true;
      this.trigger("complete");
    },

    onClose() {
      this.$el.html(this.loadingTemplate());
      this.pid = null;

      // Detach this view from its parent view
      this.parentView.subviews = _.without(this.parentView.subviews, this);
      this.parentView = null;

      // Remove listeners
      this.stopListening();
    },
  });
  return MetadataIndexView;
});
