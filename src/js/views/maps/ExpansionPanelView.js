"use strict";

define(["underscore", "backbone", "text!templates/maps/expansion-panel.html"], (
  _,
  Backbone,
  Template,
) => {
  // The base classname to use for this View's template elements.
  const BASE_CLASS = "expansion-panel";
  // The HTML classes to use for this view's HTML elements.
  const CLASS_NAMES = {
    BASE: BASE_CLASS,
    TITLE: `${BASE_CLASS}__title`,
    CONTENT: `${BASE_CLASS}__content`,
    TOGGLE: `${BASE_CLASS}__toggle`,
    ICON: `${BASE_CLASS}__icon`,
    ICON_TOGGLE: `${BASE_CLASS}__icon-toggle`,
    EXPANDED: "show-content",
    ICON_FONT: "icon",
    CARET_DOWN: "icon-caret-down",
    CARET_UP: "icon-caret-up",
  };

  /**
   * @class ExpansionPanelView
   * @classdesc Allow expand and collapse content in a panel.
   * @classcategory Views/Maps/Viewfinder
   * @name ExpansionPanelView
   * @augments Backbone.View
   * @screenshot views/maps/ExpansionPanelView.png
   * @since 2.29.0
   * @constructs ExpansionPanelView
   */
  const ExpansionPanelView = Backbone.View.extend(
    /** @lends ExpansionPanelView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "ExpansionPanelView",

      /** @inheritdoc */
      className: CLASS_NAMES.BASE,

      /**
       * The events this view will listen to and the associated function to call.
       * @type {object}
       */
      events() {
        return {
          [`click .${CLASS_NAMES.TOGGLE}`]: "toggle",
        };
      },

      /**
       * @typedef {object} ExpansionPanelViewOptions
       * @property {string} title The displayed label for this panel.
       * @property {string} icon The icon displayed in the panel's clickable
       * label.
       * @property {Backbone.View} contentViewInstance The Backbone.View that
       * will be displayed when the content of the panel is toggled to be
       * visible.
       * @property {ExpansionPanelsModel} [panelsModel] Optional model for
       * coordinating the expanded/collapsed state among many panels.
       * @property {boolean} startOpen Whether the panel should be expanded by
       * default.
       */

      /**
       * Initialize the view with the given options.
       * @param {ExpansionPanelViewOptions} options The options for this view.
       */
      initialize({
        title,
        contentViewInstance,
        icon,
        panelsModel,
        startOpen,
        isSvgIcon,
        variants,
      }) {
        this.templateVars = {
          classNames: CLASS_NAMES,
          icon,
          isSvgIcon,
          title,
        };
        this.contentViewInstance = contentViewInstance;
        this.panelsModel = panelsModel;
        this.startOpen = !!startOpen;

        this.panelsModel?.register(this);
        this.variants = variants || [];
      },

      /**
       * Getter function for the content div.
       * @returns {HTMLDivElement} Returns the content element.
       */
      getContent() {
        return this.$el.find(`.${CLASS_NAMES.CONTENT}`);
      },

      /** Force the panel's content to be hidden. */
      collapse() {
        this.$el.removeClass(CLASS_NAMES.EXPANDED);
      },

      /** Force the panel's content to be shown. */
      open() {
        this.$el.addClass(CLASS_NAMES.EXPANDED);
        this.panelsModel?.maybeCollapseOthers(this);
      },

      /** Toggle the visibility of the panel's content. */
      toggle() {
        if (this.$el.hasClass(CLASS_NAMES.EXPANDED)) {
          this.collapse();
        } else {
          this.open();
        }
      },

      /**
       * Render the view by updating the HTML of the element.
       * The new HTML is computed from an HTML template that
       * is passed an object with relevant view state.
       * */
      render() {
        this.el.innerHTML = _.template(Template)(this.templateVars);
        this.$el.addClass(
          this.variants.map((v) => `${BASE_CLASS}--${v}`).join(" "),
        );
        this.contentViewInstance.render();
        this.getContent().append(this.contentViewInstance.el);

        if (this.startOpen) {
          this.open();
        }
      },
    },
  );

  /**
   * CSS class names used by expansion panels.
   * @type {Object<string, string>}
   * @since 2.41.0
   */
  ExpansionPanelView.CLASS_NAMES = CLASS_NAMES;

  return ExpansionPanelView;
});
