define([
  "jquery",
  "backbone",
  "semantic",
  "views/accordion/AccordionItemView",
  "models/accordion/Accordion",
], ($, Backbone, _Semantic, AccordionItemView, AccordionModel) => {
  // The base class for the view
  const BASE_CLASS = "accordion-view";

  // Class names that we use in the view, including those from the dropdown
  // module
  const CLASS_NAMES = {
    container: "accordion",
    semantic: "ui",
    title: "title",
    icon: "dropdown icon",
    content: "content",
    fluid: "fluid",
    styled: "styled",
    inverted: "inverted",
    accordion: $().accordion.settings.className,
  };

  // Keys for the settings available in the accordion module
  const ACCORDION_SETTINGS_KEYS = Object.keys($().accordion.settings);

  /**
   * @class AccordionView
   * @classdesc An extension of the Semantic UI accordion that allows for
   * defining contents with a Backbone model, and adds tooltips and other
   * features.
   * @classcategory Views/Accordion
   * @augments Backbone.View
   * @class
   * @since 0.0.0
   * @screenshot views/Accordion/AccordionView.png // TODO
   */
  const AccordionView = Backbone.View.extend(
    /** @lends AccordionView.prototype */
    {
      /** @inheritdoc */
      type: "AccordionView",

      /** @inheritdoc */
      className: BASE_CLASS,

      /** @inheritdoc */
      tagName: "div",

      /**
       * Initializes the AccordionView with the model and listens for changes
       * to the items collection.
       * @param {object} options - Options for the view
       * @param {Accordion} [options.model] - The Accordion model for the view. If
       * not provided, a new Accordion model will be created.
       * @param {object} [options.modelData] - Optional data to initialize the
       * Accordion model with. Only used if options.model is not provided.
       */
      initialize(options) {
        // Set the model to the provided model or create a new one
        this.model = options?.model || new AccordionModel(options?.modelData);

        this.listenTo(this.model.get("items"), "add", this.addNewItem);
        this.listenTo(this.model.get("items"), "remove", this.removeItem);
      },

      /** @inheritdoc */
      render() {
        this.initializeAccordion();
        // Start rendering the root, and then the children will be rendered
        // recursively
        const rootItems = this.model.getRootItems();
        const rootAccordion = this.createAccordion(rootItems);
        this.rootAccordion = rootAccordion;
        this.$el.append(rootAccordion);
        return this;
      },

      /**
       * Initializes the Semantic UI accordion module with the settings from the
       * model. The module handles applying accordion behavior to the view and
       * any new DOM elements that are added.
       */
      initializeAccordion() {
        const modelJSON = this.model.toJSON();
        const settings = Object.fromEntries(
          Object.entries(modelJSON).filter(([key, _val]) =>
            ACCORDION_SETTINGS_KEYS.includes(key),
          ),
        );
        this.$el.accordion(settings);
      },

      /**
       * Creates a container for the accordion with the necessary classes for
       * Semantic UI and renders any items belonging to the accordion. This can
       * be used to create the root accordion or nested accordions.
       * @param {AccordionItem[]} items - An array of AccordionItem models
       * @returns {HTMLElement} The container element for the accordion
       */
      createAccordion(items) {
        const accordionContainer = this.createContainer();
        this.addItems(items, accordionContainer);
        return accordionContainer;
      },

      /**
       * Creates a container element for the accordion with the necessary
       * classes
       * @returns {HTMLElement} The container element for the accordion
       */
      createContainer() {
        const container = document.createElement("div");
        container.classList.add(CLASS_NAMES.container, CLASS_NAMES.semantic);
        container.style.marginTop = 0;

        // Add optional class names based on model properties
        const optionalClasses = ["fluid", "styled", "inverted"];
        optionalClasses.forEach((className) => {
          if (this.model.get(className)) {
            container.classList.add(CLASS_NAMES[className]);
          }
        });

        return container;
      },

      /**
       * Adds items to the container element for the accordion
       * @param {AccordionItem[]} models - An array of AccordionItem models
       * @param {HTMLElement} container - The container element for the
       * accordion
       */
      addItems(models, container) {
        models.forEach((model) => {
          this.addItem(model, container);
        });
      },

      /**
       * Adds an item to the container element for the accordion
       * @param {AccordionItem} model - An AccordionItem model
       * @param {HTMLElement} container - The container element for the
       * accordion
       */
      addItem(model, container) {
        const itemView = new AccordionItemView({ model }).render();

        // Semantic UI expects the title and content to be direct children of
        // the accordion container, important for correct application of CSS
        container.appendChild(itemView.titleContainer);
        container.appendChild(itemView.contentContainer);

        if (!this.itemViews) this.itemViews = {};

        const id = model.get("itemId");
        this.itemViews[id] = itemView;
        // Add children if they exist, otherwise just re-adds the content
        this.refreshContent(id);
      },

      /**
       * Refreshes the content of an item in the accordion. If the item has
       * children, it will create a new accordion with the children. Otherwise,
       * it will update the content with the item's model content attribute.
       * @param {string} itemId - The model itemId for the item
       */
      refreshContent(itemId) {
        // Check if there are children for the given item
        const children = this.model.getChildren(itemId);
        const itemView = this.itemViews[itemId];
        if (children?.length) {
          const subAccordion = this.createAccordion(children);
          itemView.updateContent(subAccordion);
        } else {
          itemView.updateContent(itemView.model.get("content"));
        }
      },

      /**
       * Handles adding a new item to the accordion when the items collection
       * has new models added to it.
       * @param {AccordionItem} model - The new AccordionItem model
       */
      addNewItem(model) {
        const parent = model.get("parent");
        if (parent) {
          this.refreshContent(parent);
        } else {
          this.addItem(model, this.rootAccordion);
        }
      },

      /**
       * Handles removing an item from the accordion when the items collection
       * has models removed from it.
       * @param {AccordionItem} model - The removed AccordionItem model
       */
      removeItem(model) {
        const id = model.get("itemId") || model.cid;
        const itemView = this.itemViews[id];
        itemView.remove();
      },
    },
  );

  return AccordionView;
});
