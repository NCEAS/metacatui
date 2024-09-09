define(["backbone"], (Backbone) => {
  /**
   * @class AccordionItem
   * @classdesc A model representing a single item in a nested Semantic UI
   * accordion
   * @classcategory Models/Accordion
   * @augments Backbone.Model
   * @constructs
   * @since 0.0.0
   */
  const AccordionItem = Backbone.Model.extend(
    /** @lends AccordionItem.prototype */
    {
      /** @inheritdoc */
      type: "AccordionItem",

      /**
       * @returns {object} Default attributes for an AccordionItem model.
       * @property {string} itemId - The unique identifier for the item. This is
       * required in order for any child items to be nested under this item. If
       * not provided, it will be generated from the title.
       * @property {string} title - The title of the item.
       * @property {string} content - Content for the dropdown item. This will
       * be ignored if there are child items.
       * @property {string} parent - The parent item's itemId. If blank or null,
       * this item is a top-level item.
       * TODO:
       * @property {string} description - The tooltip content.
       * @property {string} subTitle - The tag to show next to the title.
       * @property {boolean} selectable - Whether the item is selectable.
       * @property {boolean} hasChildren - Whether the item has children.
       */
      defaults() {
        return {
          itemId: "",
          title: "",
          content: "",
          parent: "",
          // TODO: Add and make use of these attributes
          // description: "", // tooltip content
          // subTitle: "", // show as tag next to title
          // selectable: false,
          // hasChildren: false,
        };
      },

      /** @inheritdoc */
      initialize(_attributes, _options) {
        // if there's no itemId on the model or passed in, set it from the title
        if (!this.get("itemId")) {
          this.setIdFromTitle();
        }
      },

      /**
       * Sets the itemId from the title, replacing spaces with dashes and
       * removing any non-alphanumeric characters.
       */
      setIdFromTitle() {
        const title = this.get("title");
        let id = title.replace(/\s/g, "-").toLowerCase();
        id = id.replace(/[^a-z0-9-]/g, "");
        this.set("itemId", id);
      },
    },
  );
  return AccordionItem;
});
