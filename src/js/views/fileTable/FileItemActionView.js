"use strict";

define([
  "backbone",
  "models/fileTable/FileItemActionViewModel",
  "views/fileTable/FileTableViewUtilities",
  "semantic",
], (Backbone, FileItemActionViewModel, ViewUtilities) => {
  const { escapeHtml, setOptionalAttribute } = ViewUtilities;
  const CLASS_NAMES = {
    disabled: "disabled",
    hidden: "hidden",
    view: "btn btn-rounded action",
  };

  /**
   * @class FileItemActionView
   * @classdesc Generic file table action button. It renders action state and
   * emits clicks without performing the action
   * @classcategory Views/FileTable
   * @since 0.0.0
   * @screenshot views/fileTable/FileItemActionView.png
   * @augments Backbone.View
   */
  const FileItemActionView = Backbone.View.extend({
    /** @inheritdoc */
    tagName: "button",

    /** @inheritdoc */
    className: CLASS_NAMES.view,

    /** @inheritdoc */
    attributes: { type: "button" },

    /** @inheritdoc */
    events: { click: "handleClick" },

    /** @inheritdoc */
    initialize(options = {}) {
      this.viewModel =
        options.viewModel ||
        options.model ||
        new FileItemActionViewModel(options);
      this.model = this.viewModel;

      this.listenTo(this.viewModel, "change", this.render);
    },

    /**
     * Render the action's icon when it has one (the label becomes the tooltip
     * and accessible name), or the label text otherwise.
     * @param {object} data Render ready action state
     * @returns {string} Button contents
     */
    template(data) {
      const icon = data.iconClass
        ? `<i class="${escapeHtml(data.iconClass)}"></i>`
        : "";
      const label = data.label ? `<span>${escapeHtml(data.label)}</span>` : "";
      return `${icon}${label}`;
    },

    /**
     * @inheritdoc
     * @returns {FileItemActionView} This view
     */
    render() {
      const data = this.viewModel.toRenderData();

      this.destroyTooltip();
      this.$el
        .attr("class", data.className || this.className)
        .toggleClass(CLASS_NAMES.hidden, !data.isVisible)
        .toggleClass(CLASS_NAMES.disabled, data.isDisabled)
        .prop("disabled", data.isDisabled)
        .attr("aria-disabled", data.isDisabled ? "true" : "false")
        .html(this.template(data));

      setOptionalAttribute(this.$el, "data-id", data.id);
      setOptionalAttribute(this.$el, "aria-label", data.ariaLabel);
      setOptionalAttribute(this.$el, "data-tt-content", data.title);

      return this;
    },

    /**
     * Destroy a lazily initialized delegated tooltip, if this button has one.
     */
    destroyTooltip() {
      if (!this.el.hasAttribute("data-tt-initialized")) return;
      this.$el.popup("destroy").removeAttr("data-tt-initialized");
    },

    /**
     * @inheritdoc
     * @returns {FileItemActionView} This view
     */
    remove() {
      this.destroyTooltip();
      return Backbone.View.prototype.remove.call(this);
    },

    /**
     * Emit enabled action clicks.
     * @param {Event} event Click event
     * @returns {boolean} False when disabled
     */
    handleClick(event) {
      if (!this.viewModel.isEnabled()) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }

      event.preventDefault();
      event.stopPropagation();
      this.trigger("action:click", this.viewModel, event);
      return false;
    },
  });

  return FileItemActionView;
});
