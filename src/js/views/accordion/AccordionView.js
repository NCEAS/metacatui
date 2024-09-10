define([
  "jquery",
  "backbone",
  "semantic",
  "views/accordion/AccordionItemView",
  "models/accordion/Accordion",
], ($, Backbone, Semantic, AccordionItemView, AccordionModel) => {
  // The base class for the view
  const BASE_CLASS = "accordion-view";

  /**
   * @class AccordionView
   * @classdesc An extension of the Semantic UI accordion that allows for
   * defining contents with a Backbone model, and adds tooltips and other
   * features.
   * @classcategory Views/Accordion
   * @augments Backbone.View
   * @class
   * @since 2.31.0
   * @screenshot views/accordion/AccordionView.png
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
        const view = this;

        // Gather all the necessary settings from the model
        const modelJSON = this.model.toJSON();
        const settings = Object.fromEntries(
          Object.entries(modelJSON).filter(([key, _]) =>
            Semantic.ACCORDION_SETTINGS_KEYS.includes(key),
          ),
        );

        // Pass the associated model and view to the callback functions instead
        // only having access to the DOM element as the context
        const createCallback = (callbackName) => {
          const originalCallback = this.model.get(callbackName);
          if (originalCallback) {
            return function callbackWrapper() {
              const contentEl = this[0];
              const itemView = view.viewFromContentEl(contentEl);
              const itemModel = itemView.model;
              originalCallback(itemModel, itemView);
            };
          }
          return null;
        };
        Semantic.ACCORDION_CALLBACKS.forEach((callbackName) => {
          const callback = createCallback(callbackName);
          if (callback) {
            settings[callbackName] = callback;
          } else {
            delete settings[callbackName];
          }
        });

        // Initialize the accordion with the specified settings
        this.$el.accordion(settings);
      },

      /**
       * @param {HTMLElement} contentEl A content element from an item
       * @returns {AccordionItemView} The view associated with the item
       */
      viewFromContentEl(contentEl) {
        const views = Object.values(this.itemViews);
        return views.find((view) => view.contentContainer === contentEl);
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
        if (items?.length) this.addItems(items, accordionContainer);
        return accordionContainer;
      },

      /**
       * Creates a container element for the accordion with the necessary
       * classes
       * @returns {HTMLElement} The container element for the accordion
       */
      createContainer() {
        const container = document.createElement("div");
        container.classList.add(
          Semantic.CLASS_NAMES.accordion.container,
          Semantic.CLASS_NAMES.base,
        );
        container.style.marginTop = 0;

        // Add optional class names based on model properties
        const optionalClasses = ["fluid", "styled", "inverted"];
        optionalClasses.forEach((className) => {
          if (this.model.get(className)) {
            container.classList.add(Semantic.CLASS_NAMES.variations[className]);
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
        const itemView = this.itemViews?.[itemId];
        if (!itemView) return;
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
        // remove the item view from the itemViews object
        delete this.itemViews[id];
        itemView?.remove();
      },

      /**
       * Removes all items from the accordion and clears the itemViews object.
       */
      clearAllItems() {
        Object.entries(this.itemViews).forEach(([id, view]) => {
          view.remove();
          delete this.itemViews[id];
        });
      },
    },
  );

  return AccordionView;
});
