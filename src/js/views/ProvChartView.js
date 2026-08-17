define([
  "jquery",
  "underscore",
  "backbone",
  "views/CitationView",
  "views/ProvEntitySelectView",
  "views/ProvStatementView",
], function (
  $,
  _,
  Backbone,
  CitationView,
  ProvEntitySelectView,
  ProvStatement,
) {
  "use strict";

  const dataRecords = (records) =>
    (records || []).filter(({ type }) =>
      ["data", "image", "PDF"].includes(type),
    );
  const editableRecords = (records) =>
    (records || []).filter(({ editable }) => editable !== false);
  const CLASS_NAMES = {
    alertError: "alert-error",
    filename: "filename",
    helpText: "help-text subtle alert",
    learnMoreIcon: "icon icon-on-right icon-long-arrow-right",
    view: "prov-chart",
  };
  const MESSAGES = {
    chooseFiles: "Choose from files in this dataset: ",
    derivedDataHelp:
      " by selecting which data objects were created from transforming, changing, or updating it. ",
    inputDataHelp:
      " by selecting which data object was input or consumed by it. ",
    learnMore: "Learn more about data provenance",
    originAndProcessing: "Describe the origin and processing history of ",
    programGeneratedHelp:
      " by selecting which program, script, or code created it. ",
    programUsedHelp:
      " by selecting a program, script, or code that used it to create another data object. ",
    programOutputHelp:
      " by selecting which data objects were created by or output by it. ",
    provenanceRejected: "The provenance change was rejected.",
    relationshipCannotBeEdited:
      "Only aggregated programs with no run or one unambiguous run can be edited here.",
    remove: "Remove",
    sourceDataHelp:
      " by selecting which data object was used as a source to create it. ",
    processingHistory: "Describe the processing history of ",
  };
  const RELATIONSHIP_MODES = {
    derivedData: "derivedData",
    generatingProgram: "generatingProgram",
    programInput: "programInput",
    programOutput: "programOutput",
    sourceData: "sourceData",
    usingProgram: "usingProgram",
  };

  const createHelpText = (lead, fileName, tail) =>
    $(document.createElement("p"))
      .addClass(CLASS_NAMES.helpText)
      .text(lead)
      .append(
        $(document.createElement("code"))
          .addClass(CLASS_NAMES.filename)
          .text(fileName),
      )
      .append(tail);

  const classifyRelationshipMode = (
    chartType,
    selectedEntityType,
    contextType,
  ) => {
    if (chartType === "sources") {
      if (selectedEntityType === "program") {
        return RELATIONSHIP_MODES.generatingProgram;
      }
      if (contextType === "program") return RELATIONSHIP_MODES.programInput;
      return RELATIONSHIP_MODES.sourceData;
    }
    if (selectedEntityType === "program") {
      return RELATIONSHIP_MODES.usingProgram;
    }
    if (contextType === "program") return RELATIONSHIP_MODES.programOutput;
    return RELATIONSHIP_MODES.derivedData;
  };

  const getPickerCopy = (mode, fileName) => {
    if (mode === RELATIONSHIP_MODES.generatingProgram) {
      return {
        title: `Add the program that generated ${fileName}`,
        lead: MESSAGES.originAndProcessing,
        tail: MESSAGES.programGeneratedHelp,
      };
    }
    if (mode === RELATIONSHIP_MODES.programInput) {
      return {
        title: `Add source data to ${fileName}`,
        lead: MESSAGES.originAndProcessing,
        tail: MESSAGES.inputDataHelp,
      };
    }
    if (mode === RELATIONSHIP_MODES.sourceData) {
      return {
        title: `Add source data to ${fileName}`,
        lead: MESSAGES.originAndProcessing,
        tail: MESSAGES.sourceDataHelp,
      };
    }
    if (mode === RELATIONSHIP_MODES.usingProgram) {
      return {
        title: `Add the program that used ${fileName}`,
        lead: MESSAGES.processingHistory,
        tail: MESSAGES.programUsedHelp,
      };
    }
    if (mode === RELATIONSHIP_MODES.programOutput) {
      return {
        title: `Add derived data for ${fileName}`,
        lead: MESSAGES.processingHistory,
        tail: MESSAGES.programOutputHelp,
      };
    }
    return {
      title: `Add derived data for ${fileName}`,
      lead: MESSAGES.processingHistory,
      tail: MESSAGES.derivedDataHelp,
    };
  };

  /**
   * @class ProvChartView
   * @classdesc Displays and edits provenance relationships for one package
   * member
   * @classcategory Views
   * @augments Backbone.View
   * @screenshot views/ProvChartView.png
   */
  const ProvChartView = Backbone.View.extend({
    /**
     * Initialize a source or derivation chart.
     * @param {object} options View options
     * @param {Backbone.View} [options.parentView] Parent metadata view
     * @param {object[]} [options.sources] Source chart records
     * @param {object[]} [options.derivations] Derivation chart records
     * @param {object} options.context Package member represented by the chart
     * @param {HTMLElement|JQuery} [options.contextEl] Metadata detail element
     * @param {DataPackage} [options.dataPackage] Editable data package
     * @param {ProvenanceChartAdapter} [options.projection] Chart projection
     * @param {number} [options.nodeHeight] Node height in pixels
     * @param {number} [options.offsetTop] Chart top offset in pixels
     * @param {string} [options.title] Chart title
     * @param {boolean} [options.editModeOn] Whether editing is enabled
     * @returns {void}
     */
    initialize(options = {}) {
      this.parentView = options.parentView || null;
      this.sources = options.sources || null;
      this.derivations = options.derivations || null;
      this.context = options.context || null; // The package member
      this.contextEl = options.contextEl || $("body"); // The parent view DOM element for the package member
      this.dataPackage = options.dataPackage || null;
      this.projection = options.projection || null;
      this.citationModels = new Map();
      this.memberPidSet = new Set(
        (this.projection?.records || []).map((record) => record.pid),
      );
      this.nodeHeight = options.nodeHeight || 67; //Pixel height of the node including padding and margins
      this.offsetTop = options.offsetTop || this.nodeHeight; //The top margin of the chart, in pixels
      this.title = options.title || "";
      this.editModeOn = options.editModeOn || false;
      this.canEditContext = this.editModeOn && this.context.editable !== false;

      this.subviews = [];
      this.selectProvEntityView = null;
      this.type = null;

      this.serviceUrl =
        MetacatUI.appModel.get("objectServiceUrl") ||
        MetacatUI.appModel.get("resolveServiceUrl");

      // For source charts
      if (!this.derivations && this.sources) {
        this.type = "sources";
        this.provEntities = this.sources;

        // Find the number of sources and programs
        const sources = [];
        const programs = [];
        this.sources.forEach((model) => {
          if (model.type === "program") programs.push(model);
          else sources.push(model);
        });

        this.sources = sources;
        this.programs = programs;

        this.numSources = this.sources.length;
        this.numPrograms = this.programs.length;
        this.numProvEntities = this.numSources;
        this.numDerivations = 0;
      }

      // For derivation charts
      if (!this.sources && this.derivations) {
        this.type = "derivations";
        this.provEntities = this.derivations;

        // Find the number of derivations and programs
        const derivations = [];
        const programs = [];
        this.derivations.forEach((model) => {
          if (model.type === "program") programs.push(model);
          else derivations.push(model);
        });

        this.derivations = derivations;
        this.programs = programs;

        this.numDerivations = this.derivations.length;
        this.numPrograms = this.programs.length;
        this.numProvEntities = this.numDerivations;
        this.numSources = 0;
      }

      // Add the chart type to the class list
      this.className += ` ${this.type}`;

      // Create a title
      if (this.context.type === "program" && this.type === "derivations") {
        this.title = `${this.numProvEntities} outputs`;
      } else if (this.context.type === "program" && this.type === "sources") {
        this.title = `${this.numProvEntities} inputs`;
      } else {
        this.title = `${this.numProvEntities} ${this.type}`;
      }

      //The default height of the chart when all nodes are visible/expanded
      this.height =
        Math.max(this.numProvEntities, this.numPrograms) * this.nodeHeight;
      // Add height for one more node if edit mode is on. The node height affects portion of
      // the left or right border that is visible, which is what is used to display the vertical
      // portion of the connectors between data nodes and programs or the package member
      // (that owns the metadata detail section).
      if (this.canEditContext) this.height += this.nodeHeight;
    },

    tagName: "aside",

    className: CLASS_NAMES.view,

    events: {
      "click .expand-control": "expandNodes",
      "click .collapse-control": "collapseNodes",
      "click .preview": "previewData",
      "click .editor": "selectProvEntities",
      "click #selectDone": "getSelectedProvEntities",
    },

    /**
     * Render the provenance nodes and their controls.
     * @returns {ProvChartView|boolean} This view, or false when the chart is
     * empty and cannot be edited
     */
    render: function () {
      if (!this.numProvEntities && !this.numPrograms && !this.canEditContext)
        return false;

      const view = this;

      //Are there any programs? If no programs are present in this package member and edit mode is on,
      // then we need to draw an edit icon in the program position, unless this member is a program (programs
      // aren't connected directly to programs).
      if (
        this.programs.length ||
        (this.canEditContext && this.context.type !== "program")
      ) {
        this.$el.append(
          $(document.createElement("div")).addClass(
            `${this.type}-programs programs`,
          ),
        );
      }

      let position = 0;
      let programPosition = 0;
      this.provEntities.forEach((entity) => {
        let metadataID = entity.isDocumentedBy;
        let metadata = null;

        if (Array.isArray(metadataID)) [metadataID] = metadataID;
        if (metadataID) metadata = view.projection?.getRecord(metadataID);

        // Programs will be positioned at a different point in the graph
        if (entity.type === "program") {
          // Find the program position
          view
            .$(".programs")
            .append(view.createNode(entity, programPosition, metadata));
        } else {
          view.$el.append(view.createNode(entity, position, metadata));
          // Sources and Derivation charts have a pointer for each node
          view.$el.append(view.createConnecter(position));
        }

        // Bump the position for non-programs only
        if (entity.type === "program") programPosition += 1;
        else position += 1;
      });

      // If edit mode is on, then draw an editor node.
      if (this.canEditContext) {
        // If a program prov icon has already been
        // displayed, then don't display a program edit icon, as currently only one program is
        // supported per ProvCharView. Also, don't display a program icon if the package members
        // the package member being annotated is a program. Programs as inputs
        // or outputs of other programs are not currently supported.
        if (this.context.type !== "program" && this.numPrograms === 0) {
          const programNode = this.createEditorNode(
            "program",
            this.context.pid,
            programPosition,
          );
          this.$(".programs").append(programNode, this.createConnecter());
          this.createEditTooltip(programNode);
          this.numPrograms += 1;
        }

        // Draw a data node editor
        const dataNode = this.createEditorNode(
          "data",
          this.context.pid,
          position,
        );
        this.$el.append(dataNode);
        this.createEditTooltip(dataNode);
        position += 1;

        if (this.type === "sources") this.numSources += 1;
        if (this.type === "derivations") this.numDerivations += 1;

        // Add a connector for this edit icon.
        this.$el.append(this.createConnecter(position - 1));
      }

      //Move the last-viewed prov node to the top of the chart so it is always displayed first
      if (this.$(".node.previous").length > 0)
        this.switchNodes(
          this.$(".node.previous").first(),
          this.$(".node").first(),
        );

      //Add classes
      this.$el.addClass(this.className);
      if (this.numPrograms > 0) this.$el.addClass("has-programs");
      if (this.numDerivations == 1 && !this.numPrograms)
        this.$el.addClass("one-derivation");

      //Specify classes for the context element (e.g. entity details container)
      var contextClasses =
        this.type == "sources" ? "hasProvLeft" : "hasProvRight";

      if (this.numPrograms > 0 && this.type == "sources") {
        contextClasses += " hasProgramsLeft";
      } else if (this.numPrograms > 0 && this.type == "derivations") {
        contextClasses += " hasProgramsRight";
      }

      $(this.contextEl).addClass(contextClasses);

      //If it's a derivation chart, add a connector line
      if (this.type == "derivations" && !this.numPrograms)
        this.$el.append(this.createPointer());
      //If it's a sources chart, add a pointer arrow
      if (this.type == "sources" && !this.numPrograms)
        this.$el.append(this.createPointer());

      //Charts with programs need an extra connecter
      if (this.programs.length && (this.numSources || this.numDerivations))
        this.$(".programs").append(this.createConnecter());

      if (this.$(".collapsed").length) {
        var expandIcon = $(document.createElement("i")).addClass(
            "icon icon-expand-alt",
          ),
          collapseIcon = $(document.createElement("i")).addClass(
            "icon icon-collapse-alt",
          );

        this.$el
          .addClass("expand-collapse")
          .append(
            $(document.createElement("a"))
              .addClass("expand-control")
              .text("view more ")
              .append(expandIcon),
          )
          .append(
            $(document.createElement("a"))
              .addClass("collapse-control")
              .text("view less ")
              .append(collapseIcon),
          );
        this.collapseNodes();
      } else this.$el.css("height", this.height - this.offsetTop);

      //Lastly, add the title
      this.$el.prepend(
        $(document.createElement("h3")).addClass("title").text(this.title),
      );

      if (this.canEditContext)
        this.$(".program.editor").click(function (e) {
          view.selectProvEntities(e);
        });

      // Render the non-editor prov nodes so each has a unique style.
      var nodeMin = 1;
      var nodeMax = 23; // Max number of 'uniqueNoden' css classes defined (in metacatui-common.css)
      var i = view.getRandomInt(nodeMin, nodeMin + 5);
      _.each(view.$(".node:not(.editor)"), function (thisNode) {
        //Don't use the unique class on images since they will look a lot different anyway by their image
        if (!$(thisNode).first().hasClass("image")) {
          var className = "uniqueNode" + i;
          //Add the unique class and up the iterator
          if ($(thisNode).prop("tagName") != "polygon")
            $(thisNode).addClass(className);
          else
            $(thisNode).attr(
              "class",
              $(thisNode).attr("class") + " " + className,
            );

          // Increment the node counter, but not past the max value, which is the number of
          // unique css classes that are defined.
          i == nodeMax ? (i = nodeMin) : i++;
        }
      });

      return this;
    },

    /**
     * Adapt a projected chart record for CitationView
     * @param {object} record Projected chart record
     * @returns {Backbone.Model|null} Cached citation source model
     * @since 0.0.0
     */
    getCitationModel(record) {
      if (!record) return null;
      if (this.citationModels.has(record.pid)) {
        return this.citationModels.get(record.pid);
      }
      const model = new Backbone.Model({
        id: record.pid,
        fileName: record.fileName,
        title: record.title,
        origin: record.origin,
        dateUploaded: record.dateUploaded,
        seriesId: record.seriesId,
        datasource: record.datasource,
      });
      model.type = "DataONEObject";
      model.createViewURL = () =>
        `${MetacatUI.root}/view/${encodeURIComponent(record.pid)}`;
      this.citationModels.set(record.pid, model);
      return model;
    },

    /**
     * Create a rendered provenance node and its detail popover.
     * @param {object} provEntity Projected provenance record
     * @param {number} position Vertical chart position
     * @param {object|null} metadata Metadata record for the citation
     * @returns {JQuery|SVGElement} Rendered data or program node
     */
    createNode(provEntity, position, metadata) {
      // What kind of icon will visually represent this object type?
      let icon = "";
      let { type } = provEntity;
      const view = this;
      if (type === "data") icon = "icon-table";
      else if (type === "metadata") icon = "icon-file-text";
      else if (type === "image") icon = "icon-picture";
      else if (type === "PDF") icon = "icon-file pdf";

      if (!type) {
        type = "data";
        icon = "icon-table";
      }

      // Get the name of this object
      const name = provEntity.fileName || provEntity.pid || type;

      // Get the node position and whether it overflows its context element.
      let top;
      let isCollapsed;
      if (provEntity.type === "program") {
        const distanceFromMiddle =
          position * this.nodeHeight - this.nodeHeight / 2;
        const operator = distanceFromMiddle > 0 ? "+" : "-";
        top = `calc(50% ${operator} ${Math.abs(distanceFromMiddle)}px)`;
        isCollapsed = "expanded";
      } else {
        top = position * this.nodeHeight - this.nodeHeight / 2;
        isCollapsed =
          top + this.nodeHeight + this.offsetTop >
          $(this.contextEl).outerHeight()
            ? "collapsed"
            : "expanded";
      }

      let nodeEl;
      let svg;
      let programIconGroup;
      if (provEntity.type !== "program") {
        // Create a DOM element to represent the node
        nodeEl = $(document.createElement("div")).css("top", top);

        // Add a delete icon to the node if editing is on
        if (this.editModeOn && provEntity.editable !== false) {
          // Create a delete icon
          const deleteIcon = $(document.createElement("i"))
            .addClass("data icon icon-remove-sign remove")
            .attr("title", MESSAGES.remove)
            .hide();

          // Add the delete icon to the node
          nodeEl.append(deleteIcon);

          deleteIcon.on("click", (evt) => {
            // Stop propagation of the click event so parent elements do not receive it.
            // This will prevent the node popover from displaying for this node when the delete icon is clicked.
            evt.stopPropagation();
            // Remove the provenance icon and the associated relationships from the DataPackage.
            try {
              view.removeProv(provEntity.pid, "data");
            } catch (error) {
              view.showProvenanceError(error);
            }
          });

          // When the node is hovered over, show the delete icon
          nodeEl.hover(
            // mouseenter action
            () => {
              deleteIcon.show();
            },
            // mouseleave action
            // If the mouse passes over the delete icon as it is exiting the prov icon, then the event target
            // becomes the delete icon itself, and not the div containing the prov icon. To be safe, just
            // turn off all delete icons in this prov chart, which works every time and doesn't require us
            // to test the event target that was fired.
            () => {
              view.$(".remove").hide();
            },
          );
        }
      } else {
        type = "program";

        // Create an SVG drawing for the program arrow shape
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        nodeEl = $(
          document.createElementNS("http://www.w3.org/2000/svg", "polygon"),
        ).attr("points", "2,20 2,48 17,48 17,67 67,33.5 17,2 17,20");

        //Set a viewBox, height, width, and top position
        svg.setAttribute(
          "viewBox",
          `0 0 ${this.nodeHeight} ${this.nodeHeight}`,
        );
        svg.setAttribute("class", "popover-this");
        $(svg)
          .attr("width", `${this.nodeHeight}px`)
          .attr("height", `${this.nodeHeight}px`)
          .css("top", top);

        //Create the code icon
        const iconEl = $(
          document.createElementNS("http://www.w3.org/2000/svg", "text"),
        )
          .text("\uF121")
          .attr("class", "icon icon-foo program-icon pointer");

        //Create a group element to contain the icon
        programIconGroup = $(
          document.createElementNS("http://www.w3.org/2000/svg", "g"),
        )
          .attr("transform", "translate(18,43)")
          .attr("class", "popover-this program-icon pointer");

        //Glue it all together
        programIconGroup.append(iconEl);
        $(svg).append(nodeEl, programIconGroup);

        if (this.editModeOn && provEntity.editable !== false) {
          // Add a delete icon to the node if editing is on
          const deleteGroup = $(
            document.createElementNS("http://www.w3.org/2000/svg", "g"),
          )
            .attr("transform", "translate(35,25)")
            .attr("class", "program pointer");
          const deleteIcon = $(
            document.createElementNS("http://www.w3.org/2000/svg", "text"),
          )
            .text("\uF057")
            .attr("class", "icon icon-foo remove pointer")
            .attr("title", MESSAGES.remove)
            .hide();
          deleteGroup.append(deleteIcon);
          $(svg).append(deleteGroup);

          deleteIcon.on("click", (evt) => {
            // Stop propagation of the click event so parent elements do not receive it.
            // This will prevent the node popover from displaying for this node when the delete icon is clicked.
            evt.stopPropagation();
            try {
              view.removeProv(provEntity.pid, "program");
            } catch (error) {
              view.showProvenanceError(error);
            }
          });

          $(svg).hover(
            // mouseenter action
            () => {
              deleteIcon.show();
            },
            // mouseleave action
            () => {
              // Hide all remove icons for program nodes. See comments for
              // hiding data icons above (mouseleave for data icons).
              view.$("[class*='remove']").hide();
            },
          );
        }
      }

      // Add classes via .attr() so it works for SVG, too
      const currentClasses = $(nodeEl).attr("class") || "";
      $(nodeEl)
        .attr(
          "class",
          `${currentClasses} ${type} node pointer popover-this ${isCollapsed}`,
        )
        .attr("tabindex", 0)
        // Reference the id of the data object
        .attr("data-id", provEntity.pid);

      // Read-only provenance looks normal outside edit mode. The message only
      // explains why an expected edit control is unavailable.
      if (this.editModeOn && provEntity.editable === false) {
        $(nodeEl).attr("title", MESSAGES.relationshipCannotBeEdited);
      }

      // Display images in the prov chart node
      if (provEntity.type === "image") {
        $(nodeEl).css(
          "background-image",
          `url('${view.serviceUrl}${encodeURIComponent(provEntity.pid)}')`,
        );
      }
      // Create an icon inside the node for other format types
      else {
        const iconEl = $(document.createElement("i")).addClass(`${icon} icon`);
        // Put the icon in the node
        $(nodeEl).append(iconEl);
      }

      // The placement and title depend on the chart type.
      const isDerivation = this.type === "derivations";
      const placement = isDerivation ? "left" : "right";
      const title = `${isDerivation ? "Derived" : "Source"} ${type}`;

      const citationModel = this.getCitationModel(metadata || provEntity);

      // The citation
      let createLink = true;
      if (
        provEntity.pid === MetacatUI.appModel.get("pid") ||
        citationModel.get("id") === MetacatUI.appModel.get("pid")
      ) {
        createLink = false;
      }

      const citationHeader = $(document.createElement("h6"))
        .addClass("subtle")
        .text("Citation");
      const citationView = new CitationView({
        model: citationModel,
        createLink,
      }).render();
      const citationEl = citationView.el;
      this.subviews.push(citationView);

      // The title
      const titleEl = $(document.createElement("span")).append(
        $(document.createElement("i")).addClass(`${icon} icon-on-left`),
        title,
      );

      // The name
      const nameEl = name
        ? $(document.createElement("h5")).addClass("name").text(name)
        : null;

      // The View link
      const arrowIcon = $(document.createElement("i")).addClass(
        "icon-double-angle-right icon-on-right",
      );
      const linkEl = $(document.createElement("a"))
        .attr(
          "href",
          `${MetacatUI.root}/view/${encodeURIComponent(provEntity.pid)}`,
        )
        .addClass("btn")
        .text("View")
        .append(arrowIcon);
      if (this.memberPidSet.has(provEntity.pid)) {
        linkEl.addClass("preview").attr("data-id", provEntity.pid);
      }

      // The provenance statements
      const provStatementView = new ProvStatement({
        model: provEntity,
        relationships: this.projection?.getStatements(provEntity.pid),
        currentlyViewing: this.context,
      });
      const provStatementEl = provStatementView.render().el;
      this.subviews.push(provStatementView);

      // Glue all the parts together
      const headerContainer = $(document.createElement("div"))
        .addClass("well header")
        .append(citationHeader, citationEl, linkEl);
      const popoverContent = $(document.createElement("div"))
        .append(headerContainer, provStatementEl)
        .attr("data-id", provEntity.pid);

      // Add the name of the data object to the popover
      if (name) $(headerContainer).prepend(nameEl);

      // Display images in the prov chart node popover
      if (provEntity.type === "image") {
        const img = $(document.createElement("img"))
          .attr(
            "src",
            `${view.serviceUrl}${encodeURIComponent(provEntity.pid)}`,
          )
          .addClass("thumbnail");

        $(citationEl).after(img);
      }

      // Mark the node that was last viewed, if any
      if (MetacatUI.appModel.get("previousPid") === provEntity.pid) {
        $(nodeEl).addClass("previous");
        $(citationEl).before(
          $(document.createElement("h7")).text("Last viewed"),
        );
      }

      // Get the id->class name map for unique node colors
      const classMap = this.parentView.classMap || null;

      //Add a popover to the node that will show the citation for this dataset and a provenance statement
      $(nodeEl)
        .popover({
          html: true,
          placement: placement,
          trigger: "click",
          container: this.el,
          title: titleEl,
          content: function () {
            //Find the unique class name associated with this ID
            if (classMap) {
              var allProvLinks = $(popoverContent).find(
                ".provenance-statement .node-link[data-id]",
              );
              _.each(allProvLinks, function (provlink, i, allProvLinks) {
                var id = $(provlink).attr("data-id"),
                  mapItem = _.findWhere(classMap, { id: id });

                if (typeof mapItem !== "undefined") {
                  var className = mapItem.className,
                    matchingProvLinks = $(allProvLinks).filter(
                      "[data-id='" + id + "']",
                    );
                  if (matchingProvLinks.length > 0)
                    $(matchingProvLinks).addClass(className);
                }
              });
            }

            return popoverContent;
          },
        })
        .on("show.bs.popover", function () {
          //Close the last open node popover
          $(".popover-this.active").popover("hide");

          //Toggle the active class
          if ($(this).parent("svg").length)
            $(this).attr("class", $(this).attr("class") + " active");
          else $(this).toggleClass("active");
        })
        .on("hide.bs.popover", function () {
          //Toggle the active class
          if ($(this).parent("svg").length)
            $(this).attr(
              "class",
              $(this).attr("class").replace(" active", " "),
            );
          else $(this).toggleClass("active");
        });

      /*
       * Set a separate event listener on the program icon since it is overlapped with the program arrow
       */
      if (provEntity.type === "program") {
        programIconGroup.on("click", function () {
          var programNode = $(this).prev("polygon"),
            isOpen = $(programNode).attr("class").indexOf("active") > -1;

          if (isOpen) $(programNode).popover("hide");
          else $(programNode).popover("show");
        });
      }

      // If the prov statement views in the popover content have an expand collapse list view, then we want to delegate events
      //  again when the popover is done displaying. This is because the ExpandCollapseList view hides/shows DOM elements, and each time
      // the DOM elements are hidden, their events are detached.
      if (provStatementView.subviews.length > 0) {
        //Get the ExpandCollapseList views
        var expandCollapseLists = _.where(provStatementView.subviews, {
          name: "ExpandCollapseList",
        });
        if (expandCollapseLists.length > 0) {
          //When the popover is *done* displaying
          $(nodeEl).on("shown.bs.popover", function () {
            //Delegate the events of each of the ExpandCollapseList views
            _.each(expandCollapseLists, function (subview) {
              subview.delegateEvents(subview.events);
            });
          });
        }
      }

      //If this node is rendered as an SVG, return that. Otherwise return the node element created.
      return typeof svg != "undefined" ? svg : nodeEl;
    },

    /**
     * Create a control for adding a provenance relationship.
     * @param {string} type Either data or program
     * @param {string} id Context object identifier
     * @param {number} position Vertical chart position
     * @returns {JQuery|SVGElement} Rendered edit control
     */
    createEditorNode: function (type, id, position) {
      //Get the top CSS style of this node based on its position in the chart and determine if it vertically overflows past its context element
      if (type == "program") {
        var distanceFromMiddle =
            position * this.nodeHeight - this.nodeHeight / 2,
          operator = distanceFromMiddle > 0 ? "+" : "-",
          top =
            "calc(50% " +
            operator +
            " " +
            Math.abs(distanceFromMiddle).toString() +
            "px)",
          isCollapsed = "expanded";
      } else {
        var top = position * this.nodeHeight - this.nodeHeight / 2,
          isCollapsed =
            top + this.nodeHeight + this.offsetTop >
            $(this.contextEl).outerHeight()
              ? "collapsed"
              : "expanded";
      }

      var nodeEl = null;
      var svg = null;
      // Only two types of editor nodes, "data" and "program"
      if (type != "program") {
        //Create a DOM element to represent the node
        nodeEl = $(document.createElement("div")).css("top", top);

        //Add classes via .attr() so it works for SVG, too
        var currentClasses = nodeEl.attr("class") || "";
        nodeEl.attr(
          "class",
          currentClasses + " " + type + " node pointer editor " + isCollapsed,
        );
        nodeEl.attr("tabindex", 0);

        //Reference the id of the data object
        nodeEl.attr("data-id", id);

        //Create the plus icon
        var iconEl = $(document.createElement("i")).addClass("icon icon-plus");

        //Put the icon in the node
        nodeEl.append(iconEl, "Add");
      } else {
        //Create an SVG drawing for the program arrow shape
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        nodeEl = $(
          document.createElementNS("http://www.w3.org/2000/svg", "polygon"),
        );

        //Create the SVG shape by adding x,y coordinates for lines to connect to
        nodeEl.attr("points", "2,20 2,48 17,48 17,67 67,33.5 17,2 17,20");

        //Set a viewBox, height, width, and top position
        svg.setAttribute(
          "viewBox",
          "0 0 " + this.nodeHeight + " " + this.nodeHeight,
        );
        //svg.setAttribute("class", "editor");
        $(svg)
          .attr("width", this.nodeHeight + "px")
          .attr("height", this.nodeHeight + "px")
          .css("top", top);

        //Create the plus icon
        var iconEl = $(
          document.createElementNS("http://www.w3.org/2000/svg", "text"),
        )
          .text("\uF067")
          //.attr("class", "icon icon-foo program-icon pointer");
          .attr("class", "icon icon-foo pointer");

        //Create a group element to contain the icon
        var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        $(g).attr("transform", "translate(25,30)");
        $(g).attr("class", " program editor pointer ");

        //Add classes via .attr() so it works for SVG, too
        var currentClasses = nodeEl.attr("class") || "";
        nodeEl.attr(
          "class",
          currentClasses + " " + type + " node editor pointer " + isCollapsed,
        );
        nodeEl.attr("tabindex", 0);
        nodeEl.attr("data-id", id);

        //Create a "group" element
        var gAdd = $(
          document.createElementNS("http://www.w3.org/2000/svg", "g"),
        );

        //Position the group element and add the text "Add"
        gAdd
          .attr("transform", "translate(18,45)")
          .attr("class", " program node editor pointer ")
          .append(
            $(
              document.createElementNS("http://www.w3.org/2000/svg", "text"),
            ).text("Add"),
          );

        //Glue it all together
        $(g).append(iconEl);
        $(svg).append(nodeEl, g, gAdd);
      }

      if (svg != null) {
        return svg;
      } else {
        return nodeEl;
      }
    },

    /**
     * Create a connector at a chart position.
     * @param {number} [position] Vertical chart position
     * @returns {JQuery} Rendered connector
     */
    createConnecter: function (position) {
      if (typeof position == "undefined") {
        var top = "50%",
          isCollapsed = "";
      } else {
        var top = this.nodeHeight * position,
          isCollapsed =
            top + this.nodeHeight / 2 + this.offsetTop >
            $(this.contextEl).outerHeight()
              ? "collapsed"
              : "expanded";
      }

      return $(document.createElement("div"))
        .addClass("connecter " + isCollapsed)
        .css("top", top);
    },

    /**
     * Create the arrow that points from the chart to its context.
     * @returns {JQuery} Rendered pointer
     */
    createPointer() {
      return $(document.createElement("img"))
        .attr("src", MetacatUI.root + "/img/arrow.gif")
        .addClass("prov-pointer");
    },

    /**
     * Add editing guidance to a provenance control.
     * @param {HTMLElement|JQuery} nodeEl Provenance control
     * @returns {void}
     */
    createEditTooltip: function (nodeEl) {
      //Start a tooltip title and get the object's file name
      var toolTipTitle = "",
        fileName = this.context.fileName || " this data file.",
        nodeType = $(nodeEl).is("svg") ? "program" : "data";

      //Create the tooltip title
      if (this.type == "sources" && nodeType == "data") {
        toolTipTitle = "Add source " + nodeType + " to " + fileName;
      } else if (this.type == "sources" && nodeType == "program") {
        toolTipTitle = "Add a program that output " + fileName;
      } else if (this.type == "derivations" && nodeType == "data") {
        toolTipTitle = "Add derived data to " + fileName;
      } else if (this.type == "derivations" && nodeType == "program") {
        toolTipTitle = "Add a program that used " + fileName;
      }

      //Create the tooltip settings for programs and data nodes
      var tooltipOptions = {
        placement: "top",
        title: toolTipTitle,
        delay: 600,
      };

      //Programs need tooltips to be handled a bit differently since they are SVG elements
      if (nodeType == "program") {
        //Add the trigger
        tooltipOptions.trigger = "manual";
        tooltipOptions.container = this.el;

        //Create the Bootstrap tooltip and manually show and hide it
        //based on mouseover and mouseout events
        $(nodeEl)
          .tooltip(tooltipOptions)
          .mouseenter(function () {
            setTimeout(function () {
              $(nodeEl).tooltip("show");
            }, 500);
          })
          .mouseleave(function () {
            setTimeout(function () {
              $(nodeEl).tooltip("hide");
            }, 500);
          });
      } else {
        tooltipOptions.trigger = "hover";

        //Create the Bootstrap tooltip
        $(nodeEl).tooltip(tooltipOptions);
      }
    },

    /**
     * Display every node in a collapsed chart.
     * @returns {void}
     */
    expandNodes: function () {
      //Change the context element (accompanying metadata section) and the chart itself to the full expanded height
      $(this.contextEl).height(this.height + this.offsetTop);
      this.$el.height(this.height - this.offsetTop);

      //Hide the expand control and show the hidden nodes
      this.$(".expand-control").fadeOut();
      this.$(".collapse-control").fadeIn();
      this.$(".collapsed").fadeIn();
    },

    /**
     * Hide nodes that extend beyond the chart context.
     * @returns {void}
     */
    collapseNodes() {
      //Fit the context element to its contents
      $(this.contextEl).height("auto");

      //For source charts
      // Use the last expanded/visible connector element to determine the chart height
      const lastConnecter = _.last(this.$(".connecter.expanded"));
      if (lastConnecter) {
        this.$el.height(parseInt(lastConnecter.style.top, 10));
      } else {
        this.$el.height(this.height);
      }
      // Find the pointer and move to the halfway point of the chart height
      this.$(".prov-pointer").css("top", "50%");

      //Hide the expand control and show the hidden nodes
      this.$(".expand-control").fadeIn();
      this.$(".collapse-control").css("display", "none");

      this.$(".collapsed").fadeOut();
    },

    /**
     * Exchange the chart positions of two nodes.
     * @param {HTMLElement|JQuery} nodeA Node to move to the first position
     * @param {HTMLElement|JQuery} nodeB Node to move to the previous position
     * @returns {void}
     */
    switchNodes: function (nodeA, nodeB) {
      if (nodeA == nodeB) return;

      var oldPosition = $(nodeA).css("top");
      var isCollapsed = $(nodeA).hasClass("collapsed");

      $(nodeA)
        .css("top", (this.nodeHeight / 2) * -1)
        .removeClass("collapsed");
      $(nodeB).first().css("top", oldPosition);
      if (isCollapsed) $(nodeB).first().addClass("collapsed");
    },

    /**
     * Preview or navigate to the selected provenance record.
     * @param {Event} e Preview click event
     * @returns {void}
     */
    previewData: function (e) {
      //Don't go anywhere yet...
      e.stopPropagation();
      e.preventDefault();

      //If this prov chart has a parent view with a previewData function, then execute that
      if (
        this.parentView &&
        this.parentView.previewData &&
        this.parentView.previewData(e)
      ) {
        //Trigger a click on the active node to deactivate it
        this.$(".node.active").click();

        //Exit
        return;
      }

      //Get the target of the click
      var button = $(e.target);
      if (!$(button).hasClass("preview"))
        button = $(button).parents("a.preview");
      if (button.length < 1) button = $(button).parents("[href]");

      //Trigger a click on the active node to deactivate it
      this.$(".node.active").click();

      //navigate to the link href
      window.location = $(button).attr("href");
    },

    /**
     * Open the package member picker for a provenance relationship.
     * @param {Event} e Edit control click event
     * @returns {void}
     */
    selectProvEntities(e) {
      const provInfoURL = MetacatUI.appModel.get("provenanceInfoURL");
      const helpLink = provInfoURL
        ? $(document.createElement("a"))
            .attr("href", provInfoURL)
            .attr("target", "_blank")
            .text(MESSAGES.learnMore)
            .append(
              $(document.createElement("i")).addClass(
                CLASS_NAMES.learnMoreIcon,
              ),
            )
        : null;
      const isProgram = e.currentTarget.classList.contains("program");
      const selectEntityType = isProgram ? "program" : "data";
      const mode = classifyRelationshipMode(
        this.type,
        selectEntityType,
        this.context.type,
      );
      const { title, lead, tail } = getPickerCopy(mode, this.context.fileName);
      const helpText = createHelpText(lead, this.context.fileName, tail);
      let relatedRecords = this.programs;
      if (!isProgram) {
        relatedRecords =
          this.type === "sources" ? this.sources : this.derivations;
      }
      const excludedPids = new Set(
        (relatedRecords || []).map(({ pid }) => pid),
      );

      // Add a link to a help/more info page to the help text
      if (helpLink) {
        helpText.append(helpLink);
      }

      this.closeProvEntitySelect();

      this.selectProvEntityView = new ProvEntitySelectView({
        title,
        selectLabel: MESSAGES.chooseFiles,
        additionalElements: helpText,
        selectEntityType, // Can be either "data" or "program"
        projection: this.projection,
        context: this.context,
        excludedPids,
        // Number of rows in the select list
        displayRows: Math.min(10, this.projection?.records.length || 0),
      });
      this.$el.append(this.selectProvEntityView.render().el);
      this.subviews.push(this.selectProvEntityView);

      // Display the modal and wait for completion.
      this.$("#selectModal").modal("show");
    },

    /**
     * Close and forget the active provenance picker
     * @returns {void}
     * @since 0.0.0
     */
    closeProvEntitySelect() {
      if (!this.selectProvEntityView) return;
      const selectView = this.selectProvEntityView;
      selectView.onClose();
      this.subviews = _.without(this.subviews, selectView);
      this.selectProvEntityView = null;
    },

    /**
     * Apply the relationships selected in the provenance picker.
     * @returns {boolean} Whether at least one relationship was applied
     */
    getSelectedProvEntities() {
      const selectView = this.selectProvEntityView;
      // Read values from the selection list modal dialog
      const selectedValues = selectView.readSelected();
      this.$("#selectModal").modal("hide");

      // Return if no values were selected.
      if (!selectedValues.length) {
        this.closeProvEntitySelect();
        return false;
      }

      // Get the entity type ("program" or "data") from the selection view. This
      // is the entity type of the prov icon that was clicked in order to add
      // this type to the prov of the current package member. The entityType
      // is either "program" or "data".
      const entityType = selectView.selectEntityType;
      this.closeProvEntitySelect();

      // Add the selected values to this prov graph.
      try {
        this.addProv(selectedValues, entityType);
        return true;
      } catch (error) {
        this.showProvenanceError(error);
        return false;
      }
    },

    /**
     * Add the relationships represented by this chart through DataPackage.
     * @param {string[]} values Related object identifiers
     * @param {string} entityType Either data or program
     * @returns {void}
     * @throws {Error} When DataPackage rejects a relationship
     */
    addProv: function (values, entityType) {
      values.forEach((pid) => {
        this.changeProv("add", pid, entityType);
      });
    },

    /**
     * Show a rejected provenance change
     * @param {Error} error Provenance error
     * @returns {void}
     * @since 0.0.0
     */
    showProvenanceError(error) {
      const message = error?.message || MESSAGES.provenanceRejected;
      if (this.parentView?.showMessage) {
        this.parentView.showMessage(message, { type: "error" });
      } else {
        MetacatUI.appView?.showAlert?.(
          message,
          CLASS_NAMES.alertError,
          "body",
          5000,
        );
      }
    },

    /**
     * Close the picker, remove subviews, and remove the chart.
     * @returns {void}
     */
    onClose() {
      const modal = this.$("#selectModal");
      if (modal.length && typeof modal.modal === "function") {
        modal.modal("hide");
      }
      this.closeProvEntitySelect();
      this.subviews.forEach((view) => {
        if (view.onClose) view.onClose();
        else view.remove?.();
      });
      this.subviews = [];
      this.remove();
      this.unbind();
    },

    /**
     * Choose an integer from an inclusive minimum and exclusive maximum.
     * @param {number} min Minimum value
     * @param {number} max Exclusive maximum value
     * @returns {number} Random integer
     */
    getRandomInt: function (min, max) {
      min = Math.ceil(min);
      max = Math.floor(max);
      return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
    },

    /**
     * Remove the relationship represented by a chart node.
     * @param {string} pidToRemove Related object identifier
     * @param {string} entityType Either data or program
     * @returns {void}
     * @throws {Error} When DataPackage rejects the change
     */
    removeProv(pidToRemove, entityType) {
      this.changeProv("remove", pidToRemove, entityType);
    },

    /**
     * Apply one chart relationship change through DataPackage
     * @param {string} action Either add or remove
     * @param {string} pid Related object identifier
     * @param {string} entityType Either data or program
     * @returns {void}
     * @throws {Error} When DataPackage rejects the change
     * @since 0.0.0
     */
    changeProv(action, pid, entityType) {
      const generatedByProgram =
        action === "add" ? "addGeneratedByProgram" : "removeGeneratedByProgram";
      const usedByProgram =
        action === "add" ? "addUsedByProgram" : "removeUsedByProgram";
      const wasDerivedFrom =
        action === "add" ? "addWasDerivedFrom" : "removeWasDerivedFrom";
      const mode = classifyRelationshipMode(
        this.type,
        entityType,
        this.context.type,
      );

      if (mode === RELATIONSHIP_MODES.generatingProgram) {
        this.dataPackage[generatedByProgram](this.context.pid, pid);
        dataRecords(this.sources).forEach((source) => {
          this.dataPackage[usedByProgram](source.pid, pid);
        });
      } else if (mode === RELATIONSHIP_MODES.programInput) {
        this.dataPackage[usedByProgram](pid, this.context.pid);
        dataRecords(this.projection?.getDerivations(this.context.pid)).forEach(
          (derivation) => {
            this.dataPackage[wasDerivedFrom](derivation.pid, pid);
          },
        );
      } else if (mode === RELATIONSHIP_MODES.sourceData) {
        this.dataPackage[wasDerivedFrom](this.context.pid, pid);
        editableRecords(this.programs).forEach((program) => {
          this.dataPackage[usedByProgram](pid, program.pid);
        });
      } else if (mode === RELATIONSHIP_MODES.usingProgram) {
        this.dataPackage[usedByProgram](this.context.pid, pid);
        dataRecords(this.derivations).forEach((derivation) => {
          this.dataPackage[generatedByProgram](derivation.pid, pid);
        });
      } else if (mode === RELATIONSHIP_MODES.programOutput) {
        this.dataPackage[generatedByProgram](pid, this.context.pid);
        dataRecords(this.projection?.getSources(this.context.pid)).forEach(
          (source) => {
            this.dataPackage[wasDerivedFrom](pid, source.pid);
          },
        );
      } else {
        this.dataPackage[wasDerivedFrom](pid, this.context.pid);
        editableRecords(this.programs).forEach((program) => {
          this.dataPackage[generatedByProgram](pid, program.pid);
        });
      }
    },
  });

  return ProvChartView;
});
