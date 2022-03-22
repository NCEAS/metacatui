
'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/assets/MapAsset',
    'text!templates/maps/layer-item.html',
    // Sub-views
    'views/maps/LegendView'
  ],
  function (
    $,
    _,
    Backbone,
    MapAsset,
    Template,
    // Sub-views
    Legend
  ) {

    /**
    * @class LayerItemView
    * @classdesc One item in a Layer List: shows some basic information about the Map
    * Asset (Layer), including label and icon. Also has a button that changes the
    * visibility of the Layer of the map (by updating the 'visibility' attribute in the
    * MapAsset model). Clicking on the Layer Item opens the Layer Details panel (by
    * setting the 'selected' attribute to true in the Layer model.) Additionally, shows a
    * small preview of a legend for the data that's on the map.
    * @classcategory Views/Maps
    * @name LayerItemView
    * @extends Backbone.View
    * @screenshot views/maps/LayerItemView.png
    * @since 2.18.0
    * @constructs
    */
    var LayerItemView = Backbone.View.extend(
      /** @lends LayerItemView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'LayerItemView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'layer-item',

        /**
        * The model that this view uses
        * @type {MapAsset}
        */
        model: undefined,

        /**
         * The primary HTML template for this view
         * @type {Underscore.template}
         */
        template: _.template(Template),

        /**
         * Classes that are used to identify or create the HTML elements that comprise this
         * view.
         * @type {Object}
         * @property {string} label The element that contains the layer's name/label
         * @property {string} icon The span element that contains the SVG icon
         * @property {string} visibilityToggle The element that acts like a button to
         * switch the Layer's visibility on and off
         * @property {string} legendContainer The element that the legend preview will be
         * inserted into.
         * @property {string} selected The class that gets added to the view when the Layer
         * Item is selected
         * @property {string} hidden The class that gets added to the view when the Layer
         * Item is not visible
         * @property {string} badge The class to add to the badge element that is shown
         * when the layer has a notification message
         * @property {string} tooltip Class added to tooltips used in this view
         */
        classes: {
          label: 'layer-item__label',
          icon: 'layer-item__icon',
          visibilityToggle: 'layer-item__visibility-toggle',
          legendContainer: 'layer-item__legend-container',
          selected: 'layer-item--selected',
          hidden: 'layer-item--hidden',
          badge: 'map-view__badge',
          tooltip: 'map-tooltip',
        },

        /**
         * The text to show in a tooltip when the MapAsset's status is set to 'error'. If
         * the model also has a 'statusMessage', that will be appended to the end of this
         * error message.
         * @type {string}
         */
        errorMessage: 'There was a problem showing this layer.',

        /**
        * A function that gives the events this view will listen to and the associated
        * function to call.
        * @returns {Object} Returns an object with events in the format 'event selector':
        * 'function'
        */
        events: function () {
          try {
            var events = {}
            events['click .' + this.classes.label] = 'toggleSelected';
            events['click .' + this.classes.visibilityToggle] = 'toggleVisibility';
            return events
          }
          catch (error) {
            console.log(
              'There was an error setting the events object in a LayerItemView' +
              '. Error details: ' + error
            );
          }
        },

        /**
        * Executed when a new LayerItemView is created
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
            console.log('A LayerItemView failed to initialize. Error message: ' + e);
          }

        },

        /**
        * Renders this view
        * @return {LayerItemView} Returns the rendered view element
        */
        render: function () {

          try {

            // Save a reference to this view
            var view = this;

            if (!this.model) {
              return
            }

            // Insert the template into the view
            this.$el.html(this.template({
              label: this.model.get('label')
            }));
            // Save a reference to the label element
            this.labelEl = this.el.querySelector('.' + this.classes.label)

            // Insert the icon on the left
            this.insertIcon()

            // Add a thumbnail / legend preview
            const legendContainer = this.el.querySelector('.' + this.classes.legendContainer)
            const legendPreview = new Legend({
              model: this.model,
              mode: 'preview'
            })
            legendContainer.append(legendPreview.render().el)

            // Ensure the view's main element has the given class name
            this.el.classList.add(this.className);

            // Show the item as hidden and/or selected depending on the model properties
            // that are set initially
            this.showVisibility()
            this.showSelection()
            // Show the current status of this layer
            this.showStatus()

            // When the Layer is selected, highlight this item in the Layer List. When
            // it's no longer selected, then make sure it's no longer highlighted. Set a
            // listener because the 'selected' attribute can be changed within this view,
            // from the parent Layers collection, or from the Layer Details View.
            this.stopListening(this.model, 'change:selected')
            this.listenTo(this.model, 'change:selected', this.showSelection)

            // Similar to above, add or remove the hidden class when the layer's
            // visibility changes
            this.stopListening(this.model, 'change:visible')
            this.listenTo(this.model, 'change:visible', this.showVisibility)

            // Update the item in the list to show when it is loading, loaded, or there's
            // been an error.
            this.stopListening(this.model, 'change:status')
            this.listenTo(this.model, 'change:status', this.showStatus);

            return this

          }
          catch (error) {
            console.log(
              'There was an error rendering a LayerItemView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Waits for the icon attribute to be ready in the Map Asset model, then inserts
         * the icon before the label.
         */
        insertIcon: function () {
          try {
            const model = this.model;
            const iconStatus = model.get('iconStatus')
            if (iconStatus && iconStatus === 'fetching') {
              this.listenToOnce(model, 'change:iconStatus', this.insertIcon)
              return
            }
            if (iconStatus === 'error') {
              return
            }
            const icon = model.get('icon')
            if (icon && typeof icon === 'string' && model.isSVG(icon)) {
              const iconContainer = document.createElement('span')
              iconContainer.classList.add(this.classes.icon)
              iconContainer.innerHTML = icon
              this.el.querySelector('.' + this.classes.label).prepend(iconContainer)
            }
          }
          catch (error) {
            console.log(
              'There was an error inserting an icon in a LayerItemView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Sets the Layer model's 'selected' status attribute to true if it's false, and
         * to false if it's true. Executed when a user clicks on this Layer Item in a
         * Layer List view.
         */
        toggleSelected: function () {
          try {
            var layerModel = this.model;
            var currentStatus = layerModel.get('selected');
            if (currentStatus === true) {
              layerModel.set('selected', false);
            } else {
              layerModel.set('selected', true);
            }
          }
          catch (error) {
            console.log(
              'There was an error selecting or unselecting a layer in a LayerItemView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Sets the Layer model's visibility status attribute to true if it's false, and
         * to false if it's true. Executed when a user clicks on the visibility toggle.
         */
        toggleVisibility: function () {
          try {
            var layerModel = this.model;
            var currentStatus = layerModel.get('visible');
            if (currentStatus === true) {
              layerModel.set('visible', false);
            } else {
              layerModel.set('visible', true);
            }
          }
          catch (error) {
            console.log(
              'There was an error selecting or unselecting a layer in a LayerItemView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Highlight/emphasize this item in the Layer List when it is selected (i.e. when
         * the Layer model's 'selected' attribute is set to true). If it is not selected,
         * then remove any highlighting. This function is executed whenever the model's
         * 'selected' attribute changes. It can be changed from within this view (with the
         * toggleSelected function), from the parent Layers collection, or from the
         * Layer Details View.
         */
        showSelection: function () {
          try {
            var layerModel = this.model;
            var currentStatus = layerModel.get('selected');
            if (currentStatus === true) {
              this.el.classList.add(this.classes.selected)
            } else {
              this.el.classList.remove(this.classes.selected)
            }
          }
          catch (error) {
            console.log(
              'There was an error changing the highlighting in a LayerItemView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Add or remove styles that indicate that the layer is hidden based on what is
         * set in the Layer model's 'visible' attribute. Executed whenever the 'visible'
         * attribute changes.
         */
        showVisibility: function () {
          try {
            var layerModel = this.model;
            var currentStatus = layerModel.get('visible');
            if (currentStatus === true) {
              this.el.classList.remove(this.classes.hidden)
            } else {
              this.el.classList.add(this.classes.hidden)
            }
          }
          catch (error) {
            console.log(
              'There was an error changing the hidden styles in a LayerItemView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Gets the Map Asset model's status and updates this Layer Item View to reflect
         * that status to the user.
         */
        showStatus: function () {
          try {
            var layerModel = this.model;
            var status = layerModel.get('status');
            if (status === 'error') {
              const errorMessage = layerModel.get('statusDetails')
              this.showError(errorMessage)
            } else if (status === 'ready') {
              this.removeStatuses()
              const notice = layerModel.get('notification')
              const badge = notice ? notice.badge : null
              if (badge) {
                this.showBadge(badge, notice.style)
              }
            } else if (status === 'loading') {
              this.showLoading()
            }
          }
          catch (error) {
            console.log(
              'There was an error showing the status in a LayerItemView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Remove any icons, tooltips, or other visual indicators of a Map Asset's error
         * or loading status in this view
         */
        removeStatuses: function () {
          try {
            if (this.statusIcon) {
              this.statusIcon.remove()
            }
            if (this.badge) {
              this.badge.remove()
            }
            this.$el.tooltip('destroy')
          }
          catch (error) {
            console.log(
              'There was an error removing status indicators in a LayerItemView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Create a badge element and insert it to the right of the layer label.
         * @param {string} text - The text to display in the badge
         * @param {string} [style] - The style of the badge. Can be any of the styles
         * defined in the {@link MapConfig#Notification} style property, e.g. 'green'
         */
        showBadge: function (text, style) {
          try {
            if (!text) {
              return
            }
            this.removeStatuses();
            this.badge = document.createElement('span')
            this.badge.classList.add(this.classes.badge)
            this.badge.innerText = text
            this.labelEl.append(this.badge)
            if (style) {
              const badgeClass = this.classes.badge + '--' + style
              this.badge.classList.add(badgeClass)
            }
          } catch (error) {
            console.log(
              'There was an error showing the badge in a LayerItemView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Indicate to the user that there was a problem showing or loading this error.
         * Shows a 'warning' icon to the right of the label for the asset and a tooltip
         * with more details
         * @param {string} message The error message to show in the tooltip.
         */
        showError: function (message='') {
          try {
            const view = this

            // Remove any style elements for other statuses
            this.removeStatuses()

            // Show a warning icon
            this.statusIcon = document.createElement('span')
            this.statusIcon.innerHTML = `<i class="icon-warning-sign icon icon-on-right"></i>`
            this.statusIcon.style.opacity = '0.6'
            this.labelEl.append(this.statusIcon)

            // Show a tooltip with the error message
            let fullMessage = this.errorMessage
            if (message) {
              fullMessage = fullMessage + ' Error details: ' + message
            }
            this.$el.tooltip({
              placement: 'top',
              trigger: 'hover',
              title: fullMessage,
              container: 'body',
              animation: false,
              template: '<div class="tooltip ' +
                view.classes.tooltip +
                '"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>',
              delay: { show: 250, hide: 5 }
            })

          }
          catch (error) {
            console.log(
              'Failed to show the error status in a LayerItemView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Show a spinner icon to the right of the Map Asset label to indicate that this
         * layer is loading
         */
        showLoading: function() {
          try {
            // Remove any style elements for other statuses
            this.removeStatuses()

            // Show a spinner icon
            this.statusIcon = document.createElement('span')
            this.statusIcon.innerHTML = `<i class="icon-spinner icon-spin icon-small loading icon icon-on-right"></i>`
            this.statusIcon.style.opacity = '0.6'
            this.labelEl.append(this.statusIcon)
          }
          catch (error) {
            console.log(
              'There was an error showing the loading status in a LayerItemView' +
              '. Error details: ' + error
            );
          }
        }


      }
    );

    return LayerItemView;

  }
);
