
'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/Feature',
    'text!templates/maps/feature-info/feature-info.html'
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
    * feature that is highlighted or in focus in a Map View, as specified by a given
    * {@link Feature} model. The format and content of the info-box varies based on which
    * template is configured in the parent {@link MapAsset} model, but at a minimum a link
    * is included that opens the associated {@link LayerInfoView}. Unless otherwise
    * configured, the title of the panel will use the value of the feature's 'name',
    * 'title', 'id', 'identifier', or 'assetId' property, if it has one (case
    * insensitive).
    * @classcategory Views/Maps
    * @name FeatureInfoView
    * @extends Backbone.View
    * @screenshot views/maps/FeatureInfoView.png
    * @since 2.18.0
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
         * A ContentTemplate object specifies a single template designed to render
         * information about the Feature.
         * @typedef {Object} ContentTemplate
         * @since 2.x.x
         * @property {string} [name] - An identifier for this template.
         * @property {string[]} [options] - The list of keys (option names) that are
         * allowed for the given template. Only options with these keys will be passed to
         * the underscore.js template, regardless of what is configured in the
         * {@link MapConfig#FeatureTemplate}. When no options are specified, then the
         * entire Feature model will be passed to the template as JSON.
         * @property {string} template - The path to the HTML template. This will be used
         * with require() to load the template as needed.
         */

        /**
         * The list of available templates that format information about the Feature. The
         * last template in the list is the default template. It will be used when a
         * matching template is not found or one is not specified.
         * @type {ContentTemplate[]}
         * @since 2.x.x
         */
        contentTemplates: [
          {
            name: 'story',
            template: 'text!templates/maps/feature-info/story.html',
            options: ['title', 'subtitle', 'description', 'thumbnail', 'url', 'urlText']
          },
          {
            name: 'table',
            template: 'text!templates/maps/feature-info/table.html'
          }
        ],

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
         * @property {string} contentContainer The iframe that holds the content rendered
         * by the {@link FeatureInfoView#ContentTemplate}
         * @property {string} title The label/title at the very top of the Feature panel,
         * next to the close button.
         */
        classes: {
          open: 'feature-info--open',
          toggle: 'feature-info__toggle',
          layerDetailsButton: 'feature-info__layer-details-button',
          contentContainer: 'feature-info__content',
          title: 'feature-info__label'
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

            const view = this
            const classes = view.classes

            // Show the feature info box as open if the view is set to have it open
            // already
            if (view.isOpen) {
              view.el.classList.add(view.classes.open);
            }

            // Insert the principal template into the view
            view.$el.html(view.template({
              classes: classes
            }));

            const iFrame = view.el
              .querySelector('.' + classes.contentContainer);

            // Select the iFrame 
            const iFrameDoc = iFrame
              .contentWindow
              .document

            // Add a script that gets all of the CSS stylesheets from the parent and
            // applies them within the iFrame. Create a div within the iFrame to hold the 
            // feature info template content.
            iFrameDoc.open();
            iFrameDoc.write(`
              <div id="content"></div>
              <script type="text/javascript">
              window.onload = function() {
                  if (parent) {
                      var h = document.getElementsByTagName("head")[0];
                      var ss = parent.document.getElementsByTagName("style");
                      for (var i = 0; i < ss.length; i++)
                          h.appendChild(ss[i].cloneNode(true));
                  }
              }
              </script>
              <style>
                body {
                  background-color: transparent;
                  color: var(--map-col-text);
                  font-family: "Helvetica Nueue", "Helvetica", "Arial", "Lato", "sans serif";
                  margin: 0;
                  box-sizing: border-box;
                }
              </style>
            `);
            iFrameDoc.close();

            // Identify the elements from the template that will be updated when the 
            // Feature model changes
            view.elements = {
              title: view.el.querySelector('.' + classes.title),
              iFrame: iFrame,
              iFrameContentContainer: iFrameDoc.getElementById('content'),
              layerDetailsButton: view.el.querySelector('.' + classes.layerDetailsButton),
            }

            view.update();

            // Ensure the view's main element has the given class name
            view.el.classList.add(view.className);

            // When the model changes, update the view
            view.stopListening(view.model, 'change')
            view.listenTo(view.model, 'change', view.update)

            return view

          }
          catch (error) {
            console.log(
              'There was an error rendering a FeatureInfoView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Updates the view with information from the current Feature model
         */
        updateContent: function () {

          try {

            // Elements to update
            const title = this.getFeatureTitle()
            const iFrame = this.elements.iFrame
            const iFrameDiv = this.elements.iFrameContentContainer
            const layerDetailsButton = this.elements.layerDetailsButton
            const mapAsset = this.model.get('mapAsset')
            let mapAssetLabel = mapAsset ? mapAsset.get('label') : null
            const buttonDisplay = mapAsset ? null : 'none'
            const buttonText = 'See ' + mapAssetLabel + ' Layer Details'

            // Insert the title into the title element
            this.elements.title.innerHTML = title

            // Update the iFrame content
            iFrame.height = 0;
            this.getContent().then(function (html) {
              iFrameDiv.innerHTML = html;
              const maxHeight = window.innerHeight - 275;
              const scrollHeight = iFrame.contentWindow.document.body.scrollHeight + 5;
              iFrame.height = scrollHeight > maxHeight ? maxHeight : scrollHeight;
            })

            // Show or hide the layer details button, update the text
            layerDetailsButton.style.display = buttonDisplay
            layerDetailsButton.innerText = buttonText

          }
          catch (error) {
            console.log(
              'There was an error rendering the content of a FeatureInfoView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Get the inner HTML content to insert into the iFrame. The content will vary
         * based on the feature and if there is a template set on the parent Map Asset
         * model.
         * @since 2.x.x
         * @returns {Promise|null} Returns a promise that resolves to the content HTML
         * when ready, otherwise null
         */
        getContent: function () {
          try {

            let content = null;
            let templateOptions = this.model.toJSON();
            const mapAsset = this.model.get('mapAsset')
            const featureProperties = this.model.get('properties')
            const templateConfig = mapAsset ? mapAsset.get('featureTemplate') : null
            const propertyMap = templateConfig ? templateConfig.options : {}
            const templateName = templateConfig ? templateConfig.template : null;
            const contentTemplates = this.contentTemplates;

            // Given the name of a template configured in the MapAsset model, find the
            // matching template from the contentTemplates set on this view
            let contentTemplate = contentTemplates.find(
              template => template.name == templateName
            );
            if (!contentTemplate) {
              contentTemplate = contentTemplates[contentTemplates.length - 1];
            }

            // To get variables to pass to the template, there must be properties set on
            // the feature and the selected content template must accept options
            if (
              contentTemplate && contentTemplate.options &&
              templateConfig && templateConfig.options
            ) {
              templateOptions = {}
              contentTemplate.options.forEach(function (prop) {
                const key = propertyMap[prop]
                templateOptions[prop] = featureProperties[key] || ''
              })
            }

            // Return a promise that resolves to the content HTML
            return new Promise(function (resolve, reject) {
              if (contentTemplate) {
                require([contentTemplate.template], function (template) {
                  content = _.template(template)(templateOptions);
                  resolve(content);
                })
              } else {
                resolve(null);
              }
            })

          }
          catch (error) {
            console.log(
              'There was an error getting the content of a FeatureInfoView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Create a title for the feature info box
         * @since 2.x.x
         * @returns {string} The title for the feature info box
         */
        getFeatureTitle: function () {
          try {
            let title = '';
            let suffix = '';

            if (this.model) {

              // Get the layer/mapAsset model
              const mapAsset = this.model.get('mapAsset')

              const featureTemplate = mapAsset ? mapAsset.get('featureTemplate') : null;
              const properties = this.model.get('properties') ?? {};
              const assetName = mapAsset ? mapAsset.get('label') : null;
              let name = featureTemplate ? properties[featureTemplate.label] : this.model.get('label');

              // Build a title if the feature has no label. Check if the feature has a name,
              // title, ID, or identifier property. Search for these properties independent
              // of case. If none of these properties exist, use the feature ID provided by
              // the model.
              if (!name) {

                title = 'Feature';

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

                name = properties[nameKey] ?? this.model.get('featureID');

                if (assetName) {
                  suffix = ' from ' + assetName + ' Layer'
                }

              }
              if (name) {
                title = title + ' ' + name
              }
              if (suffix) {
                title = title + suffix
              }

            }

            // Do some basic sanitization of the title
            title = title.replace(/&/g, '&amp;')
            title = title.replace(/</g, '&lt;')
            title = title.replace(/>/g, '&gt;')
            title = title.replace(/"/g, '&quot;')
            title = title.replace(/'/g, '&#039;')

            return title
          }
          catch (error) {
            console.log(
              'There was an error making a title for the FeatureInfoView' +
              '. Error details: ' + error
            );
            return 'Feature'
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
            // When the feature info panel is closed, remove the Feature model from the
            // Features collection. This will trigger the map widget to remove
            // highlighting from the feature.
            if (this.model && this.model.collection) {
              this.model.collection.remove(this.model);
            }
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
              if (this.isOpen) {
                this.close()
              }
            } else {
              this.open()
              this.updateContent()
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
          this.stopListening(this.model, 'change')
          this.listenTo(this.model, 'change', this.update)
          // Update
          this.update()
        }

      }
    );

    return FeatureInfoView;

  }
);
