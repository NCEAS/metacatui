
'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/Feature',
    'text!templates/maps/feature-info.html'
  ],
  function (
    $,
    _,
    Backbone,
    Feature,
    Template
  ) {

    /**
    * @class FeatureInfoView
    * @classdesc An info-box / panel that shows more details about a specific geo-spatial
    * feature that is highlighted or in focus in a Map View. Details displayed include a
    * table of attributes that are set on that feature, and a link to view more
    * information about the Map Asset (e.g. 3D tileset) that contains the feature. The
    * title of the panel will use the value of the feature's 'name', 'title', 'id', or
    * 'identifier' property, if it has one (case insensitive). Otherwise, it will use the
    * 'assetId' in the Feature model (an ID used by the map widget.)
    * @classcategory Views/Maps
    * @name FeatureInfoView
    * @extends Backbone.View
    * @screenshot maps/FeatureInfoView.png // TODO: add screenshot
    * @constructs
    */
    var FeatureInfoView = Backbone.View.extend(
      /** @lends FeatureInfoView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'FeatureInfoView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'feature-info',

        /**
        * The model that this view uses
        * @type {Feature}
        */
        model: undefined,

        /**
         * The primary HTML template for this view
         * @type {Underscore.template}
         */
        template: _.template(Template),

        /**
        * Creates an object that gives the events this view will listen to and the
        * associated function to call. Each entry in the object has the format 'event
        * selector': 'function'.
        * @returns {Object}
        */
        events: function () {
          var events = {};
          // Close the layer details panel when the toggle button is clicked. Get the
          // class of the toggle button from the classes property set in this view.
          events['click .' + this.classes.toggle] = 'close'
          // Open the Layer Details panel
          events['click .' + this.classes.layerDetailsButton] = 'showLayerDetails'
          return events
        },

        /**
         * Classes that are used to identify the HTML elements that comprise this view.
         * @type {Object}
         * @property {string} open The class to add to the outermost HTML element for this
         * view when the layer details view is open/expanded (not hidden)
         * @property {string} toggle The element in the template that acts as a toggle to
         * close/hide the info view
         * @property {string} layerDetailsButton The layer details button is added to the
         * view when the selected feature is associated with a layer (a MapAsset like a 3D
         * tileset). When clicked, it opens the LayerDetailsView for that layer.
         */
        classes: {
          open: 'feature-info--open',
          toggle: 'feature-info__toggle',
          layerDetailsButton: 'feature-info__layer-details-button'
        },

        /**
         * Whether or not the layer details view is open
         * @type {Boolean}
         */
        isOpen: false,

        /**
        * Executed when a new FeatureInfoView is created
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
            console.log('A FeatureInfoView failed to initialize. Error message: ' + e);
          }

        },

        /**
        * Renders this view
        * @return {FeatureInfoView} Returns the rendered view element
        */
        render: function () {

          try {

            // Show the feature info box as open if the view is set to have it open
            // already
            if (this.isOpen) {
              this.el.classList.add(this.classes.open);
            }

            this.renderContent()

            // Ensure the view's main element has the given class name
            this.el.classList.add(this.className);

            // When the model changes, update the view
            this.stopListening(this.model, 'change')
            this.listenTo(this.model, 'change', this.update)

            return this

          }
          catch (error) {
            console.log(
              'There was an error rendering a FeatureInfoView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Render or re-render the attributes table and layer details button.
         */
        renderContent: function () {
          try {
            const classes = this.classes;
            let title = 'Feature';
            let properties = null;
            let showLayerDetailsButton = false;

            if (this.model) {

              // Get the layer/mapAsset model
              const mapAsset = this.model.get('mapAsset')
              // Get the properties to show in the table
              properties = this.model.get('properties') ?? {}

              // Show a link to open the details for the feature's parent layer
              if (mapAsset) {
                showLayerDetailsButton = true;
              }

              // Create a title for the feature info box
              let label = mapAsset ? mapAsset.get('label') : null;

              // Check if the feature has a name, title, ID, or identifier property.
              // Search for these properties independent of case. If none of these
              // properties exist, use the feature ID provided by the model.
              let searchKeys = ['name', 'title', 'id', 'identifier']
              searchKeys = searchKeys.map(key => key.toLowerCase());
              const propKeys = Object.keys(properties)
              const propKeysLower = propKeys.map(key => key.toLowerCase());

              // Search by search key, since search keys are in order of preference. Find
              // the first matching key.
              const nameKeyLower = searchKeys.find(function (searchKey) {
                return propKeysLower.includes(searchKey)
              });

              // Then figure out which of the original property keys matches (we need it
              // in the original case).
              const nameKey = propKeys[propKeysLower.indexOf(nameKeyLower)]

              const name = properties[nameKey] ?? this.model.get('featureID');

              if (name) {
                title = title + ' ' + name
              }
              
              if (label) {
                title = title + ' from ' + label + ' Layer'
              }

            }

            // Insert the template into the view
            this.$el.html(this.template({
              classes: classes,
              title: title,
              properties: properties,
              showLayerDetailsButton: showLayerDetailsButton
            }));
          }
          catch (error) {
            console.log(
              'There was an error rendering the content of a FeatureInfoView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Show details about the layer that contains this feature. The function does this
         * by setting the associated layer model's 'selected' attribute to true. The
         * parent Map view has a listener set to show the Layer Details view when this
         * attribute is changed.
         */
        showLayerDetails: function () {
          try {
            if (this.model && this.model.get('mapAsset')) {
              this.model.get('mapAsset').set('selected', true)
            }
          }
          catch (error) {
            console.log(
              'There was an error showing the layer details panel from a FeatureInfoView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Shows the feature info box
         */
        open: function () {
          try {
            this.el.classList.add(this.classes.open);
            this.isOpen = true;
          }
          catch (error) {
            console.log(
              'There was an error showing the FeatureInfoView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Hide the feature info box from view
         */
        close: function () {
          try {
            this.el.classList.remove(this.classes.open);
            this.isOpen = false;
          }
          catch (error) {
            console.log(
              'There was an error hiding the FeatureInfoView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Update the content that's displayed in a feature info box, based on the
         * information in the Feature model. Open the panel if there is a Feature model,
         * or close it if there is no model or the model has only default values.
         */
        update: function () {
          try {
            if (!this.model || this.model.isDefault()) {
              this.close()
            } else {
              this.open()
              this.renderContent()
            }
          }
          catch (error) {
            console.log(
              'There was an error updating the content of a FeatureInfoView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Stops listening to the previously set model, replaces it with a new Feature
         * model, re-sets the listeners and re-renders the content in this view based on
         * the new model.
         * @param {Feature} newModel The new Feature model to display content for
         */
        changeModel: function (newModel) {
          // Stop listening to the current model before it's removed
          this.stopListening(this.model, 'change')
          // Update the model
          this.model = newModel
          // Listen to the new model
          this.listenTo(this.model, 'change', this.update)
          // Update
          this.update()
        }

      }
    );

    return FeatureInfoView;

  }
);
