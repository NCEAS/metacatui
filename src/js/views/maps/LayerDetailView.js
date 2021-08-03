'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/Layer',
    'text!templates/maps/layer-detail.html',
  ],
  function (
    $,
    _,
    Backbone,
    Layer,
    Template
  ) {

    /**
    * @class LayerDetailView
    * @classdesc A LayerDetailView creates a section to be inserted into a
    * LayerDetailsView. It renders a label and a toggle to collapse and expand the
    * section's contents. The contents of the Detail section can be rendered by any other
    * view, but the view should be one that shows details about a Layer or allows editing
    * elements of the Layer.
    * @classcategory Views/Maps
    * @name LayerDetailView
    * @extends Backbone.View
    * @screenshot maps/LayerDetailView.png // TODO: add screenshot
    * @constructs
    */
    var LayerDetailView = Backbone.View.extend(
      /** @lends LayerDetailView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'LayerDetailView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'layer-detail',

        /**
        * The model that this view uses
        * @type {Layer}
        */
        model: undefined,

        /**
         * The primary HTML template for this view
         * @type {Underscore.template}
         */
        template: _.template(Template),

        /**
         * CSS classes for HTML elements within this view.
         * @property {string} toggle The element in the template that acts as a toggle to
         * expand or collapse this Layer Detail section.
         * @property {string} open The class to add to the view when the contents are
         * visible (i.e. the section is expanded)
         * @property {string} label The element that holds the view's label text
         * @property {string} contentContainer The container into which the contentView's
         * rendered content will be placed
         */
        classes: {
          open: 'layer-detail--open',
          label: 'layer-detail__label',
          toggle: 'layer-detail__toggle',
          contentContainer: 'layer-detail__content'
        },

        /**
         * Indicates whether this section is collapsed or expanded
         * @type {Boolean}
         */
        isOpen: true,

        /**
         * The name to display for the Layer Detail section
         * @type {string}
         */
        label: null,

        /**
         * The sub-view that will show details about, or allow editing of, the given Layer
         * model. The contentView will be passed the Layer model.
         * @type {Backbone.View}
         */
        contentView: null,

        /**
        * Creates an object that gives the events this view will listen to and the
        * associated function to call. Each entry in the object has the format 'event
        * selector': 'function'.
        * @returns {Object}
        */
        events: function () {
          var events = {};
          // Collapse or expand this Detail section when the toggle button is clicked. Get
          // the class of the toggle button from the classes property set in this view.
          events['click .' + this.classes.toggle] = 'toggle'
          return events
        },

        /**
        * Executed when a new LayerDetailView is created
        * @param {Object} [options] - A literal object with options to pass to the view
        */
        initialize: function (options) {

          try {
            // Get all the options and apply them to this view
            if (typeof options == 'object') {
              for (const [key, value] of Object.entries(options)) {
                this[key] = value;
              }
            }
          } catch (e) {
            console.log('A LayerDetailView failed to initialize. Error message: ' + e);
          }

        },

        /**
        * Renders this view
        * @return {LayerDetailView} Returns the rendered view element
        */
        render: function () {

          try {

            // Save a reference to this view
            var view = this;
            
            // Ensure the view's main element has the given class name
            this.el.classList.add(this.className);

            // Display the section's contents depending on the view's initial setting
            if (this.isOpen) {
              this.el.classList.add(this.classes.open);
            }

            // Insert the template into the view
            this.$el.html(this.template({
              label: this.label
            }));

            // Render the content for this Layer Detail section
            if (this.contentView) {
              var contentContainer = this.el.querySelector(
                '.' + this.classes.contentContainer
              )
              var subView = new this.contentView({
                model: this.model
              })
              contentContainer.append(subView.el)
              subView.render()
            }

            return this

          }
          catch (error) {
            console.log(
              'There was an error rendering a LayerDetailView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Show or hide this section's contents by adding or removing the open class.
         */
        toggle : function(){
          try {
            this.el.classList.toggle(this.classes.open)
            if (this.isOpen) {
              this.isOpen = false
            } else {
              this.isOpen = true
            }
          }
          catch (error) {
            console.log(
              'There was an error toggling a LayerDetailView' +
              '. Error details: ' + error
            );
          }
        },

      }
    );

    return LayerDetailView;

  }
);
