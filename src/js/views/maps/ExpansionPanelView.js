"use strict";

define(["underscore", "backbone", "text!templates/maps/expansion-panel.html"], (
  _,
  Backbone,
  Template,
) => {
  // The base classname to use for this View's template elements.
  const BASE_CLASS = "expansion-panel";
  //The HTML classes to use for this view's HTML elements.
  const CLASS_NAMES = {
    title: `${BASE_CLASS}__title`,
    content: `${BASE_CLASS}__content`,
    toggle: `${BASE_CLASS}__toggle`,
    icon: `${BASE_CLASS}__icon`,
    iconToggle: `${BASE_CLASS}__icon-toggle`,
  };

  /**
   * @class ExpansionPanelView
   * @classdesc Allow expand and collapse content in a panel.
   * @classcategory Views/Maps/Viewfinder
   * @name ExpansionPanelView
   * @extends Backbone.View
   * @screenshot views/maps/ExpansionPanelView.png
   * @since 2.29.0
   * @constructs ExpansionPanelView
   */
  var ExpansionPanelView = Backbone.View.extend(
    /** @lends ExpansionPanelView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "ExpansionPanelView",

      /** @inheritdoc */
      className: BASE_CLASS,

      /**
       * The events this view will listen to and the associated function to call.
       * @type {Object}
       */
      events() {
        return {
          [`click .${CLASS_NAMES.toggle}`]: "toggle",
        };
      },

      /**
       * @typedef {Object} ExpansionPanelViewOptions
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
      }) {
        this.templateVars = {
          classNames: CLASS_NAMES,
          icon: icon,
          isSvgIcon: isSvgIcon,
          title: title,
        };
        this.contentViewInstance = contentViewInstance;
        this.panelsModel = panelsModel;
        this.startOpen = !!startOpen;

        this.panelsModel?.register(this);
      },

      /**
       * Getter function for the content div.
       * @return {HTMLDivElement} Returns the content element.
       */
      getContent() {
        return this.$el.find(`.${CLASS_NAMES.content}`);
      },

      /** Force the panel's content to be hidden. */
      collapse() {
        this.$el.removeClass("show-content");
      },

      /** Force the panel's content to be shown. */
      open() {
        this.$el.addClass("show-content");
        this.panelsModel?.maybeCollapseOthers(this);
      },

      /** Toggle the visibility of the panel's content. */
      toggle() {
        if (this.$el.hasClass("show-content")) {
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
        this.contentViewInstance.render();
        this.getContent().append(this.contentViewInstance.el);

        if (this.startOpen) {
          this.open();
        }
      },
    },
  );

  return ExpansionPanelView;
});
