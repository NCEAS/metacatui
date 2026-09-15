"use strict";

define(["backbone", "models/fileTable/FileItemActionViewModel"], (
  Backbone,
  FileItemActionViewModel,
) => {
  /**
   * @class FileItemActionCollection
   * @classdesc Collection of file table action view models
   * @classcategory Models/FileTable
   * @since 0.0.0
   * @augments Backbone.Collection
   */
  const FileItemActionCollection = Backbone.Collection.extend({
    model: FileItemActionViewModel,
  });

  /**
   * Convert plain action state to an action collection.
   * @param {Backbone.Collection|object[]} actions Action state
   * @returns {Backbone.Collection} Action view model collection
   */
  function normalizeActions(actions) {
    if (actions instanceof FileItemActionCollection) return actions;
    if (actions instanceof Backbone.Collection) {
      return new FileItemActionCollection(actions.toJSON());
    }
    return new FileItemActionCollection(actions || []);
  }

  /**
   * @class FileItemViewModel
   * @classdesc Generic render state for one row in a file table. Source specific
   * models can update this model later, but this model does not know about
   * those sources
   * @classcategory Models/FileTable
   * @since 0.0.0
   * @augments Backbone.Model
   */
  const FileItemViewModel = Backbone.Model.extend({
    /** @returns {object} Default file row state */
    defaults() {
      return {
        id: "",
        collectionId: "",
        parentId: "",
        label: "",
        title: "",
        name: "",
        titleTooltip: "",
        kind: "file",
        iconClass: "icon-file",
        className: "",
        level: 0,
        size: "",
        sizeLabel: "",
        typeLabel: "",
        metricLabel: "",
        metricTitle: "",
        metricIconClass: "icon-cloud-download",
        actions: new FileItemActionCollection(),
        shareAction: null,
        status: null,
        isContainer: false,
        isExpandable: false,
        hasChildren: false,
        isExpanded: true,
        isVisible: true,
        isRenamable: false,
        acceptsFiles: false,
        showIconColumn: false,
        showMetrics: false,
        showShare: false,
        showStatus: false,
        showActions: true,
      };
    },

    /** @inheritdoc */
    initialize() {
      this.listenTo(this, "change:actions", this.listenToActions);
      this.listenToActions();
    },

    /**
     * Normalize nested view model attributes.
     * @inheritdoc
     */
    set(key, value, options) {
      let attributes = key;
      let setOptions = options;

      if (key == null) return this;

      if (typeof key === "string") {
        attributes = { [key]: value };
      } else {
        setOptions = value;
        attributes = { ...key };
      }

      if (Object.prototype.hasOwnProperty.call(attributes, "actions")) {
        attributes.actions = normalizeActions(attributes.actions);
      }
      if (
        Object.prototype.hasOwnProperty.call(attributes, "shareAction") &&
        attributes.shareAction &&
        !(attributes.shareAction instanceof FileItemActionViewModel)
      ) {
        attributes.shareAction = new FileItemActionViewModel(
          attributes.shareAction,
        );
      }

      return Backbone.Model.prototype.set.call(this, attributes, setOptions);
    },

    /**
     * Update render attributes without making assumptions about their source.
     * @param {object} attributes Attributes to set on the view model
     * @param {object} [options] Backbone set options
     * @returns {FileItemViewModel} This model
     */
    update(attributes = {}, options = {}) {
      this.set(attributes, options);
      return this;
    },

    /** Forward nested action updates so row views can render them */
    listenToActions() {
      if (this.actionCollection) this.stopListening(this.actionCollection);
      this.actionCollection = this.getActions();
      this.listenTo(
        this.actionCollection,
        "add remove reset sort change",
        this.triggerActionsUpdate,
      );
    },

    /** Trigger a row level action update event */
    triggerActionsUpdate() {
      this.trigger("actions:update", this, this.getActions());
    },

    /** @returns {Backbone.Collection} Row action view models */
    getActions() {
      return this.get("actions");
    },

    /** @returns {FileItemActionViewModel|null} Share action view model */
    getShareAction() {
      return this.get("shareAction");
    },

    /**
     * Label to render in the file name column.
     * @returns {string} Best available label
     */
    getDisplayLabel() {
      return (
        this.get("label") ||
        this.get("title") ||
        this.get("name") ||
        this.get("id") ||
        "Untitled"
      );
    },

    /**
     * Tooltip text for the display label.
     * @returns {string} Tooltip text
     */
    getTitleTooltip() {
      return this.get("titleTooltip") || this.getDisplayLabel();
    },

    /**
     * Attributes consumed directly by the view.
     * @returns {object} Render ready attributes
     */
    toRenderData() {
      const sizeLabel = this.get("sizeLabel") || this.get("size") || "";
      const label = this.getDisplayLabel();

      return {
        ...this.toJSON(),
        label,
        sizeLabel,
        titleTooltip: this.getTitleTooltip(),
        actions: this.getActions(),
        shareAction: this.getShareAction(),
      };
    },
  });

  return FileItemViewModel;
});
