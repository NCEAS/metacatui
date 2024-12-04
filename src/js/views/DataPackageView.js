define([
  "jquery",
  "underscore",
  "backbone",
  "localforage",
  "collections/DataPackage",
  "common/Utilities",
  "models/DataONEObject",
  "models/PackageModel",
  "models/metadata/ScienceMetadata",
  "models/metadata/eml211/EML211",
  "models/PackageModel",
  "views/DataItemView",
  "views/DownloadButtonView",
  "text!templates/dataPackage.html",
  "text!templates/dataPackageStart.html",
  "text!templates/dataPackageHeader.html",
], (
  $,
  _,
  Backbone,
  LocalForage,
  DataPackage,
  Utilities,
  DataONEObject,
  PackageModel,
  ScienceMetadata,
  EML211,
  Package,
  DataItemView,
  DownloadButtonView,
  DataPackageTemplate,
  DataPackageStartTemplate,
  DataPackageHeaderTemplate,
) => {
  "use strict";

  /**
   * @class DataPackageView
   * @classdesc The main view of a Data Package in MetacatUI.  The view is
   *  a file/folder browser
   * @classcategory Views
   * @screenshot views/DataPackageView.png
   * @augments Backbone.View
   */
  var DataPackageView = Backbone.View.extend(
    /** @lends DataPackageView.prototype */ {
      type: "DataPackage",

      tagName: "table",

      className: "table table-striped table-hover",

      id: "data-package-table",

      events: {
        "click .toggle-rows": "toggleRows", // Show/hide rows associated with event's metadata row
        "click .message-row .addFiles": "handleAddFiles",
        "click .expand-control": "expand",
        "click .collapse-control": "collapse",
        "click .d1package-expand": "expandAll",
        "click .d1package-collapse": "collapseAll",
      },

      subviews: {},

      /**
       * A reference to the parent EditorView that contains this view
       * @type EditorView
       * @since 2.15.0
       */
      parentEditorView: null,

      template: _.template(DataPackageTemplate),
      startMessageTemplate: _.template(DataPackageStartTemplate),
      dataPackageHeaderTemplate: _.template(DataPackageHeaderTemplate),

      // Models waiting for their parent folder to be rendered, hashed by parent id:
      // {'parentid': [model1, model2, ...]}
      delayedModels: {},

      /* Flag indicating the open or closed state of the package rows */
      isOpen: true,

      initialize(options) {
        if (options === undefined || !options) var options = {};

        if (!options.edit) {
          // The edit option will allow the user to edit the table
          this.edit = options.edit || false;
          this.mode = "view";
          this.packageId = options.packageId || null;
          this.memberId = options.memberId || null;
          this.attributes = options.attributes || null;
          this.dataPackage = options.dataPackage || new DataPackage();
          this.dataEntities = options.dataEntities || new Array();
          this.disablePackageDownloads =
            options.disablePackageDownloads || false;
          this.currentlyViewing = options.currentlyViewing || null;
          this.parentEditorView = options.parentView || null;
          this.title = options.title || "";
          this.packageTitle = options.packageTitle || "";
          this.nested =
            typeof options.nested === "undefined" ? false : options.nested;
          this.metricsModel = options.metricsModel;

          // set the package model
          this.packageModel = this.dataPackage.packageModel;

          this.listenTo(this.packageModel, "changeAll", this.render);
        } else {
          // Get the options sent to this view
          if (typeof options === "object") {
            // The edit option will allow the user to edit the table
            this.edit = options.edit || false;
            this.mode = "edit";

            // The data package to render
            this.dataPackage = options.dataPackage || new DataPackage();

            this.parentEditorView = options.parentEditorView || null;
          }
          // Create a new DataPackage collection if one wasn't sent
          else if (!this.dataPackage) {
            this.dataPackage = new DataPackage();
          }

          return this;
        }
      },

      /**
       *  Render the DataPackage HTML
       */
      render() {
        this.$el.addClass("download-contents table-condensed");
        this.$el.append(
          this.template({
            edit: this.edit,
            dataPackageFiltering:
              MetacatUI.appModel.get("dataPackageFiltering") || false,
            dataPackageSorting:
              MetacatUI.appModel.get("dataPackageSorting") || false,
            loading: MetacatUI.appView.loadingTemplate({
              msg: "Loading files table... ",
            }),
            id: this.dataPackage.get("id"),
            title: this.title || "Files in this dataset",
            classes: "download-contents table-striped table-condensed table",
          }),
        );

        if (this.edit) {
          // Listen for  add events because models are being merged
          this.listenTo(this.dataPackage, "add", this.addOne);
          this.listenTo(this.dataPackage, "fileAdded", this.addOne);
        }

        // Render the current set of models in the DataPackage
        this.addAll();

        if (this.edit) {
          // If this is a new data package, then display a message and button
          if (
            (this.dataPackage.length == 1 &&
              this.dataPackage.models[0].isNew()) ||
            !this.dataPackage.length
          ) {
            const messageRow = this.startMessageTemplate();

            this.$("tbody").append(messageRow);

            this.listenTo(this.dataPackage, "add", function () {
              this.$(".message-row").remove();
            });
          }

          // Render the Share control(s)
          this.renderShareControl();
        } else {
          // check for nessted datasets

          if (this.nested) {
            this.getNestedPackages();
          }
        }

        return this;
      },

      /**
       * Add a single DataItemView row to the DataPackageView
       * @param item
       * @param dataPackage
       */
      addOne(item, dataPackage) {
        if (!item) return false;

        // Don't add duplicate rows
        if (this.$(`.data-package-item[data-id='${item.id}']`).length) return;

        // Don't add data package
        if (
          item.get("formatType") == "RESOURCE" ||
          item.get("type") == "DataPackage"
        ) {
          return;
        }

        let dataItemView;
        let scimetaParent;
        let parentRow;
        let delayed_models;

        if (_.contains(Object.keys(this.subviews), item.id)) {
          return false; // Don't double render
        }

        let itemPath = null;
        const view = this;
        if (!_.isEmpty(this.atLocationObj)) {
          itemPath = this.atLocationObj[item.get("id")];
          if (itemPath[0] != "/") {
            itemPath = `/${itemPath}`;
          }
        }

        // get the data package id
        if (typeof dataPackage !== "undefined") {
          var dataPackageId = dataPackage.id;
        }
        if (typeof dataPackageId === "undefined")
          dataPackageId = this.dataPackage.id;

        const insertInfoIcon = this.edit
          ? false
          : view.dataEntities.includes(item.id);

        dataItemView = new DataItemView({
          model: item,
          metricsModel: this.metricsModel,
          itemPath,
          insertInfoIcon,
          currentlyViewing: this.currentlyViewing,
          mode: this.mode,
          parentEditorView: this.parentEditorView,
          dataPackageId,
        });
        this.subviews[item.id] = dataItemView; // keep track of all views

        if (this.edit) {
          // Get the science metadata that documents this item
          scimetaParent = item.get("isDocumentedBy");

          // If this item is not documented by a science metadata object,
          // and there is only one science metadata doc in the package, then assume it is
          // documented by that science metadata doc
          if (typeof scimetaParent === "undefined" || !scimetaParent) {
            // Get the science metadata models
            const metadataIds = this.dataPackage.sciMetaPids;

            // If there is only one science metadata model in the package, then use it
            if (metadataIds.length == 1) scimetaParent = metadataIds[0];
          }
          // Otherwise, get the first science metadata doc that documents this object
          else {
            scimetaParent = scimetaParent[0];
          }

          if (
            scimetaParent == item.get("id") ||
            (!scimetaParent && item.get("type") == "Metadata")
          ) {
            // This is a metadata folder row, append it to the table
            this.$el.append(dataItemView.render().el);

            // Render any delayed models if this is the parent
            if (_.contains(Object.keys(this.delayedModels), dataItemView.id)) {
              delayed_models = this.delayedModels[dataItemView.id];
              _.each(delayed_models, this.addOne, this);
            }
          } else {
            // Find the parent row by it's id, stored in a custom attribute
            if (scimetaParent)
              parentRow = this.$(`[data-id='${scimetaParent}']`);

            if (typeof parentRow !== "undefined" && parentRow.length) {
              // This is a data row, insert below it's metadata parent folder
              parentRow.after(dataItemView.render().el);

              // Remove it from the delayedModels list if necessary
              if (_.contains(Object.keys(this.delayedModels), scimetaParent)) {
                delayed_models = this.delayedModels[scimetaParent];
                const index = _.indexOf(delayed_models, item);
                delayed_models = delayed_models.splice(index, 1);

                // Put the shortened array back if delayed models remains
                if (delayed_models.length > 0) {
                  this.delayedModels[scimetaParent] = delayed_models;
                } else {
                  this.delayedModels[scimetaParent] = undefined;
                }
              }

              this.trigger("addOne");
            } else {
              console.warn(
                `Couldn't render ${item.id}. Delayed until parent is rendered.`,
              );
              // Postpone the data row until the parent is rendered
              delayed_models = this.delayedModels[scimetaParent];

              // Delay the model rendering if it isn't already delayed
              if (typeof delayed_models !== "undefined") {
                if (!_.contains(delayed_models, item)) {
                  delayed_models.push(item);
                  this.delayedModels[scimetaParent] = delayed_models;
                }
              } else {
                delayed_models = [];
                delayed_models.push(item);
                this.delayedModels[scimetaParent] = delayed_models;
              }
            }
          }
        } else {
          // This is a metadata folder row, append it to the table
          this.$el.append(dataItemView.render().el);

          this.trigger("addOne");
        }
      },

      /**
       * Render the Data Package View and insert it into this view
       */
      renderDataPackage() {
        const view = this;

        if (MetacatUI.rootDataPackage.packageModel.isNew()) {
          view.renderMember(this.model);
        }

        // As the root collection is updated with models, render the UI
        this.listenTo(MetacatUI.rootDataPackage, "add", function (model) {
          if (!model.get("synced") && model.get("id"))
            this.listenTo(model, "sync", view.renderMember);
          else if (model.get("synced")) view.renderMember(model);

          // Listen for changes on this member
          model.on("change:fileName", model.addToUploadQueue);
        });

        // Render the Data Package view
        this.dataPackageView = new DataPackageView({
          edit: true,
          dataPackage: MetacatUI.rootDataPackage,
          parentEditorView: this,
        });

        // Render the view
        const $packageTableContainer = this.$("#data-package-container");
        $packageTableContainer.html(this.dataPackageView.render().el);

        // Make the view resizable on the bottom
        const handle = $(document.createElement("div"))
          .addClass("ui-resizable-handle ui-resizable-s")
          .attr("title", "Drag to resize")
          .append(
            $(document.createElement("i")).addClass("icon icon-caret-down"),
          );
        $packageTableContainer.after(handle);
        $packageTableContainer.resizable({
          handles: { s: handle },
          minHeight: 100,
          maxHeight: 900,
          resize() {
            view.emlView.resizeTOC();
          },
        });

        const tableHeight = ($(window).height() - $("#Navbar").height()) * 0.4;
        $packageTableContainer.css("height", `${tableHeight}px`);

        const table = this.dataPackageView.$el;
        this.listenTo(this.dataPackageView, "addOne", function () {
          if (
            table.outerHeight() > $packageTableContainer.outerHeight() &&
            table.outerHeight() < 220
          ) {
            $packageTableContainer.css(
              "height",
              table.outerHeight() + handle.outerHeight(),
            );
            if (this.emlView) this.emlView.resizeTOC();
          }
        });

        if (this.emlView) this.emlView.resizeTOC();

        // Save the view as a subview
        this.subviews.push(this.dataPackageView);

        this.listenTo(
          MetacatUI.rootDataPackage.packageModel,
          "change:childPackages",
          this.renderChildren,
        );
      },

      /**
       * Add all rows to the DataPackageView
       */
      addAll() {
        this.$el.find("#data-package-table-body").html(""); // clear the table first
        this.dataPackage.sort();

        if (!this.edit) {
          const atLocationObj = this.dataPackage.getAtLocation();
          this.atLocationObj = atLocationObj;

          // form path to D1 object dictionary
          if (
            this.atLocationObj !== undefined &&
            !_.isEmpty(this.atLocationObj)
          ) {
            var filePathObj = new Object();

            this.dataPackage.each(function (item) {
              if (!Object.keys(this.atLocationObj).includes(item.id)) {
                this.atLocationObj[item.id] = "/";
              }
            }, this);

            for (const key of Object.keys(this.atLocationObj)) {
              const path = this.atLocationObj[key];
              const pathArray = path.split("/");
              pathArray.pop();
              const parentPath = pathArray.join("/");
              if (filePathObj.hasOwnProperty(parentPath)) {
                filePathObj[parentPath].push(key);
              } else {
                filePathObj[parentPath] = new Array();
                filePathObj[parentPath].push(key);
              }
            }
          }

          // add top level data package row to the package table
          let tableRow = null;
          const view = this;
          let title = this.packageTitle;
          let packageUrl = null;

          if (title === "") {
            const metadataObj = _.filter(
              this.dataPackage.models,
              (m) => m.get("id") == view.currentlyViewing,
            );

            if (metadataObj.length > 0) {
              title = metadataObj[0].get("title");
              const metaId = metadataObj[0].get("id");
              this.metaId = metaId;
            } else {
              title = this.dataPackage.get("id");
            }
          }

          const titleTooltip = title;
          title =
            title.length > 150
              ? `${title.slice(0, 75)}...${title.slice(
                  title.length - 75,
                  title.length,
                )}`
              : title;

          // set the package URL
          if (MetacatUI.appModel.get("packageServiceUrl"))
            packageUrl =
              MetacatUI.appModel.get("packageServiceUrl") +
              encodeURIComponent(view.dataPackage.id);

          const { disablePackageDownloads } = this;
          tableRow = this.dataPackageHeaderTemplate({
            id: view.dataPackage.id,
            title,
            titleTooltip,
            downloadUrl: packageUrl,
            disablePackageDownloads,
            disablePackageUrl: true,
          });

          this.$el.append(tableRow);

          if (this.atLocationObj !== undefined && filePathObj !== undefined) {
            // sort the filePath by length
            const sortedFilePathObj = Object.keys(filePathObj)
              .sort()
              .reduce((obj, key) => {
                obj[key] = filePathObj[key];
                return obj;
              }, {});
            this.sortedFilePathObj = sortedFilePathObj;

            this.addFilesAndFolders(sortedFilePathObj);
          } else {
            this.dataPackage.each(this.addOne, this, this.dataPackage);
          }
        } else {
          this.dataPackage.each(this.addOne, this);
        }
      },

      /**
       * Add all the files and folders
       * @param {object} sortedFilePathObj - An object where keys are folder paths and values are arrays of file IDs
       * @returns {boolean} - Returns false if the input object is not provided
       */
      addFilesAndFolders(sortedFilePathObj) {
        let dataItemView = null;
        let itemPath = null;

        // Return false if the input object is not provided
        if (!sortedFilePathObj) return false;

        // Initialize an object to map folder paths
        const pathMap = {};
        pathMap[""] = ""; // Root path

        // Iterate over each key (folder path) in the sortedFilePathObj
        Object.keys(sortedFilePathObj).forEach((key) => {
          // Split the folder path into an array of folder names
          const pathArray = key.split("/");
          let currentPath = "";

          // Iterate over each folder name in the pathArray
          pathArray.forEach((folderName, i) => {
            // Skip empty values
            if (folderName.length >= 1) {
              // Construct the current path
              currentPath = currentPath
                ? `${currentPath}/${folderName}`
                : folderName;

              // If the current path is not in pathMap, create a new folder
              if (!(currentPath in pathMap)) {
                // Determine the itemPath for the folder
                itemPath =
                  i === 0 ? "" : pathMap[pathArray.slice(0, i).join("/")];

                // Create a new DataItemView for the folder
                dataItemView = new DataItemView({
                  mode: this.mode,
                  itemName: folderName,
                  itemPath,
                  itemType: "folder",
                  parentEditorView: this.parentEditorView,
                  dataPackageId: this.dataPackage.id,
                });

                // Add the DataItemView to subviews and append it to the DOM
                this.subviews[currentPath] = dataItemView;
                this.$el.append(dataItemView.render().el);

                // Trigger an event to indicate a folder has been added
                this.trigger("addOne");

                // Update the pathMap with the new path
                pathMap[currentPath] = `${itemPath}/${folderName}`;
              }
            }
          });

          // Get the array of file IDs for the current folder
          const itemArray = sortedFilePathObj[key];

          // Add metadata object at the top of the file table if applicable
          if (
            key === "" &&
            this.metaId !== "undefined" &&
            itemArray.includes(this.metaId)
          ) {
            const item = this.metaId;
            this.addOne(this.dataPackage.get(item));
          }

          // Iterate over each file ID in the itemArray and add it to the view
          itemArray.forEach((item) => {
            this.addOne(this.dataPackage.get(item));
          });
        });

        return true;
      },

      /**
                Remove the subview represented by the given model item.
                @param item The model representing the sub view to be removed
       */
      removeOne(item) {
        if (_.contains(Object.keys(this.subviews), item.id)) {
          // Remove the view and the its reference in the subviews list
          this.subviews[item.id].remove();
          delete this.subviews[item.id];
        }
      },

      handleAddFiles(e) {
        // Pass this on to the DataItemView for the root data package
        this.$(".data-package-item.folder")
          .first()
          .data("view")
          .handleAddFiles(e);
      },

      /**
       * Renders a control that opens the AccessPolicyView for editing permissions on this package
       * @since 2.15.0
       */
      renderShareControl() {
        if (
          this.parentEditorView &&
          !this.parentEditorView.isAccessPolicyEditEnabled()
        ) {
          this.$("#data-package-table-share").remove();
        }
      },

      /**
       * Close subviews as needed
       */
      onClose() {
        // Close each subview
        _.each(
          Object.keys(this.subviews),
          function (id) {
            const subview = this.subviews[id];
            subview.onClose();
          },
          this,
        );

        // Reset the subviews from the view completely (by removing it from the prototype)
        this.__proto__.subviews = {};
      },

      /**
             Show or hide the data rows associated with the event row science metadata
       * @param event
       */
      toggleRows(event) {
        if (this.isOpen) {
          // Get the DataItemView associated with each id
          _.each(
            Object.keys(this.subviews),
            function (id) {
              const subview = this.subviews[id];

              if (subview.model.get("type") === "Data" && subview.remove) {
                // Remove the view from the DOM
                subview.remove();
                // And from the subviews list
                delete this.subviews[id];
              }
            },
            this,
          );

          // And then close the folder
          this.$el
            .find(".open")
            .removeClass("open")
            .addClass("closed")
            .removeClass("icon-chevron-down")
            .addClass("icon-chevron-right");

          this.$el
            .find(".icon-folder-open")
            .removeClass("icon-folder-open")
            .addClass("icon-folder-close");

          this.isOpen = false;
        } else {
          // Add sub rows to the view
          const dataModels = this.dataPackage.where({ type: "Data" });
          _.each(
            dataModels,
            function (model) {
              this.addOne(model);
            },
            this,
          );

          // And then open the folder
          this.$el
            .find(".closed")
            .removeClass("closed")
            .addClass("open")
            .removeClass("icon-folder-close")
            .addClass("icon-chevron-down");

          this.$el
            .find(".icon-folder-close")
            .removeClass("icon-folder-close")
            .addClass("icon-folder-open");

          this.isOpen = true;
        }

        event.stopPropagation();
        event.preventDefault();
      },

      /**
       * Expand function to show hidden rows when a user clicks on an expand control.
       * @param {Event} e - The event object.
       * @since 2.28.0
       */
      expand(e) {
        // Don't do anything...
        e.preventDefault();

        const view = this;
        const eventEl = $(e.target).parents("td");
        const rowEl = $(e.target).parents("tr");

        const parentId = rowEl.data("id");
        const children = `tr[data-parent='${parentId}']`;

        this.$(children).fadeIn();

        this.$(eventEl)
          .children()
          .children(".expand-control")
          .fadeOut(() => {
            view
              .$(eventEl)
              .children()
              .children(".collapse-control")
              .fadeIn("fast");
            view.$(".tooltip-this").tooltip();
          });

        this.$(children)
          .children()
          .children()
          .children(".collapse-control")
          .fadeOut(() => {
            view
              .$(children)
              .children()
              .children()
              .children(".expand-control")
              .fadeIn("fast");
          });
      },

      /**
       * Collapse function to hide rows when a user clicks on a collapse control.
       * @param {Event} e - The event object.
       * @since 2.28.0
       */
      collapse(e) {
        // Don't do anything...
        e.preventDefault();

        const view = this;
        const eventEl = $(e.target).parents("td");
        const rowEl = $(e.target).parents("tr");

        const parentId = rowEl.data("id");
        const children = `tr[data-parent^='${parentId}']`;
        this.$(children).fadeOut();

        this.$(eventEl)
          .children()
          .children(".collapse-control")
          .fadeOut(() => {
            view.$(eventEl).children().children(".expand-control").fadeIn();
            view.$(".tooltip-this").tooltip();
          });
      },

      /**
       * Expand all function to show all child rows when a user clicks on an expand-all control.
       * @param {Event} e - The event object.
       * @since 2.28.0
       */
      expandAll(e) {
        // Don't do anything...
        e.preventDefault();

        const view = this;
        const eventEl = $(e.target).parents("td");
        const rowEl = $(e.target).parents("tr");

        const parentId = rowEl.data("id");
        const children = `tr[data-packageid='${parentId}']`;

        this.$(children).fadeIn();

        this.$(eventEl)
          .children(".d1package-expand")
          .fadeOut(() => {
            view.$(eventEl).children(".d1package-collapse").fadeIn("fast");
            view.$(".tooltip-this").tooltip();
          });

        this.$(children)
          .children()
          .children()
          .children(".collapse-control")
          .fadeOut(() => {
            view
              .$(children)
              .children()
              .children()
              .children(".expand-control")
              .fadeIn("fast");
          });
      },

      /**
       * Collapse all function to hide all child rows when a user clicks on a collapse-all control.
       * @param {Event} e - The event object.
       * @since 2.28.0
       */
      collapseAll(e) {
        // Don't do anything...
        e.preventDefault();

        const view = this;
        const eventEl = $(e.target).parents("td");
        const rowEl = $(e.target).parents("tr");

        const parentId = rowEl.data("id");
        const children = `tr[data-packageid='${parentId}']`;

        this.$(children).each(function () {
          $(this).fadeOut();
          const childId = $(this).data("id");
          const grandchildren = `tr[data-parent^='${childId}']`;

          $(grandchildren).fadeOut();
        });

        this.$(eventEl)
          .children(".d1package-collapse")
          .fadeOut(() => {
            view.$(eventEl).children(".d1package-expand").fadeIn();
            view.$(".tooltip-this").tooltip();
          });
      },

      /**
       * Check for private members and disable download buttons if necessary.
       * @since 2.28.0
       */
      checkForPrivateMembers() {
        try {
          const packageModel = this.model;
          const packageCollection = this.dataPackage;

          if (!packageModel || !packageCollection) {
            return;
          }

          const numMembersFromSolr = packageModel.get("members").length;
          const numMembersFromRDF = packageCollection.length;

          if (numMembersFromRDF > numMembersFromSolr) {
            const downloadButtons = this.$(".btn.download");

            for (let i = 0; i < downloadButtons.length; i++) {
              const btn = downloadButtons[i];
              const downloadURL = $(btn).attr("href");

              if (
                downloadURL.indexOf(packageModel.get("id")) > -1 ||
                downloadURL.indexOf(
                  encodeURIComponent(packageModel.get("id")),
                ) > -1
              ) {
                $(btn)
                  .attr("disabled", "disabled")
                  .addClass("disabled")
                  .attr("href", "")
                  .tooltip({
                    trigger: "hover",
                    placement: "top",
                    delay: 500,
                    title:
                      "This dataset may contain private data, so each data file should be downloaded individually.",
                  });

                i = downloadButtons.length;
              }
            }
          }
        } catch (e) {
          console.error(e);
        }
      },

      /**
       * Retrieves and processes nested packages for the current package.
       * @since 2.28.0
       */
      getNestedPackages() {
        const nestedPackages = new Array();
        const nestedPackageIds = new Array();
        this.nestedPackages = nestedPackages;

        // get all the child packages for this resource map
        const childPackages = this.dataPackage.filter(
          (m) => m.get("formatType") === "RESOURCE",
        );

        // iterate over the list of child packages and add their members
        for (const ite in childPackages) {
          const childPkg = childPackages[ite];
          if (!nestedPackageIds.includes(childPkg.get("id"))) {
            const nestedPackage = new PackageModel();
            nestedPackage.set("id", childPkg.get("id"));
            nestedPackage.setURL();
            nestedPackage.getMembers();
            nestedPackages.push(nestedPackage);
            nestedPackageIds.push(childPkg.get("id"));

            this.listenToOnce(
              nestedPackage,
              "change:members",
              this.addNestedPackages,
              nestedPackage,
            );
          }
        }
      },

      /**
       * Adds a nested data package to the package table.
       * @param {object} dataPackage - The data package to be added.
       * @since 2.28.0
       */
      addNestedPackages(dataPackage) {
        /**
         * Generates the table row for the data package header.
         * @type {null|Element}
         */
        let tableRow = null;
        /**
         * Reference to the current view.
         * @type {object}
         */
        var view = this;
        /**
         * The title of the data package.
         * @type {null|string}
         */
        let title = null;
        /**
         * The URL of the data package.
         * @type {null|string}
         */
        let packageUrl = null;
        /**
         * The URL of the nested data package.
         * @type {null|string}
         */
        let nestedPackageUrl = null;

        /**
         * The members of the data package.
         * @type {Array}
         */
        let members = dataPackage.get("members");
        /**
         * Filters out metadata objects from the members.
         * @type {Array}
         */
        const metadataObj = _.filter(
          members,
          (m) => m.get("type") == "Metadata" || m.get("type") == "metadata",
        );

        title = metadataObj[0].get("title");

        /**
         * The tooltip for the title (used for long titles).
         * @type {string}
         */
        const titleTooltip = title;
        title =
          title.length > 150
            ? `${title.slice(0, 75)}...${title.slice(
                title.length - 75,
                title.length,
              )}`
            : title;

        // Set the package URL
        if (MetacatUI.appModel.get("packageServiceUrl"))
          packageUrl =
            MetacatUI.appModel.get("packageServiceUrl") +
            encodeURIComponent(dataPackage.id);

        // Set the nested package URL
        if (MetacatUI.root !== undefined && dataPackage.id !== undefined)
          nestedPackageUrl = `${MetacatUI.root}/view/${encodeURIComponent(dataPackage.id)}`;

        /**
         * The HTML content for the data package header.
         * @type {string}
         */
        tableRow = this.dataPackageHeaderTemplate({
          id: dataPackage.id,
          title,
          titleTooltip,
          disablePackageDownloads: false,
          downloadUrl: packageUrl,
          disablePackageUrl: false,
          packageUrl: nestedPackageUrl,
        });
        this.$el.append(tableRow);

        // Create an instance of DownloadButtonView to handle package downloads
        this.downloadButtonView = new DownloadButtonView({
          model: dataPackage,
          view: "actionsView",
          nested: true,
        });

        // Render
        this.downloadButtonView.render();

        // Add the downloadButtonView el to the span
        this.$el
          .find(`.downloadAction[data-id='${dataPackage.id}']`)
          .html(this.downloadButtonView.el);

        // Filter out the packages from the member list
        members = _.filter(members, (m) => m.type != "Package");

        // Add each member to the package table view
        var view = this;
        _.each(members, (m) => {
          // Update the size to bytes format
          m.set({ size: Utilities.bytesToSize(m.get("size")) });

          // Add each item of this nested package to the package table view
          view.addOne(m, dataPackage);
        });
      },

      /* showDownloadProgress: function(e){
                e.preventDefault();

                var button = $(e.target);
                button.addClass("in-progress");
                button.html("Downloading... <i class='icon icon-on-right icon-spinner icon-spin'></i>");

                return true;

            } */
    },
  );
  return DataPackageView;
});
