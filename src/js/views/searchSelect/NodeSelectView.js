define([
  "jquery",
  "underscore",
  "backbone",
  "views/searchSelect/SearchableSelectView",
  "models/NodeModel",
], function ($, _, Backbone, SearchableSelect, NodeModel) {
  /**
   * @class NodeSelect
   * @classdesc A select interface that allows the user to search for and
   * select a member node
   * @classcategory Views/SearchSelect
   * @extends SearchableSelect
   * @constructor
   * @since 2.14.0
   * @screenshot views/searchSelect/NodeSelectView.png
   */
  var NodeSelect = SearchableSelect.extend(
    /** @lends NodeSelectView.prototype */
    {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "NodeSelect",

      /**
       * className - Returns the class names for this view element
       *
       * @return {string}  class names
       */
      className: SearchableSelect.prototype.className + " node-select",

      /**
       * Text to show in the input field before any value has been entered
       * @type {string}
       */
      placeholderText: "Select a DataONE repository",

      /**
       * Label for the input element
       * @type {string}
       */
      inputLabel: "Select a DataONE repository",

      /**
       * Whether to allow users to select more than one value
       * @type {boolean}
       */
      allowMulti: true,

      /**
       * Setting to true gives users the ability to add their own options that
       * are not listed in this.options. This can work with either single
       * or multiple search select dropxdowns
       * @type {boolean}
       * @default true
       */
      allowAdditions: true,

      /**
       * Creates a new NodeSelectView
       * @param {Object} options - A literal object with options to pass to the view
       */
      initialize: function (options) {
        const opts = options || {};
        // Ensure the query fields are cached
        if (typeof MetacatUI.nodeModel === "undefined") {
          MetacatUI.nodeModel = new NodeModel();
        }

        var members = MetacatUI.nodeModel.get("members");

        // Maps the nodeModel member attributes (keys) to the searchSelect
        // dropdown options properties (values)
        var map = Object.entries({
          logo: "image",
          name: "label",
          description: "description",
          identifier: "value",
        });

        const selectOptions = [];

        // Convert nodeModel members to options of searchSelect
        members.forEach((member, i) => {
          selectOptions[i] = {};
          for (const [oldName, newName] of map) {
            selectOptions[i][newName] = member[oldName];
          }
        });

        opts.options = selectOptions;

        SearchableSelect.prototype.initialize.call(this, opts); 
      },
    },
  );
  return NodeSelect;
});
