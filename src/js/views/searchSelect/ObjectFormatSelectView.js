define([
  "jquery",
  "underscore",
  "backbone",
  "views/searchSelect/SearchableSelectView",
  "collections/ObjectFormats"
],
  function ($, _, Backbone, SearchableSelect, ObjectFormats) {

    /**
     * @class ObjectFormatSelect
     * @classdesc A select interface that allows the user to search for and
     * select a DataONE object format
     * @classcategory Views/SearchSelect
     * @extends SearchableSelect
     * @constructor
     * @since 2.15.0
     * @screenshot views/searchSelect/ObjectFormatSelectView.png
     */
    var ObjectFormatSelect = SearchableSelect.extend(
      /** @lends ObjectFormatSelectView.prototype */
      {
        /**
         * The type of View this is
         * @type {string}
         */
        type: "ObjectFormatSelect",

        /**
         * className - Returns the class names for this view element
         *
         * @return {string}  class names
         */
        className: SearchableSelect.prototype.className + " object-format-select",

        /**
         * Label for the input element
         * @type {string}
         * @since 2.15.0
         */
        inputLabel: "Select one or more metadata types",

        /**
         * Text to show in the input field before any value has been entered
         * @type {string}
         * @since 2.15.0
         */
        placeholderText: "Type in a metadata type",

        /**
         * Whether to allow users to select more than one value
         * @type {boolean}
         * @since 2.15.0
         */
        allowMulti: true,

        /**
         * Setting to true gives users the ability to add their own options that
         * are not listed in this.options. This can work with either single
         * or multiple search select dropdowns
         * @type {boolean}
         * @default true
         * @since 2.15.0
         */
        allowAdditions: true,

        /**
         * Render the view
         *
         * @return {ObjectFormatSelect}  Returns the view
         * @since 2.15.0
         */
        render: function () {

          try {
            var view = this;

            // Ensure the object formats are cached
            if (typeof MetacatUI.objectFormats === "undefined") {
              MetacatUI.objectFormats = new ObjectFormats();
            }

            // If not already synced, then get the object formats
            if (
              MetacatUI.objectFormats.length === 0 &&
              !(MetacatUI.objectFormats._events && MetacatUI.objectFormats._events.sync)
            ) {
              this.listenToOnce(MetacatUI.objectFormats, "sync error", view.render);
              MetacatUI.objectFormats.fetch();
              return
            }

            var formatIds = MetacatUI.objectFormats.toJSON();
            var options = _.chain(formatIds)
              // Since the Query Rules automatically include a rule for formatType =
              // "METADATA", only allow filtering datasets by specific metadata type.
              .where({ formatType: "METADATA" })
              .map(
                function (format) {
                  return {
                    label: format.formatName,
                    value: format.formatId,
                    description: format.formatId
                  }
                }
              )
              .value();

            this.options = options;

            SearchableSelect.prototype.render.call(view);
          } catch (error) {
            console.log("Error rendering an Object Format Select View.");
            console.log(error);
          }
        }

      });
    return ObjectFormatSelect;
  });
