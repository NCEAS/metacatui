define(["views/searchSelect/SearchableSelectView", "models/NodeModel"], (
  SearchableSelect,
  NodeModel,
) => {
  /**
   * @class NodeSelect
   * @classdesc A select interface that allows the user to search for and
   * select a member node
   * @classcategory Views/SearchSelect
   * @augments SearchableSelect
   * @class
   * @since 2.14.0
   * @screenshot views/searchSelect/NodeSelectView.png
   */
  const NodeSelect = SearchableSelect.extend(
    /** @lends NodeSelectView.prototype */
    {
      /** @inheritdoc */
      type: "NodeSelect",

      /** @inheritdoc */
      className: `${SearchableSelect.prototype.className} node-select`,

      /** @inheritdoc */
      initialize(options = {}) {
        this.getNodeOptions();

        const opts = {
          placeholderText: "Select a DataONE repository",
          inputLabel: "Select a DataONE repository",
          allowMulti: true,
          allowAdditions: true,
          options: this.getNodeOptions(),
          ...options,
        };

        SearchableSelect.prototype.initialize.call(this, opts);
      },

      /**
       * Fetch the member nodes from the NodeModel and convert them to options
       * for the searchSelect component.
       * @returns {object[]} An array of objects representing the member nodes
       * @since 0.0.0
       */
      getNodeOptions() {
        if (!MetacatUI.nodeModel) MetacatUI.nodeModel = new NodeModel();
        const members = MetacatUI.nodeModel.get("members") || [];

        const attributeMap = {
          logo: "image",
          name: "label",
          description: "description",
          identifier: "value",
        };
        // Convert nodeModel members to options of searchSelect using map
        const options = members.map((member) => {
          const option = {};
          Object.entries(attributeMap).forEach(([oldName, newName]) => {
            option[newName] = member[oldName];
          });
          return option;
        });

        return options;
      },
    },
  );
  return NodeSelect;
});
