"use strict";

define([
  "backbone",
  "models/fileTable/FileItemActionViewModel",
  "models/fileTable/FileItemViewModel",
  "views/fileTable/FileItemActionView",
  "views/fileTable/FileTableViewUtilities",
  "semantic",
], (
  Backbone,
  FileItemActionViewModel,
  FileItemViewModel,
  FileItemActionView,
  ViewUtilities,
) => {
  const INDENT_SIZE = 30;
  const CONTAINER_INDENT_OFFSET = 10;
  const FILE_INDENT_OFFSET = 0;
  const { classNames, escapeHtml, setOptionalAttribute } = ViewUtilities;
  const CLASS_NAMES = {
    actionCell: "controls file-actions",
    bar: "bar",
    badge: "badge",
    button: "btn",
    buttonGroup: "btn-group",
    canRename: "canRename",
    caret: "caret",
    collapseControl: "d1package-collapse",
    control: "control",
    data: "data",
    dropTarget: "data-package-drop-target",
    dropdownMenu: "dropdown-menu",
    dropdownToggle: "dropdown-toggle",
    disabled: "disabled",
    droppable: "droppable",
    editable: "editable",
    expandControl: "d1package-expand",
    file: "file",
    fileActions: "file-actions",
    fileHeader: "file-header",
    fileTitle: "fileTitle",
    folder: "folder",
    hidden: "hidden",
    iconCaretDown: "icon icon-caret-down",
    iconCaretRight: "icon icon-caret-right",
    iconFile: "icon-large icon-file",
    iconFolderOpen: "icon-large icon-folder-open",
    loading: "loading",
    metricIcon: "catalog-metric-icon",
    metricsCell: "metrics-count downloads",
    name: "name",
    progress: "progress progress-striped active",
    removePreview: "remove-preview",
    shareCell: "sharing",
    sizeCell: "size",
    statusCell: "status",
    statusContent: "status-content",
    tooltipHint: "file-tooltip-hint",
    tooltipName: "file-tooltip-name",
    tooltipPid: "file-tooltip-pid",
    typeCell: "type",
    typeIconCell: "type-icon",
    view: "data-package-item",
  };
  const MESSAGES = {
    collapse(label) {
      return `Collapse ${label}`;
    },
    expand(label) {
      return `Expand ${label}`;
    },
    moreActions: "More actions",
    pidLabel: "PID",
    renameHint: "Click to rename",
  };

  /**
   * @class FileItemView
   * @classdesc Generic file table row view. It renders view model state and
   * emits UI events; it does not fetch, upload, download, or mutate files
   * @classcategory Views/FileTable
   * @since 0.0.0
   * @screenshot views/fileTable/FileItemView.png
   * @augments Backbone.View
   */
  const FileItemView = Backbone.View.extend({
    /** @inheritdoc */
    tagName: "tr",

    /** @inheritdoc */
    className: CLASS_NAMES.view,

    /** @inheritdoc */
    events: {
      [`focusout .${CLASS_NAMES.fileTitle}[contenteditable=true]`]:
        "commitRename",
      [`keydown .${CLASS_NAMES.fileTitle}[contenteditable=true]`]:
        "handleRenameKeydown",
      [`click .${CLASS_NAMES.buttonGroup} [data-action-id]`]:
        "handleMenuActionClick",
      "mouseenter [data-action-id='remove'], [data-id='remove']":
        "showRemovePreview",
      "mouseleave [data-action-id='remove'], [data-id='remove']":
        "hideRemovePreview",
      dragenter: "showDropTarget",
      dragover: "showDropTarget",
      dragleave: "hideDropTarget",
      drop: "handleFilesDrop",
    },

    /** @inheritdoc */
    initialize(options = {}) {
      this.viewModel =
        options.viewModel || options.model || new FileItemViewModel(options);
      this.model = this.viewModel;
      this.actionViews = [];
      this.shareActionView = null;
      this.skipRenameBlur = false;
      this.listenTo(this.viewModel, "change", this.handleModelChange);
      this.listenTo(this.viewModel, "change:isVisible", this.toggleVisibility);
      this.listenTo(this.viewModel, "actions:update", this.render);
    },

    /**
     * Inline ES6 template for the row contents.
     * @param {object} data Render ready view model data
     * @returns {string} Row cells
     */
    template(data) {
      const iconCell = data.showIconColumn ? this.typeIconTemplate(data) : "";
      const metricsCell = data.showMetrics ? this.metricsTemplate(data) : "";
      const shareCell = data.showShare ? this.shareTemplate() : "";
      const statusCell = data.showStatus ? this.statusTemplate(data) : "";
      const actionsCell = data.showActions ? this.actionsTemplate() : "";
      const nameClass = classNames([
        data.showIconColumn || data.isRenamable ? CLASS_NAMES.name : "",
        data.isRenamable ? CLASS_NAMES.canRename : "",
      ]);

      return `
        ${iconCell}
        <td class="${nameClass}">
          ${this.nameTemplate(data)}
        </td>
        <td class="${CLASS_NAMES.sizeCell}">${escapeHtml(data.sizeLabel)}</td>
        <td class="${CLASS_NAMES.typeCell}"${
          data.typeTooltip
            ? ` data-tt-content="${escapeHtml(data.typeTooltip)}"`
            : ""
        }>${escapeHtml(data.typeLabel)}</td>
        ${metricsCell}
        ${shareCell}
        ${statusCell}
        ${actionsCell}
      `;
    },

    /**
     * Inline template for the row name.
     * @param {object} data Render ready view model data
     * @returns {string} File name markup
     */
    nameTemplate(data) {
      const tooltipHtml = this.nameTooltipHtml(data);
      const tooltipAttr = tooltipHtml
        ? ` data-tt-html="${escapeHtml(tooltipHtml)}"`
        : "";

      if (data.showIconColumn) {
        return `
          <div
            class="${classNames([
              CLASS_NAMES.fileTitle,
              data.isRenamable ? CLASS_NAMES.editable : "",
            ])}"
            contenteditable="${data.isRenamable ? "true" : "false"}"
            ${tooltipAttr}
          >${escapeHtml(data.label)}</div>
        `;
      }

      const offset = data.isContainer
        ? CONTAINER_INDENT_OFFSET
        : FILE_INDENT_OFFSET;
      const indent =
        Math.max(Number(data.level) || 0, 0) * INDENT_SIZE + offset;
      const isExpandable = data.hasChildren || data.isExpandable;
      const control = isExpandable ? this.expandControlTemplate(data) : "";
      let iconControlClass = "";
      if (isExpandable) {
        iconControlClass = data.isExpanded
          ? CLASS_NAMES.collapseControl
          : CLASS_NAMES.expandControl;
      }
      const iconClass = data.iconClass
        ? classNames([
            data.iconClass,
            iconControlClass,
            isExpandable ? CLASS_NAMES.control : "",
          ])
        : "";
      const icon = iconClass ? `<i class="${escapeHtml(iconClass)}"></i>` : "";
      const fileTitleClass = classNames([
        CLASS_NAMES.fileTitle,
        data.isRenamable ? CLASS_NAMES.editable : "",
      ]);

      return `
        <span style="padding-left:${indent}px">
          ${control}
          ${icon}
        </span>
        <span
          class="${fileTitleClass}"
          contenteditable="${data.isRenamable ? "true" : "false"}"
          ${tooltipAttr}
        >${escapeHtml(data.label)}</span>
      `;
    },

    /**
     * Inline template for the editor icon column.
     * @param {object} data Render ready view model data
     * @returns {string} Icon cell
     */
    typeIconTemplate(data) {
      const isExpandable = data.hasChildren || data.isExpandable;
      const control = isExpandable ? this.expandControlTemplate(data) : "";
      const iconClass =
        data.iconClass ||
        (data.isContainer ? CLASS_NAMES.iconFolderOpen : CLASS_NAMES.iconFile);
      let iconControlClass = "";
      if (isExpandable) {
        iconControlClass = data.isExpanded
          ? CLASS_NAMES.collapseControl
          : CLASS_NAMES.expandControl;
      }
      const offset = data.isContainer
        ? CONTAINER_INDENT_OFFSET
        : FILE_INDENT_OFFSET;
      const indent =
        Math.max(Number(data.level) || 0, 0) * INDENT_SIZE + offset;
      const indentStyle = indent ? ` style="padding-left:${indent}px"` : "";

      return `
        <td class="${CLASS_NAMES.typeIconCell}">
          <span${indentStyle}>
            ${control}
            <i class="${escapeHtml(
              classNames([
                iconClass,
                iconControlClass,
                isExpandable ? CLASS_NAMES.control : "",
              ]),
            )}"></i>
          </span>
        </td>
      `;
    },

    /**
     * Inline template for expand/collapse controls.
     * @param {object} data Render ready view model data
     * @returns {string} Expand/collapse controls
     */
    expandControlTemplate(data) {
      const expandStyle = data.isExpanded ? ' style="display:none"' : "";
      const collapseStyle = data.isExpanded ? "" : ' style="display:none"';

      return `
        <a
          class="${CLASS_NAMES.expandControl} ${CLASS_NAMES.control}"
          href="#"
          aria-label="${escapeHtml(MESSAGES.expand(data.label))}"
          ${expandStyle}
        ><i class="${CLASS_NAMES.iconCaretRight}"></i></a>
        <a
          class="${CLASS_NAMES.collapseControl} ${CLASS_NAMES.control}"
          href="#"
          aria-label="${escapeHtml(MESSAGES.collapse(data.label))}"
          ${collapseStyle}
        ><i class="${CLASS_NAMES.iconCaretDown}"></i></a>
      `;
    },

    /**
     * Inline template for the metrics cell.
     * @param {object} data Render ready view model data
     * @returns {string} Metrics cell
     */
    metricsTemplate(data) {
      const metric = data.metricLabel
        ? `
          <span
            class="${CLASS_NAMES.badge}"
            data-tt-content="${escapeHtml(data.metricTitle)}"
          >
            <i class="${CLASS_NAMES.metricIcon} ${escapeHtml(
              data.metricIconClass,
            )}"></i>
            ${escapeHtml(data.metricLabel)}
          </span>
        `
        : "";

      return `
        <td class="${CLASS_NAMES.metricsCell}" data-id="${escapeHtml(data.id)}">
          ${metric}
        </td>
      `;
    },

    /**
     * Inline template for the status cell.
     * @param {object} data Render ready view model data
     * @returns {string} Status cell
     */
    statusTemplate(data) {
      const status = data.status || {};
      const statusClass = classNames([
        CLASS_NAMES.statusContent,
        status.className,
      ]);
      const isProgressStatus = Number.isFinite(status.progress);
      const tooltip = status.title
        ? ` data-tt-content="${escapeHtml(status.title)}"`
        : "";
      const icon =
        !isProgressStatus && status.iconClass
          ? `<i class="${escapeHtml(status.iconClass)}"></i>`
          : "";
      const label =
        !isProgressStatus && status.label
          ? `<span>${escapeHtml(status.label)}</span>`
          : "";
      const progress = isProgressStatus
        ? `
          <div class="${CLASS_NAMES.progress}">
            <div
              class="${CLASS_NAMES.bar}"
              style="width:${Math.max(0, Math.min(100, status.progress))}%"
            ></div>
          </div>
        `
        : "";

      return `
        <td class="${CLASS_NAMES.statusCell}">
          <div class="${escapeHtml(statusClass)}"${tooltip}>
            ${icon}
            ${label}
            ${progress}
          </div>
        </td>
      `;
    },

    /** @returns {string} Actions cell placeholder */
    actionsTemplate() {
      return `<td class="${CLASS_NAMES.actionCell}"></td>`;
    },

    /** @returns {string} Share cell placeholder */
    shareTemplate() {
      return `<td class="${CLASS_NAMES.shareCell}"></td>`;
    },

    /**
     * @inheritdoc
     * @returns {FileItemView} This view
     */
    render() {
      const data = this.viewModel.toRenderData();

      this.closeActionViews();
      this.closeShareActionView();
      this.destroyTooltips();
      this.$el
        .attr("class", this.getRowClassName(data))
        .toggle(Boolean(data.isVisible))
        .html(this.template(data));

      setOptionalAttribute(this.$el, "data-id", data.id);
      setOptionalAttribute(this.$el, "data-parent-id", data.parentId);
      setOptionalAttribute(this.$el, "data-collection-id", data.collectionId);
      setOptionalAttribute(
        this.$el,
        "data-category",
        data.id ? `entities-${data.id}` : "",
      );
      setOptionalAttribute(this.$el, "data-packageid", data.collectionId);

      this.$el.data({
        view: this,
        viewModel: this.viewModel,
      });

      this.renderShareAction(data);
      this.renderActions(data);
      this.trigger("renderComplete", this);
      return this;
    },

    /**
     * Refresh row markup unless only row visibility changed.
     * @returns {FileItemView} This view
     */
    handleModelChange() {
      const changedKeys = Object.keys(this.viewModel.changedAttributes() || {});
      if (changedKeys.length === 1 && changedKeys[0] === "isVisible") {
        return this;
      }
      return this.render();
    },

    /**
     * Show or hide this row without rebuilding its cells.
     * @returns {FileItemView} This view
     */
    toggleVisibility() {
      this.$el.toggle(Boolean(this.viewModel.get("isVisible")));
      return this;
    },

    /** Preview the row that will be removed */
    showRemovePreview() {
      this.$el.addClass(CLASS_NAMES.removePreview);
    },

    /** Clear the row removal preview */
    hideRemovePreview() {
      this.$el.removeClass(CLASS_NAMES.removePreview);
    },

    /**
     * HTML for the file name tooltip: the full display name and, when known,
     * the object PID (plus a rename hint for editable rows).
     * @param {object} data Render ready view model data
     * @returns {string} Tooltip HTML, or "" when there is no name
     */
    nameTooltipHtml(data) {
      const name = escapeHtml(data.titleTooltip || data.label || "");
      if (!name) return "";
      const pid = data.pid
        ? `<div class="${CLASS_NAMES.tooltipPid}">${MESSAGES.pidLabel}: ${escapeHtml(data.pid)}</div>`
        : "";
      const rename = data.isRenamable
        ? `<div class="${CLASS_NAMES.tooltipHint}">${MESSAGES.renameHint}</div>`
        : "";
      return `<div class="${CLASS_NAMES.tooltipName}">${name}</div>${pid}${rename}`;
    },

    /** Destroy any Fomantic popups attached to this row's controls */
    destroyTooltips() {
      this.$("[data-tt-initialized]")
        .popup("destroy")
        .removeAttr("data-tt-initialized");
    },

    /**
     * CSS classes for the row element.
     * @param {object} data Render ready view model data
     * @returns {string} Class string
     */
    getRowClassName(data) {
      const isProgressStatus = Number.isFinite(data.status?.progress);
      return classNames([
        data.isContainer && data.level === 0 ? CLASS_NAMES.fileHeader : "",
        CLASS_NAMES.view,
        data.isContainer ? CLASS_NAMES.folder : CLASS_NAMES.file,
        data.isContainer ? "" : CLASS_NAMES.data,
        isProgressStatus ? CLASS_NAMES.loading : "",
        data.className,
      ]);
    },

    /**
     * Render the optional share action.
     * @param {object} data Render ready view model data
     */
    renderShareAction(data) {
      if (!data.showShare || !data.shareAction) return;

      this.shareActionView = new FileItemActionView({
        viewModel: data.shareAction,
      });
      this.listenTo(
        this.shareActionView,
        "action:click",
        this.handleActionClick,
      );
      this.$(`.${CLASS_NAMES.shareCell}`).append(
        this.shareActionView.render().el,
      );
    },

    /**
     * Render configured row actions.
     * @param {object} data Render ready view model data
     */
    renderActions(data) {
      if (!data.showActions) return;

      const container = this.$(
        `.${CLASS_NAMES.actionCell.split(" ").join(", .")}`,
      ).first();
      data.actions.each((actionModel) => {
        if (actionModel.get("menuItems")) {
          container.append(this.actionMenuTemplate(actionModel));
          return;
        }

        const actionView = new FileItemActionView({ viewModel: actionModel });

        this.actionViews.push(actionView);
        this.listenTo(actionView, "action:click", this.handleActionClick);
        container.append(actionView.render().el);
      });
    },

    /**
     * Render a primary action with a dropdown menu of related actions.
     * @param {FileItemActionViewModel} actionModel Primary action
     * @returns {string} Action menu markup
     */
    actionMenuTemplate(actionModel) {
      const data = actionModel.toRenderData();
      const menuItems = data.menuItems || [];
      const items = menuItems
        .map((item) => {
          const itemClass = classNames([
            item.isVisible === false ? CLASS_NAMES.hidden : "",
            item.isDisabled ? CLASS_NAMES.disabled : "",
          ]);
          const itemAriaDisabled = item.isDisabled
            ? ' aria-disabled="true"'
            : "";
          return `
            <li>
              <a
                href="#"
                class="${itemClass}"
                data-action-id="${escapeHtml(item.id)}"
                data-tt-content="${escapeHtml(item.title || item.label)}"
                ${itemAriaDisabled}
              >${escapeHtml(item.label)}</a>
            </li>
          `;
        })
        .join("");
      const groupClass = classNames([
        CLASS_NAMES.buttonGroup,
        data.isVisible ? "" : CLASS_NAMES.hidden,
      ]);
      const disabled = data.isDisabled ? ' disabled aria-disabled="true"' : "";

      return `
        <div
          class="${groupClass}"
          data-root-action-id="${escapeHtml(data.id)}"
        >
          <button
            type="button"
            class="${escapeHtml(data.className)}"
            data-action-id="${escapeHtml(data.id)}"
            data-tt-content="${escapeHtml(data.title)}"
            aria-label="${escapeHtml(data.ariaLabel)}"
            ${disabled}
          >${escapeHtml(data.label)}</button>
          <button
            type="button"
            class="${CLASS_NAMES.button} ${CLASS_NAMES.dropdownToggle}"
            data-toggle="dropdown"
            data-tt-content="${MESSAGES.moreActions}"
            aria-label="${MESSAGES.moreActions}"
            ${disabled}
          ><span class="${CLASS_NAMES.caret}"></span></button>
          <ul class="${CLASS_NAMES.dropdownMenu}" role="menu">
            ${items}
          </ul>
        </div>
      `;
    },

    /**
     * Emit action clicks from a grouped action menu.
     * @param {Event} event Click event
     * @returns {boolean} False to stop native link/button behavior
     */
    handleMenuActionClick(event) {
      event.preventDefault();
      event.stopPropagation();

      const actionId = this.$(event.currentTarget).attr("data-action-id");
      const rootId = this.$(event.currentTarget)
        .closest(`.${CLASS_NAMES.buttonGroup}`)
        .attr("data-root-action-id");
      const rootAction = this.viewModel.getActions().findWhere({ id: rootId });
      const actionData = this.getMenuActionData(rootAction, actionId);

      if (
        !rootAction?.isEnabled() ||
        !actionData ||
        actionData.isVisible === false ||
        actionData.isDisabled
      ) {
        return false;
      }

      this.handleActionClick(new FileItemActionViewModel(actionData), event);
      return false;
    },

    /**
     * Find the action descriptor represented by a grouped action click.
     * @param {FileItemActionViewModel} rootAction Root grouped action
     * @param {string} actionId Requested action id
     * @returns {object|null} Action state
     */
    getMenuActionData(rootAction, actionId) {
      if (!rootAction || !actionId) return null;
      const rootData = rootAction.toJSON();
      if (rootData.id === actionId) return rootData;
      return (
        (rootData.menuItems || []).find((item) => item.id === actionId) || null
      );
    },

    /**
     * Bubble action clicks to the table view.
     * @param {FileItemActionViewModel} actionModel Action view model
     * @param {Event} event Click event
     */
    handleActionClick(actionModel, event) {
      this.trigger("action:click", this.viewModel, actionModel, event);
    },

    /**
     * Emit a proposed label after inline editing.
     * @param {Event} event Focusout event
     */
    commitRename(event) {
      if (this.skipRenameBlur) {
        this.skipRenameBlur = false;
        return;
      }

      const proposedLabel = this.$(event.currentTarget).text();
      if (proposedLabel !== this.viewModel.getDisplayLabel()) {
        this.trigger("rename:commit", this.viewModel, proposedLabel, event);
      }
    },

    /**
     * Commit or cancel inline editing keyboard actions.
     * @param {Event} event Keyboard event
     */
    handleRenameKeydown(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        const proposedLabel = this.$(event.currentTarget).text();
        this.skipRenameBlur = true;
        event.currentTarget.blur();
        this.skipRenameBlur = false;
        if (proposedLabel !== this.viewModel.getDisplayLabel()) {
          this.trigger("rename:commit", this.viewModel, proposedLabel, event);
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.$(event.currentTarget).text(this.viewModel.getDisplayLabel());
        this.skipRenameBlur = true;
        event.currentTarget.blur();
        this.skipRenameBlur = false;
      }
    },

    /**
     * Show drag over styling when this row accepts files.
     * @param {Event} event Drag event
     */
    showDropTarget(event) {
      if (!this.viewModel.get("acceptsFiles")) return;
      event.preventDefault();
      event.stopPropagation();
      this.$el.addClass(`${CLASS_NAMES.droppable} ${CLASS_NAMES.dropTarget}`);
    },

    /**
     * Remove drag over styling when the pointer leaves this row.
     * @param {Event} event Drag event
     */
    hideDropTarget(event) {
      if (!this.viewModel.get("acceptsFiles")) return;
      const { relatedTarget } = event;
      if (relatedTarget && this.el.contains(relatedTarget)) return;
      this.$el.removeClass(
        `${CLASS_NAMES.droppable} ${CLASS_NAMES.dropTarget}`,
      );
    },

    /**
     * Emit files dropped on this row.
     * @param {Event} event Drop event
     */
    handleFilesDrop(event) {
      if (!this.viewModel.get("acceptsFiles")) return;

      event.preventDefault();
      event.stopPropagation();
      this.$el.removeClass(
        `${CLASS_NAMES.droppable} ${CLASS_NAMES.dropTarget}`,
      );

      const files =
        event.originalEvent?.dataTransfer?.files ||
        event.dataTransfer?.files ||
        [];
      this.trigger("files:drop", this.viewModel, files, event);
    },

    /** Close action subviews */
    closeActionViews() {
      this.actionViews.forEach((actionView) => {
        this.stopListening(actionView);
        actionView.remove();
      });
      this.actionViews = [];
    },

    /** Close the share action subview */
    closeShareActionView() {
      if (!this.shareActionView) return;
      this.stopListening(this.shareActionView);
      this.shareActionView.remove();
      this.shareActionView = null;
    },

    /**
     * Close subviews before removing this view.
     * @returns {FileItemView} This view
     */
    remove() {
      this.destroyTooltips();
      this.closeActionViews();
      this.closeShareActionView();
      return Backbone.View.prototype.remove.call(this);
    },

    /** Close this view when the parent table view is closed. */
    onClose() {
      this.remove();
    },
  });

  return FileItemView;
});
