define(["jquery", "backbone", "semantic", "models/accordion/AccordionItem"], (
  $,
  Backbone,
  Semantic,
  AccordionItem,
) => {
  // Base class for the view
  const BASE_CLASS = "accordion-item";

  const CLASS_NAMES = {
    titleIcon: "accordion-view__title-icon",
  };

  /**
   * @class AccordionItemView
   * @classdesc A view representing an accordion item with a title and content
   * @classcategory Views/Accordion
   * @augments Backbone.View
   * @class
   * @since 2.31.0
   * @screenshot views/accordion/AccordionItemViewView.png
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

      /**
       * An HTML string to use for an icon indicating that the accordion item is
       * collapsible.
       * @type {string}
       */
      dropdownIconTemplate: `<i class="${Semantic.CLASS_NAMES.accordion.icon}"></i>`,

      /** @inheritdoc */
      initialize(options) {
        this.model = options?.model || new AccordionItem();
      },

      /* Hide the dropdown icon */
      hideIcon() {
        this.iconEl.style.display = "inline-block";
        this.iconEl.style.visibility = "hidden";
      },

      /* Show the dropdown icon */
      showIcon() {
        this.iconEl.style.display = "inline-block";
        this.iconEl.style.visibility = "visible";
      },

      /** @inheritdoc */
      render() {
        // Add any custom classes
        const customClasses = this.model.get("classes") || [];
        const titleClass = Semantic.CLASS_NAMES.accordion.title;
        const contentClass = Semantic.CLASS_NAMES.accordion.content;

        // Dropdown Icon
        const iconContainer = document.createElement("div");
        iconContainer.innerHTML = this.dropdownIconTemplate;
        const iconEl = iconContainer.firstChild;
        this.iconEl = iconEl;

        // Title
        const titleSpan = document.createElement("span");
        const titleContainer = document.createElement("div");
        titleContainer.classList.add(titleClass, ...customClasses);
        titleContainer.appendChild(iconEl);
        titleContainer.appendChild(titleSpan);
        this.titleContainer = titleContainer;
        this.titleSpan = titleSpan;
        this.updateTitle();

        // Content
        const contentContainer = document.createElement("div");
        contentContainer.classList.add(contentClass, ...customClasses);
        this.contentContainer = contentContainer;

        // Initialize the tooltip for the title
        this.updateTooltip();

        // Put it all together
        this.el.appendChild(titleContainer);
        this.el.appendChild(contentContainer);
        this.updateContent(this.model.get("content"));

        this.listenToModel();

        return this;
      },

      listenToModel() {
        this.stopListening();
        this.listenTo(this.model, "change:title", (_model, title) => {
          this.updateTitle(title);
        });
        this.listenTo(this.model, "change:content", (_model, content) => {
          this.updateContent(content);
        });
        this.listenTo(this.model, "change:itemId", () => {
          this.el.id = this.model.get("itemId");
        });
        this.listenTo(this.model, "change:description", () => {
          this.updateTooltip();
        });
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
          contentContainer.style.padding = "0";
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
        contentContainer.style.padding = "";
      },

      updateTitle(title) {
        const { titleSpan } = this;
        if (!this.titleSpan) return;

        const newTitle = title || this.model.get("title");
        const iconName = this.model.get("icon");

        let additionalIcon;
        if (iconName) {
          additionalIcon = document.createElement("i");
          additionalIcon.classList.add(
            CLASS_NAMES.titleIcon,
            "icon",
            `icon-${iconName}`,
          );
        }

        titleSpan.innerHTML = newTitle || "";
        if (additionalIcon) titleSpan.prepend(additionalIcon);
      },

      updateTooltip() {
        const { titleContainer } = this;
        if (!titleContainer) return;

        const description = this.model.get("description");

        if (description) {
          console.log("Setting tooltip for title:", description);

          $(titleContainer).popup({
            html: description,
            position: "top center",
            hoverable: true,
            on: "hover",
            variation: "tiny",
          });
        } else {
          $(titleContainer).popup("destroy");
        }
      },

      /*
       * Remove the view, DOM elements, and its associated popups.
       */
      remove() {
        $(this.titleContainer).popup("destroy");
        this.titleContainer.remove();
        this.contentContainer.remove();
        Backbone.View.prototype.remove.call(this);
      },
    },
  );

  return AccordionItemView;
});
