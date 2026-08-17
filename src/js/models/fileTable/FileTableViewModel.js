"use strict";

define([
  "backbone",
  "underscore",
  "models/fileTable/FileItemActionViewModel",
  "models/fileTable/FileItemViewModel",
], (Backbone, _, FileItemActionViewModel, FileItemViewModel) => {
  /**
   * @class FileItemCollection
   * @classdesc Collection of file table row view models
   * @classcategory Models/FileTable
   * @since 0.0.0
   * @augments Backbone.Collection
   */
  const FileItemCollection = Backbone.Collection.extend({
    model: FileItemViewModel,
  });

  /**
   * Convert row input to a collection of row view models.
   * @param {Backbone.Collection|object[]} rows Row data
   * @returns {Backbone.Collection} Row view model collection
   */
  function normalizeRows(rows) {
    if (rows instanceof FileItemCollection) return rows;
    if (rows instanceof Backbone.Collection) {
      return new FileItemCollection(rows.toJSON());
    }
    return new FileItemCollection(rows || []);
  }

  /**
   * @class FileTableViewModel
   * @classdesc Generic render state and hierarchy state for a file table
   * This model owns display only table state; it does not fetch, upload,
   * download, or search for files
   * @classcategory Models/FileTable
   * @since 0.0.0
   * @augments Backbone.Model
   */
  const FileTableViewModel = Backbone.Model.extend({
    /** @returns {object} Default file table state */
    defaults() {
      return {
        id: "",
        collectionId: "",
        title: "Files",
        subtitle: "",
        emptyMessage: "No files to display.",
        loadingMessage: "Loading files...",
        noticeMessage: "",
        noticeClassName: "file-listing-note",
        noticeIconClass: "icon icon-info-sign icon-on-left",
        noticeActionId: "",
        noticeActionLabel: "",
        noticeActionClassName: "btn",
        fileColumnLabel: "Files",
        sizeColumnLabel: "Size",
        typeColumnLabel: "Type",
        metricsColumnLabel: "Metrics",
        shareColumnLabel: "Share",
        statusColumnLabel: "Status",
        actionsColumnLabel: "Actions",
        className:
          "table table-striped table-hover download-contents table-condensed",
        bodyId: "",
        showIconColumn: false,
        showTitle: true,
        showHeader: true,
        showMetrics: false,
        showShare: false,
        showStatus: false,
        showActions: true,
        showFilteringControl: false,
        showSortingControl: false,
        isLoading: false,
        emptyAction: null,
        rows: new FileItemCollection(),
      };
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

      if (
        Object.prototype.hasOwnProperty.call(attributes, "emptyAction") &&
        attributes.emptyAction &&
        !(attributes.emptyAction instanceof FileItemActionViewModel)
      ) {
        attributes.emptyAction = new FileItemActionViewModel(
          attributes.emptyAction,
        );
      }

      return Backbone.Model.prototype.set.call(this, attributes, setOptions);
    },

    /** @inheritdoc */
    initialize(attributes = {}) {
      const rows = Object.prototype.hasOwnProperty.call(attributes, "rows")
        ? attributes.rows
        : this.get("rows");

      this.set(
        {
          bodyId: this.get("bodyId") || "data-package-table-body",
          rows: normalizeRows(rows),
        },
        { silent: true },
      );
      this.listenTo(
        this,
        "change:showMetrics change:showShare change:showStatus change:showActions",
        this.syncColumnState,
      );
      this.listenToRows();
    },

    /** @returns {Backbone.Collection} Row view models */
    getRows() {
      return this.get("rows");
    },

    /**
     * Replace all rows with new row state.
     * @param {Backbone.Collection|object[]} rows Row state
     * @param {object} [options] Backbone set/reset options
     * @returns {FileTableViewModel} This model
     */
    setRows(rows = [], options = {}) {
      const oldRows = this.getRows();
      const nextRows = normalizeRows(rows);

      if (oldRows) this.stopListening(oldRows);
      this.set("rows", nextRows, options);
      this.listenToRows();
      this.trigger("rows:update", this, nextRows, options);
      return this;
    },

    /**
     * Merge row data into the existing row collection without replacing the row
     * models that survive. Existing rows are updated in place, rows absent from
     * the update are removed, new rows are added, and the incoming order is
     * reimposed. Derived UI state (`hasChildren`, `isExpanded`, `isVisible`) is
     * preserved on surviving rows, so a refresh does not collapse open folders.
     *
     * An attribute only merge (same rows, same order) mutates only the changed
     * rows and does not trigger a `rows:update`, so the table is not rebuilt.
     * @param {Backbone.Collection|object[]} rows Row state
     * @param {object} [options] Backbone set options
     * @returns {FileTableViewModel} This model
     */
    mergeRows(rows = [], options = {}) {
      const currentRows = this.getRows();
      const nextRows = normalizeRows(rows);
      const preservedKeys = ["hasChildren", "isExpanded", "isVisible"];
      const comparable = (value) => (value?.toJSON ? value.toJSON() : value);

      const mergedRows = [];
      nextRows.each((nextRow) => {
        const currentRow = currentRows.get(nextRow.id);
        if (!currentRow) {
          mergedRows.push(nextRow.toJSON());
          return;
        }

        const changes = {};
        Object.entries(nextRow.toJSON()).forEach(([key, value]) => {
          if (preservedKeys.includes(key)) return;
          if (!_.isEqual(comparable(currentRow.get(key)), comparable(value))) {
            changes[key] = value;
          }
        });
        if (Object.keys(changes).length) currentRow.set(changes, options);
        this.applyTableStateToRow(currentRow);
        mergedRows.push(currentRow);
      });

      const hasStructuralChanges =
        currentRows.length !== mergedRows.length ||
        mergedRows.some((row) => !currentRows.get(row.id));
      const hasOrderChanges = mergedRows.some(
        (row, index) => row !== currentRows.at(index),
      );

      currentRows.set(mergedRows, { ...options, merge: false });
      if (!hasStructuralChanges && hasOrderChanges && !options.silent) {
        this.trigger("rows:update", this, currentRows);
      }

      return this;
    },

    /**
     * Reimpose an explicit row order (by id) on the row collection. Rows are
     * reordered in place and a single `sort` event is emitted only when the
     * order actually changes. Rows whose id is not listed (defensive) keep their
     * relative order at the end.
     * @param {string[]} orderedIds Row ids in the desired display order
     * @param {object} [options] Backbone event options
     * @returns {FileTableViewModel} This model
     */
    orderRows(orderedIds = [], options = {}) {
      const rows = this.getRows();
      if (rows.length < 2) return this;

      const rank = new Map(orderedIds.map((id, index) => [id, index]));
      const rankOf = (row) =>
        rank.has(row.id) ? rank.get(row.id) : Number.MAX_SAFE_INTEGER;

      const current = rows.models;
      const sorted = [...current].sort((a, b) => rankOf(a) - rankOf(b));
      if (sorted.every((row, index) => row === current[index])) return this;

      rows.models = sorted;
      if (!options.silent) {
        rows.trigger("sort", rows, options);
        this.trigger("rows:update", this, rows);
      }
      return this;
    },

    /**
     * Generic table update entry point.
     * @param {object} attributes Attributes to set on the view model
     * @param {object} [options] Backbone set/reset options
     * @returns {FileTableViewModel} This model
     */
    update(attributes = {}, options = {}) {
      const nextAttributes = { ...attributes };
      const hasRows = Object.prototype.hasOwnProperty.call(
        nextAttributes,
        "rows",
      );
      const { rows } = nextAttributes;

      if (hasRows) delete nextAttributes.rows;
      if (Object.keys(nextAttributes).length) this.set(nextAttributes, options);
      if (hasRows) this.setRows(rows, options);

      return this;
    },

    /**
     * Add one row.
     * @param {object|FileItemViewModel} row Row state
     * @param {object} [options] Backbone add options
     * @returns {FileItemViewModel} Added row
     */
    addRow(row, options = {}) {
      return this.getRows().add(row, options);
    },

    /**
     * Update one row by id.
     * @param {string} id Row id
     * @param {object} attributes Attributes to set
     * @param {object} [options] Backbone set options
     * @returns {FileItemViewModel|null} Updated row, if found
     */
    updateRow(id, attributes = {}, options = {}) {
      const row = this.getRows().get(id);
      if (!row) return null;
      row.update(attributes, options);
      return row;
    },

    /**
     * Remove one row by id.
     * @param {string} id Row id
     * @param {object} [options] Backbone remove options
     * @returns {FileItemViewModel|null} Removed row, if found
     */
    removeRow(id, options = {}) {
      const row = this.getRows().get(id);
      if (!row) return null;
      this.getRows().remove(row, options);
      return row;
    },

    /** Wire table level hierarchy state to row changes */
    listenToRows() {
      const rows = this.getRows();
      if (!rows) return;

      this.listenTo(rows, "update reset sort", this.refreshHierarchyState);
      this.listenTo(
        rows,
        "change:id change:parentId",
        this.refreshHierarchyState,
      );
      this.listenTo(rows, "change:isExpanded", (row, value, options = {}) => {
        if (!options.skipHierarchyRefresh) this.refreshHierarchyVisibility();
      });
      this.listenTo(rows, "update reset", () => {
        this.trigger("rows:update", this, rows);
      });
      this.listenTo(rows, "add", (row) => this.applyTableStateToRow(row));
      rows.each((row) => this.applyTableStateToRow(row));
      this.refreshHierarchyState();
    },

    /**
     * Apply table level display state to a row.
     * @param {FileItemViewModel} row Row view model
     * @param {object} [options] Backbone set options
     */
    applyTableStateToRow(row, options = {}) {
      const attrs = {};

      if (!row.has("collectionId") || !row.get("collectionId")) {
        attrs.collectionId = this.get("collectionId") || this.get("id");
      }
      attrs.showMetrics = this.get("showMetrics");
      attrs.showIconColumn = this.get("showIconColumn");
      attrs.showShare = this.get("showShare");
      attrs.showStatus = this.get("showStatus");
      attrs.showActions = this.get("showActions");

      row.set(attrs, options);
    },

    /** Keep every row aligned with the table's optional column state */
    syncColumnState() {
      this.getRows().each((row) => {
        this.applyTableStateToRow(row, { silent: true });
      });
    },

    /** Mark rows that have children so row views can render expand controls */
    refreshHierarchyState() {
      const rows = this.getRows();
      const childrenByParent = new Map();

      rows.each((row) => {
        const parentId = row.get("parentId");
        if (!parentId) return;
        if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
        childrenByParent.get(parentId).push(row);
      });

      rows.each((row) => {
        row.set("hasChildren", childrenByParent.has(row.get("id")));
      });
      this.refreshHierarchyVisibility(childrenByParent);
    },

    /**
     * Derive row visibility from ancestor expansion state.
     * @param {Map<string, FileItemViewModel[]>} [childrenByParent] Rows keyed
     * by parent id
     */
    refreshHierarchyVisibility(childrenByParent) {
      const rows = this.getRows();
      const childRowsByParent = childrenByParent || new Map();
      const visibilityByRow = new Map();

      if (!childrenByParent) {
        rows.each((row) => {
          const parentId = row.get("parentId");
          if (!parentId) return;
          if (!childRowsByParent.has(parentId)) {
            childRowsByParent.set(parentId, []);
          }
          childRowsByParent.get(parentId).push(row);
        });
      }

      const setVisibility = (row, isVisible) => {
        visibilityByRow.set(row, isVisible);
        const childrenVisible = isVisible && row.get("isExpanded");
        (childRowsByParent.get(row.get("id")) || []).forEach((child) => {
          setVisibility(child, childrenVisible);
        });
      };

      rows
        .filter((row) => !row.get("parentId"))
        .forEach((row) => setVisibility(row, true));
      rows.each((row) => {
        row.set("isVisible", visibilityByRow.get(row) === true);
      });
    },

    /**
     * Set expanded state for one row and update descendant visibility.
     * @param {string} id Row id
     * @param {boolean} isExpanded Whether the row is expanded
     * @returns {FileItemViewModel|null} Updated row, if found
     */
    setRowExpanded(id, isExpanded) {
      const row = this.getRows().get(id);
      if (!row) return null;

      row.set("isExpanded", Boolean(isExpanded), {
        skipHierarchyRefresh: true,
      });
      this.refreshHierarchyVisibility();
      return row;
    },

    /**
     * Expand one row.
     * @param {string} id Row id
     * @returns {FileItemViewModel|null} Updated row, if found
     */
    expandRow(id) {
      return this.setRowExpanded(id, true);
    },

    /**
     * Collapse one row.
     * @param {string} id Row id
     * @returns {FileItemViewModel|null} Updated row, if found
     */
    collapseRow(id) {
      return this.setRowExpanded(id, false);
    },

    /**
     * Expand all rows.
     * @returns {FileTableViewModel} This model
     */
    expandAll() {
      this.getRows().each((row) => {
        row.set("isExpanded", true, { skipHierarchyRefresh: true });
      });
      this.refreshHierarchyVisibility();
      return this;
    },

    /**
     * Collapse all container rows while keeping top level rows visible.
     * @returns {FileTableViewModel} This model
     */
    collapseAll() {
      this.getRows().each((row) => {
        row.set("isExpanded", false, { skipHierarchyRefresh: true });
      });
      this.refreshHierarchyVisibility();
      return this;
    },

    /**
     * Column count for message rows.
     * @returns {number} Number of rendered columns
     */
    getColumnCount() {
      return (
        3 +
        (this.get("showIconColumn") ? 1 : 0) +
        (this.get("showMetrics") ? 1 : 0) +
        (this.get("showShare") ? 1 : 0) +
        (this.get("showStatus") ? 1 : 0) +
        (this.get("showActions") ? 1 : 0)
      );
    },

    /** @returns {FileItemActionViewModel|null} Empty state action */
    getEmptyAction() {
      return this.get("emptyAction");
    },

    /**
     * Attributes consumed directly by the view.
     * @returns {object} Render ready attributes
     */
    toRenderData() {
      return {
        ...this.toJSON(),
        columnCount: this.getColumnCount(),
      };
    },
  });

  return FileTableViewModel;
});
