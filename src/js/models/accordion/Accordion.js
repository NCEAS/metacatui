define(["backbone", "models/accordion/AccordionItem"], (
  Backbone,
  AccordionItem,
) => {
  /**
   * @class Accordion
   * @classdesc A model representing an accordion with nested accordion items
   * @classcategory Models
   * @augments Backbone.Model
   * @constructs
   * @augments Backbone.Model
   * @since 0.0.0
   */
  const Accordion = Backbone.Model.extend(
    /** @lends Accordion.prototype */
    {
      /** @inheritdoc */
      type: "Accordion",

      /**
       * Note: Do not set a "easing" attribute on this model. It seems to break
       * semanticUI accordion.
       * @returns {object} Default attributes for an Accordion model.
       * @property {boolean} exclusive - Only allow one section open at a time.
       * @property {string} on - Event on title that will cause accordion to
       * open. Commonly set to "click".
       * @property {boolean} animateChildren - Whether child content opacity
       * should be animated. Note: may cause performance issues with many child
       * elements.
       * @property {boolean} closeNested - Close open nested accordion content
       * when an element closes.
       * @property {boolean} collapsible - Allow active sections to collapse.
       * @property {number} duration - Duration in milliseconds of the opening
       * animation.
       * @see {@link https://fomantic-ui.com/modules/accordion.html#settings}
       * for more information on accordion settings.
       * @see {@link https://api.jqueryui.com/easings/} for easing options.
       * @property {Function} onOpening - Callback function before an element
       * opens. Takes the active content as an argument.
       * @property {Function} onOpen - Callback function after an element is
       * open. Takes the active content as an argument.
       * @property {Function} onClosing - Callback function before an element
       * closes. Takes the active content as an argument.
       * @property {Function} onClose - Callback function after an element is
       * closed. Takes the active content as an argument.
       * @property {Function} onChanging - Callback function before an element
       * opens or closes. Takes the active content as an argument.
       * @property {Function} onChange - Callback function when an element opens
       * or closes. Takes the active content as an argument.
       * @property {boolean} styled - Whether to use Semantic UI styles for the
       * accordion.
       * @property {boolean} inverted - Whether to use an inverted color scheme
       * for the accordion (dark background with light text).
       * @property {boolean} fluid - Whether the accordion should take up the
       * full width of its container.
       */
      defaults() {
        return {
          exclusive: true,
          on: "click",
          animateChildren: true,
          closeNested: true,
          collapsible: true,
          duration: 300,
          onOpening: null,
          onOpen: null,
          onClosing: null,
          onClose: null,
          onChanging: null,
          onChange: null,
          styled: true,
          inverted: false,
          fluid: true,
        };
      },

      /** @inheritdoc */
      initialize(attributes, _options) {
        const items = attributes?.items || [];
        const collection = new Backbone.Collection(items, {
          model: AccordionItem,
        });
        this.set("items", collection);
      },

      /**
       * Get the children of an item by its id
       * @param {string} id - The id of the parent item
       * @returns {AccordianItem[]} An array of AccordianItem models
       */
      getChildren(id) {
        return this.get("items").where({ parent: id });
      },

      /**
       * Get the root items of the accordion. Root items are those without a
       * parent attribute or with an empty string as the parent attribute.
       * @returns {AccordianItem[]} An array of AccordianItem models
       */
      getRootItems() {
        return this.get("items").filter((item) => !item.get("parent"));
      },
    },
  );

  return Accordion;
});
