"use strict";

define(["backbone"], (Backbone) => {
  /**
   * @class FileItemActionViewModel
   * @classdesc Generic render state for a file table action
   * @classcategory Models/FileTable
   * @since 2.39.0
   * @augments Backbone.Model
   */
  const FileItemActionViewModel = Backbone.Model.extend({
    /** @returns {object} Default action state */
    defaults() {
      return {
        id: "",
        label: "",
        title: "",
        ariaLabel: "",
        iconClass: "",
        className: "btn btn-rounded action",
        menuItems: null,
        isVisible: true,
        isDisabled: false,
        pending: null,
      };
    },

    /**
     * Update render attributes.
     * @param {object} attributes Attributes to set
     * @param {object} [options] Backbone set options
     * @returns {FileItemActionViewModel} This model
     */
    update(attributes = {}, options = {}) {
      this.set(attributes, options);
      return this;
    },

    /** @returns {boolean} Whether this action can be invoked */
    isEnabled() {
      return (
        this.get("isVisible") && !this.get("isDisabled") && !this.get("pending")
      );
    },

    /**
     * Show pending feedback without overwriting the action's current state.
     * @param {string} label Pending button label
     * @param {string} title Pending tooltip and accessible label
     */
    startPending(label, title) {
      this.set("pending", { label, title });
    },

    /** Clear pending feedback, revealing the latest projected action state */
    finishPending() {
      this.set("pending", null);
    },

    /** @returns {object} Render ready action state */
    toRenderData() {
      const label = this.get("label") || "";
      const title = this.get("title") || label;
      const pending = this.get("pending");

      return {
        ...this.toJSON(),
        label,
        title,
        ariaLabel: this.get("ariaLabel") || label || title || "Action",
        ...(pending && {
          label: pending.label,
          title: pending.title,
          ariaLabel: pending.title,
          iconClass: "icon icon-spinner icon-spin",
          isDisabled: true,
        }),
      };
    },
  });

  return FileItemActionViewModel;
});
