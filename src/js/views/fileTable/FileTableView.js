"use strict";

define([
  "backbone",
  "models/fileTable/FileTableViewModel",
  "views/fileTable/FileItemActionView",
  "views/fileTable/FileItemView",
  "views/fileTable/FileTableViewUtilities",
], (
  Backbone,
  FileTableViewModel,
  FileItemActionView,
  FileItemView,
  ViewUtilities,
) => {
  const { escapeHtml, setOptionalAttribute, TOOLTIP_SETTINGS } = ViewUtilities;
  const CLASS_NAMES = {
    actionPlaceholder: "empty-action",
    body: "data-package-file-table",
    buttonGroup: "btn-group",
    center: "center",
    disabled: "disabled",
    dropdown: "dropdown",
    dropdownMenu: "dropdown-menu",
    collapseControl: "d1package-collapse",
    editable: "editable",
    expandControl: "d1package-expand",
    fileHeader: "file-header",
    fileTitle: "fileTitle",
    filterButton: "btn data-package-filter-control",
    filterIcon: "icon icon-large icon-filter",
    message: "message",
    messageRow: "data-package-message-row",
    notice: "file-listing-note",
    noticeAction: "file-listing-note-action",
    noticeRow: "file-listing-note-row",
    open: "open",
    sortIcon: "icon icon-solid icon-arrow-up",
    subtle: "subtle",
    table: "table table-striped table-hover download-contents table-condensed",
    tableDisabled: "file-table-disabled",
    tableHeader: "table-header",
    tableHeaderTitle: "table-header-title",
  };
  const IDS = {
    actionsColumn: "data-package-table-actions",
    body: "data-package-table-body",
    buttonColumn: "data-package-table-button",
    fileColumn: "data-package-table-files",
    foot: "data-package-table-foot",
    filterControl: "data-package-filter-control",
    guideStatusColumn: "data-package-table-guide-status",
    head: "data-package-table-head",
    iconColumn: "data-package-table-icon",
    metricsColumn: "data-package-table-metrics",
    shareColumn: "data-package-table-share",
    sizeColumn: "data-package-table-size",
    table: "data-package-table",
    typeColumn: "data-package-table-type",
  };
  const MESSAGES = {
    filter: "Filter",
    filterUnavailable: "Package table filtering is not yet available",
  };
  const TOOLTIP_TIMER_KEYS = {
    show: "fileTableTooltipShowTimer",
    hide: "fileTableTooltipHideTimer",
  };

  const clearTooltipTimer = (target, key) => {
    const timer = target.data(key);
    if (!timer) return;
    clearTimeout(timer);
    target.removeData(key);
  };

  /**
   * @class FileTableView
   * @classdesc Generic file table view. It renders table state from a view
   * model and delegates row rendering to FileItemView
   * @classcategory Views/FileTable
   * @since 0.0.0
   * @screenshot views/fileTable/FileTableView.png
   * @augments Backbone.View
   */
  const FileTableView = Backbone.View.extend({
    tagName: "table",

    className: CLASS_NAMES.table,

    events: {
      [`click .${CLASS_NAMES.expandControl}`]: "expandRow",
      [`click .${CLASS_NAMES.collapseControl}`]: "collapseRow",
      "click [data-toggle='dropdown']": "blockDisabledInteraction",
      [`click .${CLASS_NAMES.dropdownMenu} a`]: "blockDisabledInteraction",
      [`click .${CLASS_NAMES.fileTitle}.${CLASS_NAMES.editable}`]:
        "blockDisabledInteraction",
      "mouseenter [data-tt-content], [data-tt-html]": "showLazyTooltip",
      "focusin [data-tt-content], [data-tt-html]": "showLazyTooltip",
      "mouseleave [data-tt-content], [data-tt-html]": "hideLazyTooltip",
      "focusout [data-tt-content], [data-tt-html]": "hideLazyTooltip",
      [`click .${CLASS_NAMES.noticeAction}`]: "handleNoticeAction",
    },

    /** @inheritdoc */
    initialize(options = {}) {
      this.viewModel =
        options.viewModel || options.model || new FileTableViewModel(options);
      this.model = this.viewModel;
      this.subviews = {};
      this.emptyActionView = null;
      this.isDisabled = options.disabled === true;

      this.listenTo(this.viewModel, "change", this.render);
      this.listenTo(this.viewModel, "rows:update", this.renderRows);
    },

    /**
     * Inline ES6 template for the table structure.
     * @param {object} data Render ready view model data
     * @returns {string} Table markup
     */
    template(data) {
      const subtitle = data.subtitle
        ? ` <span class="${CLASS_NAMES.subtle}">${escapeHtml(data.subtitle)}</span>`
        : "";
      const titleRow = data.showTitle
        ? `
          <tr class="${CLASS_NAMES.tableHeader}">
            <th colspan="${data.columnCount}" class="${CLASS_NAMES.tableHeader}">
              <span class="${CLASS_NAMES.tableHeaderTitle}">${escapeHtml(data.title)}</span>${subtitle}
            </th>
          </tr>
        `
        : "";
      const headerRow = data.showHeader ? this.headerTemplate(data) : "";
      const noticeRow = data.noticeMessage ? this.noticeTemplate(data) : "";
      const head =
        titleRow || headerRow
          ? `
          <thead id="${IDS.head}">
            ${titleRow}
            ${headerRow}
          </thead>
        `
          : "";
      const foot = noticeRow
        ? `
          <tfoot id="${IDS.foot}">
            ${noticeRow}
          </tfoot>
        `
        : "";

      return `
        ${head}
        <tbody
          id="${escapeHtml(data.bodyId || IDS.body)}"
          class="${CLASS_NAMES.body}"
        ></tbody>
        ${foot}
      `;
    },

    /**
     * Inline template for a quiet table level notice.
     * @param {object} data Render ready view model data
     * @returns {string} Notice row markup
     */
    noticeTemplate(data) {
      const icon = data.noticeIconClass
        ? `<i class="${escapeHtml(data.noticeIconClass)}" aria-hidden="true"></i>`
        : "";
      const action =
        data.noticeActionId && data.noticeActionLabel
          ? `
          <button
            type="button"
            class="${escapeHtml(
              `${CLASS_NAMES.noticeAction} ${data.noticeActionClassName || "btn"}`,
            )}"
            data-notice-action-id="${escapeHtml(data.noticeActionId)}"
          >
            ${escapeHtml(data.noticeActionLabel)}
          </button>
        `
          : "";

      return `
        <tr class="${CLASS_NAMES.noticeRow}">
          <td colspan="${data.columnCount}">
            <div class="${escapeHtml(
              data.noticeClassName || CLASS_NAMES.notice,
            )}" role="note">
              ${icon}
              <span>${escapeHtml(data.noticeMessage)}</span>
              ${action}
              <span class="file-listing-note-status" aria-live="polite"></span>
            </div>
          </td>
        </tr>
      `;
    },

    /**
     * Inline ES6 template for the column header row.
     * @param {object} data Render ready view model data
     * @returns {string} Header row markup
     */
    headerTemplate(data) {
      const sortIcon = data.showSortingControl
        ? ` <i class="${CLASS_NAMES.sortIcon}" aria-hidden="true"></i>`
        : "";
      const filterButton = data.showFilteringControl
        ? `
          <button
            type="button"
            class="${CLASS_NAMES.filterButton}"
            data-id="${escapeHtml(data.id)}"
            disabled
            title="${MESSAGES.filterUnavailable}"
          >
            <i class="${CLASS_NAMES.filterIcon}" aria-hidden="true"></i>
            ${MESSAGES.filter}
          </button>
        `
        : "";
      const iconHeader = data.showIconColumn
        ? `<th id="${IDS.iconColumn}"></th>`
        : "";
      const metricsHeader = data.showMetrics
        ? `<th id="${IDS.metricsColumn}" style="width:10%">${escapeHtml(
            data.metricsColumnLabel,
          )}${sortIcon}</th>`
        : "";
      const shareHeader = data.showShare
        ? `<th id="${IDS.shareColumn}">${escapeHtml(
            data.shareColumnLabel,
          )}</th>`
        : "";
      const statusHeader = data.showStatus
        ? `<th id="${IDS.guideStatusColumn}">${escapeHtml(
            data.statusColumnLabel,
          )}</th>`
        : "";
      const actionsHeader = data.showActions
        ? `<th id="${
            data.showIconColumn ? IDS.buttonColumn : IDS.actionsColumn
          }" ${
            data.showIconColumn ? "" : 'style="width:10%"'
          }>${escapeHtml(data.actionsColumnLabel)}</th>`
        : "";

      return `
        <tr class="${CLASS_NAMES.fileHeader}">
          ${iconHeader}
          <th id="${IDS.fileColumn}">
            ${escapeHtml(data.fileColumnLabel)}${sortIcon}${filterButton}
          </th>
          <th id="${IDS.sizeColumn}">
            ${escapeHtml(data.sizeColumnLabel)}${sortIcon}
          </th>
          <th id="${IDS.typeColumn}">
            ${escapeHtml(data.typeColumnLabel)}${sortIcon}
          </th>
          ${metricsHeader}
          ${shareHeader}
          ${statusHeader}
          ${actionsHeader}
        </tr>
      `;
    },

    /**
     * @inheritdoc
     * @returns {FileTableView} This view
     */
    render() {
      const data = this.viewModel.toRenderData();

      this.closeSubviews();
      this.closeEmptyAction();
      this.$el
        .attr("id", data.tableId || IDS.table)
        .attr("class", data.className || this.className)
        .html(this.template(data));

      setOptionalAttribute(this.$el, "data-id", data.id);
      setOptionalAttribute(this.$el, "data-collection-id", data.collectionId);

      this.renderRows();
      this.applyDisabledState();
      return this;
    },

    /**
     * Render the current row collection.
     * @returns {FileTableView} This view
     */
    renderRows() {
      const rows = this.viewModel.getRows();
      const body = this.$(`tbody.${CLASS_NAMES.body}`);

      if (!body.length) return this;

      this.closeSubviews();
      this.closeEmptyAction();
      body.empty();

      if (this.viewModel.get("isLoading")) {
        body.html(
          this.messageRowTemplate(this.viewModel.get("loadingMessage")),
        );
        this.applyDisabledState();
        return this;
      }

      if (!rows.length) {
        body.html(
          this.messageRowTemplate(
            this.viewModel.get("emptyMessage"),
            Boolean(this.viewModel.getEmptyAction()),
          ),
        );
        this.renderEmptyAction();
        this.applyDisabledState();
        return this;
      }

      rows.each((rowModel) => {
        const rowView = new FileItemView({ viewModel: rowModel });

        this.subviews[rowModel.cid] = rowView;
        this.listenTo(rowView, "action:click", this.handleActionClick);
        this.listenTo(rowView, "rename:commit", this.handleRenameCommit);
        this.listenTo(rowView, "files:drop", this.handleFilesDrop);
        body.append(rowView.render().el);
        this.listenTo(rowView, "renderComplete", this.handleRowRender);
      });

      this.applyDisabledState();
      return this;
    },

    /**
     * Disable or reenable every interactive element in the rendered table.
     * @param {boolean} disabled Whether the table should be disabled
     * @returns {FileTableView} This view
     */
    setDisabled(disabled) {
      const nextDisabled = disabled === true;
      if (this.isDisabled === nextDisabled) return this;
      this.isDisabled = nextDisabled;
      this.applyDisabledState();
      return this;
    },

    /** Apply the current disabled state to rendered controls */
    applyDisabledState() {
      this.$el
        .toggleClass(CLASS_NAMES.tableDisabled, this.isDisabled)
        .attr("aria-disabled", this.isDisabled ? "true" : "false");

      if (this.isDisabled) {
        this.closeDropdowns();
        this.destroyInitializedTooltips();
        this.disableInteractiveElements(this.$el);
        return;
      }

      this.$("[data-ft-disabled-by-table]")
        .not("[data-ft-was-disabled='true']")
        .prop("disabled", false)
        .removeAttr("aria-disabled");
      this.$("[data-ft-disabled-by-table]").removeAttr(
        "data-ft-disabled-by-table data-ft-was-disabled",
      );
      this.$("[data-ft-was-contenteditable]")
        .attr("contenteditable", "true")
        .removeAttr("data-ft-was-contenteditable");
      this.$(`.${CLASS_NAMES.dropdownMenu} a`)
        .removeClass(CLASS_NAMES.disabled)
        .removeAttr("aria-disabled");
    },

    /**
     * Disable interactive elements within a rendered table scope.
     * @param {jQuery} scope Rendered table or row element
     */
    disableInteractiveElements(scope) {
      const controls = scope.find("button, input, textarea, select");
      controls
        .filter(":disabled")
        .not("[data-ft-disabled-by-table]")
        .attr("data-ft-was-disabled", "true");
      controls
        .attr("data-ft-disabled-by-table", "true")
        .prop("disabled", true)
        .attr("aria-disabled", "true");
      scope
        .find("[contenteditable='true']")
        .attr("data-ft-was-contenteditable", "true")
        .attr("contenteditable", "false");
      scope
        .find(`.${CLASS_NAMES.dropdownMenu} a`)
        .addClass(CLASS_NAMES.disabled)
        .attr("aria-disabled", "true");
    },

    /**
     * Apply the disabled DOM state to a row that rerendered in place.
     * @param {FileItemView} rowView Rendered row view
     */
    handleRowRender(rowView) {
      if (this.isDisabled) {
        this.disableInteractiveElements(rowView.$el);
      }
    },

    /** Close any open Bootstrap dropdowns owned by the table */
    closeDropdowns() {
      this.$(
        `.${CLASS_NAMES.buttonGroup}.${CLASS_NAMES.open}, .${CLASS_NAMES.dropdown}.${CLASS_NAMES.open}`,
      ).removeClass(CLASS_NAMES.open);
      this.$("[data-toggle='dropdown']").attr("aria-expanded", "false");
      this.$(".dropdown-backdrop").remove();
    },

    /** Destroy lazily initialized tooltips owned by the table */
    destroyInitializedTooltips() {
      this.$("[data-tt-initialized]").each((_index, element) => {
        const target = Backbone.$(element);
        clearTooltipTimer(target, TOOLTIP_TIMER_KEYS.show);
        clearTooltipTimer(target, TOOLTIP_TIMER_KEYS.hide);
      });
      this.$("[data-tt-initialized]")
        .popup("destroy")
        .removeAttr("data-tt-initialized");
    },

    /**
     * Inline template for table messages.
     * @param {string} message Message to render
     * @param {boolean} showAction Whether to render an action placeholder
     * @returns {string} Message row markup
     */
    messageRowTemplate(message, showAction = false) {
      const action = showAction
        ? `<span class="${CLASS_NAMES.actionPlaceholder}"></span>`
        : "";
      return `
        <tr class="${CLASS_NAMES.messageRow}">
          <td colspan="${this.viewModel.getColumnCount()}" class="${CLASS_NAMES.center}">
            <span class="${CLASS_NAMES.message}">${escapeHtml(message)}</span>
            ${action}
          </td>
        </tr>
      `;
    },

    /** Render the configured empty state action */
    renderEmptyAction() {
      const actionModel = this.viewModel.getEmptyAction();
      if (!actionModel) return;

      this.emptyActionView = new FileItemActionView({
        viewModel: actionModel,
      });
      this.listenTo(
        this.emptyActionView,
        "action:click",
        this.handleEmptyActionClick,
      );
      this.$(`.${CLASS_NAMES.actionPlaceholder}`).append(
        this.emptyActionView.render().el,
      );
    },

    /**
     * Expand a row's immediate child rows.
     * @param {Event} event Click event
     */
    expandRow(event) {
      event.preventDefault();
      if (this.isDisabled) return;

      const rowModel = this.getEventRowModel(event);
      if (!rowModel) return;

      this.viewModel.expandRow(rowModel.get("id"));
      this.trigger("row:expand", rowModel, event);
    },

    /**
     * Collapse a row's descendant rows.
     * @param {Event} event Click event
     */
    collapseRow(event) {
      event.preventDefault();
      if (this.isDisabled) return;

      const rowModel = this.getEventRowModel(event);
      if (!rowModel) return;

      this.viewModel.collapseRow(rowModel.get("id"));
      this.trigger("row:collapse", rowModel, event);
    },

    /**
     * Get the row id associated with a delegated click.
     * @param {Event} event Click event
     * @returns {string} Row id
     */
    getEventRowId(event) {
      return this.$(event.currentTarget).closest("tr").attr("data-id") || "";
    },

    /**
     * Get the row model associated with a delegated click.
     * @param {Event} event Click event
     * @returns {FileItemViewModel|null} Row view model
     */
    getEventRowModel(event) {
      return this.viewModel.getRows().get(this.getEventRowId(event)) || null;
    },

    /**
     * Bubble row action events.
     * @param {FileItemViewModel} rowModel Row view model
     * @param {FileItemActionViewModel} actionModel Action view model
     * @param {Event} event Click event
     */
    handleActionClick(rowModel, actionModel, event) {
      if (this.isDisabled) return;
      this.closeDropdowns();
      this.trigger("action:click", rowModel, actionModel, event);
    },

    /**
     * Bubble table notice actions.
     * @param {Event} event Click event
     */
    handleNoticeAction(event) {
      event.preventDefault();
      if (this.isDisabled) return;

      const actionId = this.$(event.currentTarget).attr(
        "data-notice-action-id",
      );
      if (actionId) this.trigger("notice:action", actionId, this, event);
    },

    /**
     * Bubble proposed row labels.
     * @param {FileItemViewModel} rowModel Row view model
     * @param {string} proposedLabel Proposed label
     * @param {Event} event Rename event
     */
    handleRenameCommit(rowModel, proposedLabel, event) {
      if (this.isDisabled) return;
      this.trigger("rename:commit", rowModel, proposedLabel, event);
    },

    /**
     * Bubble dropped files.
     * @param {FileItemViewModel} rowModel Row view model
     * @param {FileList|Array} files Dropped files
     * @param {Event} event Drop event
     */
    handleFilesDrop(rowModel, files, event) {
      if (this.isDisabled) return;
      this.trigger("files:drop", rowModel, files, event);
    },

    /**
     * Stop DOM owned interactions, such as Bootstrap dropdowns, while disabled.
     * @param {Event} event Interaction event
     */
    blockDisabledInteraction(event) {
      if (!this.isDisabled) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },

    /**
     * Initialize and show a file table tooltip only after the user asks for it.
     * @param {Event} event Hover or focus event
     */
    showLazyTooltip(event) {
      if (this.isDisabled) return;
      const target = this.$(event.currentTarget);
      clearTooltipTimer(target, TOOLTIP_TIMER_KEYS.hide);
      if (!target.attr("data-tt-initialized")) {
        const html = target.attr("data-tt-html");
        const content = target.attr("data-tt-content");
        if (!html && !content) return;
        const tooltip = html ? { html } : { content };
        target
          .popup({
            ...TOOLTIP_SETTINGS,
            ...tooltip,
          })
          .attr("data-tt-initialized", "true");
      }
      if (target.data(TOOLTIP_TIMER_KEYS.show)) return;
      const showDelay = Number(TOOLTIP_SETTINGS.delay?.show) || 0;
      if (showDelay > 0) {
        const showTimer = setTimeout(() => {
          target.removeData(TOOLTIP_TIMER_KEYS.show);
          if (
            !this.isDisabled &&
            document.documentElement.contains(target[0]) &&
            target.attr("data-tt-initialized")
          ) {
            target.popup("show");
          }
        }, showDelay);
        target.data(TOOLTIP_TIMER_KEYS.show, showTimer);
        return;
      }
      target.popup("show");
    },

    /**
     * Hide a lazily initialized tooltip.
     * @param {Event} event Hover or focus event
     */
    hideLazyTooltip(event) {
      const target = this.$(event.currentTarget);
      clearTooltipTimer(target, TOOLTIP_TIMER_KEYS.show);
      if (!target.attr("data-tt-initialized")) return;
      if (target.data(TOOLTIP_TIMER_KEYS.hide)) return;
      const hideDelay = Number(TOOLTIP_SETTINGS.delay?.hide) || 0;
      if (hideDelay > 0) {
        const hideTimer = setTimeout(() => {
          target.removeData(TOOLTIP_TIMER_KEYS.hide);
          if (
            document.documentElement.contains(target[0]) &&
            target.attr("data-tt-initialized")
          ) {
            target.popup("hide");
          }
        }, hideDelay);
        target.data(TOOLTIP_TIMER_KEYS.hide, hideTimer);
        return;
      }
      target.popup("hide");
    },

    /**
     * Bubble the empty state action.
     * @param {FileItemActionViewModel} actionModel Action view model
     * @param {Event} event Click event
     */
    handleEmptyActionClick(actionModel, event) {
      this.trigger("empty-action:click", actionModel, event);
    },

    /** Close row subviews */
    closeSubviews() {
      Object.keys(this.subviews).forEach((id) => {
        const subview = this.subviews[id];
        this.stopListening(subview);
        subview.remove();
      });
      this.subviews = {};
    },

    /** Close the empty state action view */
    closeEmptyAction() {
      if (!this.emptyActionView) return;
      this.stopListening(this.emptyActionView);
      this.emptyActionView.remove();
      this.emptyActionView = null;
    },

    /**
     * Close subviews before removing this view.
     * @returns {FileTableView} This view
     */
    remove() {
      this.destroyInitializedTooltips();
      this.closeSubviews();
      this.closeEmptyAction();
      return Backbone.View.prototype.remove.call(this);
    },

    /** Close this view when the parent table view is closed. */
    onClose() {
      this.remove();
    },
  });

  return FileTableView;
});
