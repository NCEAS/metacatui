
'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'text!templates/maps/toolbar.html',
    'models/maps/Map',
    // Sub-views - TODO: import these as needed
    'views/maps/LayerListView',
    'views/maps/DrawToolView'
  ],
  function (
    $,
    _,
    Backbone,
    Template,
    Map,
    // Sub-views
    LayerListView,
    DrawTool
  ) {

    /**
    * @class ToolbarView
    * @classdesc The map toolbar view is a side bar that contains information about a map,
    * including the available layers, plus UI for changing the settings of a map.
    * @classcategory Views/Maps
    * @name ToolbarView
    * @extends Backbone.View
    * @screenshot views/maps/ToolbarView.png
    * @since 2.18.0
    * @constructs
    */
    var ToolbarView = Backbone.View.extend(
      /** @lends ToolbarView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'ToolbarView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'toolbar',

        /**
        * The model that this view uses
        * @type {Map}
        */
        model: null,

        /**
         * The primary HTML template for this view. The template must have three element,
         * one with the contentContainer class, one with the linksContainer class, and one
         * with the toggle class. See {@link ToolbarView#classes}.
         * @type {Underscore.template}
         */
        template: _.template(Template),

        /**
         * The classes of the sub-elements that combined to create a toolbar view.
         *
         * @name ToolbarView#classes
         * @type {Object}
         * @property {string} open The class to add to the view when the toolbar is open
         * (and the content is visible)
         * @property {string} contentContainer The element that contains all containers
         * for the toolbar section content. This element must be part of this view's
         * template.
         * @property {string} toggle The element in the template that acts as a toggle to
         * close the toolbar.
         * @property {string} linksContainer The container for all of the section links
         * (i.e. tabs)
         * @property {string} link A section link
         * @property {string} linkTitle The section link title
         * @property {string} linkIcon The section link icon
         * @property {string} linkActive The class to add to a link when its content is
         * active
         * @property {string} content A section's content. This element will be the
         * container for the view associated with this section.
         * @property {string} contentActive A class added to a content container when it
         * is the active section
         */
        classes: {
          open: 'toolbar--open',
          contentContainer: 'toolbar__all-content',
          toggle: 'toolbar__toggle',
          linksContainer: 'toolbar__links',
          link: 'toolbar__link',
          linkTitle: 'toolbar__link-title',
          linkIcon: 'toolbar__link-icon',
          linkActive: 'toolbar__link--active',
          content: 'toolbar__content',
          contentActive: 'toolbar__content--active'
        },

        /**
        * Creates an object that gives the events this view will listen to and the
        * associated function to call. Each entry in the object has the format 'event
        * selector': 'function'.
        * @returns {Object}
        */
        events: function () {
          var events = {};
          // Close the toolbar when the toggle button is clicked. Get the class of the
          // toggle button from the classes property set in this view.
          events['click .' + this.classes.toggle] = 'close'
          return events
        },

        /**
         * A string that represents an icon. Can be either the name of the Font Awesome
         * 3.2 icon OR an SVG string for an icon with all the following properties: 1)
         * Uses viewBox attribute and not width/height; 2) Sets fill or stroke to
         * "currentColor" in the svg element, no styles included elsewhere, 3) Has the
         * required xmlns attribute
         *
         * @typedef {string} MapIconString
         *
         * @see {@link https://fontawesome.com/v3.2/icons/}
         *
         * @example
         * '<svg viewBox="0 0 400 110" fill="currentColor"><path d="M0 0h300v100H0z"/></svg>'
         * @example
         * 'map-marker'
         */

        /**
         * Options/settings that are used to create a toolbar section and its associated
         * link/tab.
         *
         * @typedef {Object} SectionOption
         * @property {string} label The name of this section to show to the user.
         * @property {MapIconString} icon The icon to show in the link (tab) for this
         * section
         * @property {Backbone.View} [view] The view that renders the content of the
         * toolbar section.
         * @property {object} [viewOptions] Any additional options to pass to the content
         * view. By default, the label, icon, and Map model will be passed to the view as
         * 'label', 'icon', and 'model', respectively. To pass a specific attribute from
         * the Map model, use a string with the syntax 'model.desiredAttribute'. For
         * example, 'model.layers' will be converted to view.model.get('layers')
         * @property {function} [action] A function to call when the link/tab is clicked.
         * This can be provided instead of a view and viewOptions, in which case no
         * toolbar section will be created. The function will be passed the view and the
         * Map model as arguments.
         */

        /**
         * The sections displayed in the toolbar will be created based on the options set
         * in this array.
         * 
         * @type {SectionOption[]}
         */
        sections: [
          {
            label: 'Layers',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="m3.2 7.3 8.6 4.6a.5.5 0 0 0 .4 0l8.6-4.6a.4.4 0 0 0 0-.8L12.1 3a.5.5 0 0 0-.4 0L3.3 6.5a.4.4 0 0 0 0 .8Z"/><path d="M20.7 10.7 19 9.9l-6.7 3.6a.5.5 0 0 1-.4 0L5 9.9l-1.8.8a.5.5 0 0 0 0 .8l8.5 5a.5.5 0 0 0 .5 0l8.5-5a.5.5 0 0 0 0-.8Z"/><path d="m20.7 15.1-1.5-.7-7 3.8a.5.5 0 0 1-.4 0l-7-3.8-1.5.7a.5.5 0 0 0 0 .9l8.5 5a.5.5 0 0 0 .5 0l8.5-5a.5.5 0 0 0 0-.9Z"/></svg>',
            view: LayerListView,
            viewOptions: {
              model: null,
              collection: 'model.layers'
            }
          },
          {
            label: 'Home',
            icon: 'home',
            action: function (view, model) {
              model.flyHome();
            }
          },
          {
            label: 'Draw',
            icon: 'pencil',
            view: DrawTool,
            viewOptions: {}
          }
        ],

        /**
         * Whether or not the toolbar menu is opened. This will get updated when the user
         * interacts with the toolbar links.
         * @type {Boolean}
         */
        isOpen: false,

        /**
        * Executed when a new ToolbarView is created
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
            if (!this.model || !(this.model instanceof Map)) {
              this.model = new Map();
            }
            if(this.model.get('toolbarOpen') === true) {
              this.isOpen = true;
            }
            if (this.model.get("showLayerList") === false) {
              this.sections = this.sections.filter(
                (section) => section.label !== "Layers"
              );
            }
            if (this.model.get("showHomeButton") === false) {
              this.sections = this.sections.filter(
                (section) => section.label !== "Home"
              );
            }
          } catch (e) {
            console.log('A ToolbarView failed to initialize. Error message: ' + e);
          }

        },

        /**
        * Renders this view
        * @return {ToolbarView} Returns the rendered view element
        */
        render: function () {

          try {

            // Save a reference to this view
            var view = this;

            // Insert the template into the view
            this.$el.html(this.template({}));

            // Ensure the view's main element has the given class name
            this.el.classList.add(this.className);

            // Select and save a reference to the elements that will contain the
            // links/tabs and the section content.
            this.contentContainer = document.querySelector(
              '.' + view.classes.contentContainer
            )
            this.linksContainer = document.querySelector(
              '.' + view.classes.linksContainer
            )

            // sectionElements will store the section link, section content element, and
            // the status of the given section (whether it is active or not)
            this.sectionElements = [];

            // For each section configured in the view's sections property, create a link
            // and render the content. Set a listener for when the link is clicked. 
            this.sections.forEach(function (sectionOption) {
              // Render the link and content elements
              var linkEl = view.renderSectionLink(sectionOption)
              var action = sectionOption.action
              let contentEl = null;
              if (sectionOption.view) {
                contentEl = view.renderSectionContent(sectionOption)
              }
              // Set the section to false to start
              var isActive = false
              // Save a reference to these elements and their status. sectionEl is an
              // object that has type SectionElement (documented in comments below)
              var sectionEl = { linkEl, contentEl, isActive, action }
              view.sectionElements.push(sectionEl)
              // Attach the link and content to the view
              if (contentEl) {
                view.contentContainer.appendChild(contentEl);
              }
              view.linksContainer.appendChild(linkEl);
              // Add a listener that shows the section when the link is clicked
              linkEl.addEventListener('click', function () {
                view.handleLinkClick(sectionEl)
              });
            })

            // Set the toolbar to open, depending on what is initially set in view.isOpen.
            // Set the first section to active if the toolbar is open.
            if (this.isOpen) {
              this.el.classList.add(this.classes.open)
              view.handleLinkClick(this.sectionElements[0])
            }

            return this

          }
          catch (error) {
            console.log(
              'There was an error rendering a ToolbarView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * A reference to all of the elements required to make up a toolbar section: the
         * section content and the section link (i.e. tab); as well as the status of the
         * section: active or in active.
         *
         * @typedef {Object} SectionElement
         * @property {HTMLElement} contentEl The element that contains the toolbar
         * section's content (the content rendered by the associated view)
         * @property {HTMLElement} linkEl The element that acts as a link to show the
         * section's content, and open/close the toolbar.
         * @property {Boolean} isActive True if this is the active section, false
         * otherwise.
         */

        /**
         * Executed when any one of the tabs/links are clicked. Opens the toolbar if it's
         * closed, closes it if the active section is clicked, and otherwise activates the
         * clicked section content.
         * @param {SectionElement} sectionEl
         */
        handleLinkClick: function (sectionEl) {
          try {
            var toolbarOpen = this.isOpen;
            var sectionActive = sectionEl.isActive;
            if (toolbarOpen && sectionActive) {
              this.close()
              return
            }
            if (!toolbarOpen && sectionEl.contentEl) {
              this.open()
            }
            if (!sectionActive) {
              if (sectionEl.contentEl) {
                this.inactivateAllSections()
              }
              this.activateSection(sectionEl)
            }
          }
          catch (error) {
            console.log(
              'There was an error handling a toolbar link click in a ToolbarView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Creates a link/tab for a given toolbar section
         * @param {SectionOption} sectionOption The label and icon that are set in the
         * Section Option are used to create the link content
         * @returns {HTMLElement} Returns the link element
         */
        renderSectionLink: function (sectionOption) {
          try {

            // Create a container, label
            const link = document.createElement('div')
            const title = document.createElement('div')
            // Create the icon
            const icon = this.createIcon(sectionOption.icon)

            // Add the relevant classes
            link.classList.add(this.classes.link)
            title.classList.add(this.classes.linkTitle)
            // Add the label text
            title.textContent = sectionOption.label

            link.append(icon, title)

            return link
          }
          catch (error) {
            console.log(
              'There was an error rendering a section link in a ToolbarView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Given the name of a Font Awesome 3.2 icon, or an SVG string, creates an icon
         * element with the appropriate classes for the tool bar link (tab)
         * @param {MapIconString} iconString The string to use to create the icon
         * @returns {HTMLElement} Returns either an <i> element with a Font Awesome icon,
         * or and SVG with a custom icon
         */
        createIcon: function (iconString) {
          try {
            // The icon element we will create and return. By default, return an empty span
            // element.
            let icon = document.createElement('span');

            // iconString must be string
            if (typeof iconString === 'string') {

              // Simple test to check if the string contains SVG content
              const isSVG = iconString.toUpperCase().startsWith('<SVG');

              // If the icon is an SVG element
              if (isSVG) {
                icon = new DOMParser()
                  .parseFromString(iconString, 'image/svg+xml')
                  .documentElement;
                // If the icon is not an SVG, assume it's the name for a Font Awesome icon
              } else {
                icon = document.createElement('i')
                icon.className = 'icon-' + iconString;
              }

            }
            icon.classList.add(this.classes.linkIcon);
            return icon
          }
          catch (error) {
            console.log(
              'There was an error  in a ToolbarView' +
              '. Error details: ' + error
            );
            return document.createElement('span')
          }
        },

        /**
         * Creates a container for a toolbar section's content, then rendered the
         * specified view in that container.
         * @param {SectionOption} sectionOption The view and view options that are set in
         * the Section Option are used to create the content container
         * @returns {HTMLElement} Returns the content container with the rendered view
         */
        renderSectionContent: function (sectionOption) {
          try {
            const view = this
            // Create the container for the toolbar section content
            var contentContainer = document.createElement('div')
            // Add the class that identifies a toolbar section's content
            contentContainer.classList.add(this.classes.content)
            // Render the toolbar section view
            // Merge the icon and label with the other section options
            var viewOptions = Object.assign(
              {
                label: sectionOption.label,
                icon: sectionOption.icon,
                model: this.model
              },
              sectionOption.viewOptions
            )
            // Convert any values in the form of 'model.someAttribute' to the model
            // attribute that is specified.
            for (const [key, value] of Object.entries(viewOptions)) {
              if (typeof value === 'string' && value.startsWith('model.')) {
                const attr = value.replace(/^model\./, '')
                viewOptions[key] = view.model.get(attr)
              }
            }
            var sectionContent = new sectionOption.view(viewOptions)
            contentContainer.appendChild(sectionContent.el)
            sectionContent.render()
            return contentContainer
          }
          catch (error) {
            console.log(
              'There was an error rendering section content in a ToolbarView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Opens the toolbar and displays the content of the active toolbar section
         */
        open: function () {
          try {
            this.isOpen = true
            this.el.classList.add(this.classes.open)
          }
          catch (error) {
            console.log(
              'There was an error opening a ToolbarView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Closes the toolbar. Also inactivates all sections.
         */
        close: function () {
          try {
            this.isOpen = false
            this.el.classList.remove(this.classes.open)
            // Ensure that no section is active when the toolbar is closed
            this.inactivateAllSections()
          }
          catch (error) {
            console.log(
              'There was an error closing a ToolbarView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Display the content of a given section
         * @param {SectionElement} sectionEl The section to activate
         */
        activateSection: function (sectionEl) {
          try {
            if (sectionEl.action && typeof sectionEl.action === 'function') {
              const view = this;
              const model = this.model;
              sectionEl.action(view, model)
            } else {
              sectionEl.isActive = true;
              sectionEl.contentEl.classList.add(this.classes.contentActive)
              sectionEl.linkEl.classList.add(this.classes.linkActive)
            }
          }
          catch (error) {
            console.log(
              'There was an error showing a toolbar section in a ToolbarView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Hide the content of a section
         * @param {SectionElement} sectionEl The section to inactivate
         */
        inactivateSection: function (sectionEl) {
          try {
            sectionEl.isActive = false;
            if (sectionEl.contentEl) {
              sectionEl.contentEl.classList.remove(this.classes.contentActive)
              sectionEl.linkEl.classList.remove(this.classes.linkActive)
            }
          }
          catch (error) {
            console.log(
              'There was an error showing a toolbar section in a ToolbarView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Hide all of the sections in a toolbar view
         */
        inactivateAllSections: function () {
          try {
            var view = this;
            this.sectionElements.forEach(function (sectionEl) {
              view.inactivateSection(sectionEl)
            })
          }
          catch (error) {
            console.log(
              'There was an error hiding toolbar sections in a ToolbarView' +
              '. Error details: ' + error
            );
          }
        },

      }
    );

    return ToolbarView;

  }
);
