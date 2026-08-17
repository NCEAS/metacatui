define(["views/searchSelect/SearchSelectView", "common/Utilities"], (
  SearchSelect,
  Utilities,
) => {
  /**
   * @class ObjectFormatSelect
   * @classdesc A select interface that allows the user to search for and
   * select a DataONE object format
   * @classcategory Views/SearchSelect
   * @augments SearchSelect
   * @class
   * @since 2.15.0
   * @screenshot views/searchSelect/ObjectFormatSelectView.png
   */
  const ObjectFormatSelect = SearchSelect.extend(
    /** @lends ObjectFormatSelectView.prototype */
    {
      /** @inheritdoc */
      type: "ObjectFormatSelect",

      /** @inheritdoc */
      className: `${SearchSelect.prototype.className} object-format-select`,

      /** @inheritdoc */
      initialize(options = {}) {
        const opts = {
          inputLabel: "Select one or more metadata types",
          placeholderText: "Type in a metadata type",
          allowMulti: true,
          allowAdditions: true,
          ...options,
        };

        SearchSelect.prototype.initialize.call(this, opts);
        this.getObjectFormats();
      },

      /**
       * Fetch the object formats from the DataONE API and update the
       * select options on the model
       * @since 2.31.0
       */
      async getObjectFormats() {
        let formats = [];
        try {
          const objectFormats = await Utilities.awaitObjectFormats();
          formats = objectFormats?.toJSON() || [];
        } catch (error) {
          /* eslint-disable no-console */
          console.error("Error fetching object formats:", error);
          this.updateOptions([]);
          return;
        }

        const options = formats
          // Query Rules automatically include a rule for formatType="METADATA"
          // so subset to only METADATA formats
          .filter((format) => format.formatType === "METADATA")
          // Reformat for a SearchSelect
          .map((format) => ({
            label: format.formatName,
            value: format.formatId,
            description: format.formatId,
          }));

        this.updateOptions(options);
      },
    },
  );
  return ObjectFormatSelect;
});
