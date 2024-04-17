'use strict';

define(
  [
    'underscore',
    'backbone',
    'text!templates/maps/viewfinder/expansion-panel.html',
  ],
  (_, Backbone, Template) => {
    // The base classname to use for this View's template elements.
    const BASE_CLASS = 'expansion-panel';
    //The HTML classes to use for this view's HTML elements.
    const CLASS_NAMES = {
      title: `${BASE_CLASS}__title`,
      content: `${BASE_CLASS}__content`,
      toggle: `${BASE_CLASS}__toggle`,
      icon: `${BASE_CLASS}__icon`,
    };

    /**
     * @class ExpansionPanelView
     * @classdesc Allow expand and collapse content in a panel.
     * @classcategory Views/Maps/Viewfinder
     * @name ExpansionPanelView
     * @extends Backbone.View
     * @screenshot views/maps/viewfinder/ExpansionPanelView_closed.png
     * @screenshot views/maps/viewfinder/ExpansionPanelView_open.png
     * @since x.x.x
     * @constructs ExpansionPanelView
     */
    var ExpansionPanelView = Backbone.View.extend(
      /** @lends ExpansionPanelView.prototype */{
        /**
         * The type of View this is
         * @type {string}
         */
        type: 'ExpansionPanelView',

        /** @inheritdoc */
        className: BASE_CLASS,

        /**
        * The events this view will listen to and the associated function to call.
        * @type {Object}
        */
        events() {
          return {
            [`click .${CLASS_NAMES.toggle}`]: 'toggle',
          };
        },

        /** Values meant to be used by the rendered HTML template. */
        templateVars: {
          classNames: CLASS_NAMES,
          title: '',
          icon: '',
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
         */
        initialize({ title, contentViewInstance, icon, panelsModel }) {
          this.templateVars.title = title;
          this.templateVars.icon = icon;
          this.contentViewInstance = contentViewInstance;
          this.panelsModel = panelsModel;

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
          this.$el.removeClass('show-content');
        },

        /** Force the panel's content to be shown. */
        open() {
          this.$el.addClass('show-content');
        },

        /** Toggle the visibility of the panel's content. */
        toggle() {
          if (this.$el.hasClass('show-content')) {
            this.collapse();
          } else {
            this.open();
            this.panelsModel?.collapseOthers(this);
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
        },
      });

    return ExpansionPanelView;
  });