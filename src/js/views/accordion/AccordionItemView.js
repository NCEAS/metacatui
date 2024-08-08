define(["jquery", "backbone", "semantic", "models/accordion/AccordionItem"], (
  $,
  Backbone,
  _Semantic,
  AccordionItem,
) => {
  // Base class for the view
  const BASE_CLASS = "accordion-item";

  // Class names that we use in the view, including those from the dropdown
  // module
  const CLASS_NAMES = {
    title: "title",
    icon: "dropdown icon",
    content: "content",
  };

  /**
   * @class AccordionItemView
   * @classdesc A view representing an accordion item with a title and content
   * @classcategory Views/Accordion
   * @augments Backbone.View
   * @class
   * @since 0.0.0
   * @screenshot views/searchSelect/AccordionItemViewView.png // TODO
   */
  const AccordionItemView = Backbone.View.extend(
    /** @lends AccordionItemView.prototype */
    {
      /** @inheritdoc */
      type: "AccordionItemView",

      /** @inheritdoc */
      className: BASE_CLASS,

      /** @inheritdoc */
      tagName: "div",

      dropdownIconTemplate: `<i class="${CLASS_NAMES.icon}"></i>`,

      /** @inheritdoc */
      initialize(options) {
        this.model = options?.model || new AccordionItem();
        this.listenTo(this.model, "change", this.render);
      },

      hideIcon() {
        this.iconEl.style.display = "none";
      },

      showIcon() {
        this.iconEl.style.display = "inline";
      },

      /** @inheritdoc */
      render() {
        // Icon
        const iconContainer = document.createElement("div");
        iconContainer.innerHTML = this.dropdownIconTemplate;
        const iconEl = iconContainer.firstChild;
        this.iconEl = iconEl;

        // Title
        const titleSpan = document.createElement("span");
        titleSpan.textContent = this.model.get("title");
        const titleContainer = document.createElement("div");
        titleContainer.classList.add(CLASS_NAMES.title);
        titleContainer.appendChild(iconEl);
        titleContainer.appendChild(titleSpan);
        this.titleContainer = titleContainer;

        // Content
        const contentContainer = document.createElement("div");
        contentContainer.classList.add(CLASS_NAMES.content);
        this.contentContainer = contentContainer;

        // Put it all together
        this.el.appendChild(titleContainer);
        this.el.appendChild(contentContainer);
        this.updateContent(this.model.get("content"));

        return this;
      },

      /**
       * Change the content of the accordion item.
       * @param {string|HTMLElement|Backbone.View} content - The content to
       * display.
       * @param {boolean} [clear] - Whether to clear the existing content.
       */
      updateContent(content, clear = true) {
        const { contentContainer } = this;

        if (!contentContainer) return;
        if (clear) {
          contentContainer.innerHTML = "";
          this.hideIcon();
        }
        if (!content) return;
        if (typeof content === "string") {
          contentContainer.innerHTML = content;
        } else if (content instanceof HTMLElement) {
          contentContainer.appendChild(content);
        } else if (content instanceof Backbone.View) {
          contentContainer.appendChild(content.render().el);
        }
        this.showIcon();
      },
    },
  );

  return AccordionItemView;
});
