"use strict";

define(["backbone"], (Backbone) => {
  /**
   * @class FileItemActionViewModel
   * @classdesc Generic render state for a file table action
   * @classcategory Models/FileTable
   * @since 0.0.0
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
      return this.get("isVisible") && !this.get("isDisabled");
    },

    /** @returns {object} Render ready action state */
    toRenderData() {
      const label = this.get("label") || "";
      const title = this.get("title") || label;

      return {
        ...this.toJSON(),
        label,
        title,
        ariaLabel: this.get("ariaLabel") || label || title || "Action",
      };
    },
  });

  return FileItemActionViewModel;
});
