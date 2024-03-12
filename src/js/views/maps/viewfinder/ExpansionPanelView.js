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
    var ExpansionPanelView = Backbone.View.extend({
      /**
       * The type of View this is
       * @type {string}
       */
      type: 'ExpansionPanelView',

      /**
       * The HTML class to use for this view's outermost element.
       * @type {string}
       */
      className: BASE_CLASS,

      /**
       * The HTML classes to use for this view's HTML elements.
       * @type {Object<string,string>}
       */
      classNames: {
        title: `${BASE_CLASS}__title`,
        content: `${BASE_CLASS}__content`,
        toggle: `${BASE_CLASS}__toggle`,
        icon: `${BASE_CLASS}__icon`,
      },

      /**
      * The events this view will listen to and the associated function to call.
      * @type {Object}
      */
      events() {
        return {
          [`click .${this.classNames.toggle}`]: 'toggle',
        };
      },

      /** Values meant to be used by the rendered HTML template. */
      templateVars: {
        classNames: {},
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
        this.templateVars.classNames = this.classNames;
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
        return this.$el.find(`.${this.classNames.content}`);
      },

      /** Force the panel's content to be hidden. */
      collapse() {
        this.$el.removeClass('show-content');
      },

      /** Toggle the visibility of the panel's content. */
      toggle() {
        this.$el.toggleClass('show-content');

        if (this.$el.hasClass('show-content')) {
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