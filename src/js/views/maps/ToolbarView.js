"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "text!templates/maps/toolbar.html",
  "models/maps/Map",
  "common/IconUtilities",
  // Sub-views - TODO: import these as needed
  "views/maps/LayersPanelView",
  "views/maps/HelpPanelView",
  "views/maps/DrawToolView",
  "views/maps/DownloadPanelView",
  "views/maps/viewfinder/ViewfinderView",
  "views/maps/ShareUrlView",
], (
  $,
  _,
  Backbone,
  Template,
  Map,
  IconUtilities,
  // Sub-views
  LayersPanelView,
  HelpPanel,
  DrawTool,
  DownloadPanelView,
  ViewfinderView,
  ShareUrlView,
) => {
  /**
   * @class ToolbarView
   * @classdesc The map toolbar view is a side bar that contains information about a map,
   * including the available layers, plus UI for changing the settings of a map.
   * @classcategory Views/Maps
   * @name ToolbarView
   * @augments Backbone.View
   * @screenshot views/maps/ToolbarView.png
   * @since 2.18.0
   * @constructs
   */
  const ToolbarView = Backbone.View.extend(
    /** @lends ToolbarView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "ToolbarView",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "toolbar",

      /**
       * The model that this view uses
       * @type {Map}
       */
      model: null,

      /**
       * The primary HTML template for this view. The template must have two element,
       * one with the contentContainer class, and one with the linksContainer class.
       * See {@link ToolbarView#classes}.
       * @type {Underscore.template}
       */
      template: _.template(Template),

      /**
       * The classes of the sub-elements that combined to create a toolbar view.
       * @name ToolbarView#classes
       * @type {object}
       * @property {string} open The class to add to the view when the toolbar is open
       * (and the content is visible)
       * @property {string} contentContainer The element that contains all containers
       * for the toolbar section content. This element must be part of this view's
       * template.
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
        open: "toolbar--open",
        contentContainer: "toolbar__all-content",
        linksContainer: "toolbar__links",
        link: "toolbar__link",
        linkTitle: "toolbar__link-title",
        linkTitleHidden: "toolbar__link-title--hidden",
        linkIcon: "toolbar__link-icon",
        linkActive: "toolbar__link--active",
        content: "toolbar__content",
        contentActive: "toolbar__content--active",
        layerPanel: "layers-panel",
        drawButton: ".draw__button",
        drawButtonActive: "draw__button--active",
        drawToolPanel: ".draw__tool-panel",
        // drawContainer: "draw__all-content",
      },

      /**
       * A string that represents an icon. Can be either the name of the Font Awesome
       * 3.2 icon OR an SVG string for an icon with all the following properties: 1)
       * Uses viewBox attribute and not width/height; 2) Sets fill or stroke to
       * "currentColor" in the svg element, no styles included elsewhere, 3) Has the
       * required xmlns attribute
       * @typedef {string} MapIconString
       * @see {@link https://fontawesome.com/v3.2/icons/}
       * @example
       * '<svg viewBox="0 0 400 110" fill="currentColor"><path d="M0 0h300v100H0z"/></svg>'
       * @example
       * 'map-marker'
       */

      /**
       * Options/settings that are used to create a toolbar section and its associated
       * link/tab.
       * @typedef {object} SectionOption
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
       * @property {Function} [action] A function to call when the link/tab is clicked.
       * This can be provided instead of a view and viewOptions, in which case no
       * toolbar section will be created. The function will be passed the view and the
       * Map model as arguments.
       * @property {Function} [isVisible] A function that determines whether this
       * section should be visible in the toolbar.
       */

      /**
       * The sections displayed in the toolbar will be created based on the options set
       * in this array.
       * @type {SectionOption[]}
       */
      sectionOptions: [
        {
          label: "Viewfinder",
          icon: "globe",
          view: ViewfinderView,
          action(view, _model) {
            const sectionEl = this;
            view.defaultActivationAction(sectionEl);
            sectionEl.sectionView.focusInput();
          },
          isVisible(model) {
            return MetacatUI.mapKey && model.get("showViewfinder");
          },
        },
        {
          label: "Layers",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="m3.2 7.3 8.6 4.6a.5.5 0 0 0 .4 0l8.6-4.6a.4.4 0 0 0 0-.8L12.1 3a.5.5 0 0 0-.4 0L3.3 6.5a.4.4 0 0 0 0 .8Z"/><path d="M20.7 10.7 19 9.9l-6.7 3.6a.5.5 0 0 1-.4 0L5 9.9l-1.8.8a.5.5 0 0 0 0 .8l8.5 5a.5.5 0 0 0 .5 0l8.5-5a.5.5 0 0 0 0-.8Z"/><path d="m20.7 15.1-1.5-.7-7 3.8a.5.5 0 0 1-.4 0l-7-3.8-1.5.7a.5.5 0 0 0 0 .9l8.5 5a.5.5 0 0 0 .5 0l8.5-5a.5.5 0 0 0 0-.9Z"/></svg>',
          view: LayersPanelView,
          isVisible(model) {
            return model.get("showLayerList");
          },
        },
        {
          label: "Reset",
          icon: "rotate-left",
          action(view, model) {
            model.flyHome();
            model.resetLayerVisibility();
          },
          isVisible(model) {
            return model.get("showHomeButton");
          },
        },
        // We can enable to the draw tool once we have a use case for it
        {
          label: "Download",
          icon: "cloud-download",
          // view: DownloadTool,
          view: DownloadPanelView,
          viewOptions: {},
          // viewOptions: {
          //   showDownloadPanel: "model.showDownloadPanel",
          // }
        },
        {
          label: "Help",
          icon: "question-sign",
          view: HelpPanel,
          viewOptions: {
            showFeedback: "model.showFeedback",
            feedbackText: "model.feedbackText",
            showNavHelp: "model.showNavHelp",
          },
          isVisible(model) {
            return model.get("showNavHelp") || model.get("showFeedback");
          },
        },
        {
          label: "Share",
          icon: "link",
          action(view) {
            const title = this.linkEl.querySelector(
              `.${view.classes.linkTitle}`,
            );

            if (view.el.querySelector(".share-url")) {
              return;
            }

            const shareUrlView = new ShareUrlView({
              top: this.linkEl.offsetTop,
              left: this.linkEl.offsetLeft,
              onRemove() {
                title.classList.remove(view.classes.linkTitleHidden);
              },
            });
            shareUrlView.render();
            // Make sure link's tooltip is hidden while its popup is visible.
            title.classList.add(view.classes.linkTitleHidden);
            view.$el.append(shareUrlView.el);
          },
          isVisible(model) {
            return model.get("showShareUrl");
          },
        },
      ],

      /**
       * Whether or not the toolbar menu is opened. This will get updated when the user
       * interacts with the toolbar links.
       * @type {boolean}
       */
      isOpen: false,

      /**
       * Executed when a new ToolbarView is created
       * @param {object} [options] - A literal object with options to pass to the view
       */
      initialize(options) {
        // Get all the options and apply them to this view
        if (typeof options === "object") {
          Object.keys(options).forEach((key) => {
            this[key] = options[key];
          });
        }
        if (!this.model || !(this.model instanceof Map)) {
          this.model = new Map();
        }

        if (this.model.get("toolbarOpen") === true) {
          this.isOpen = true;
        }

        // Check whether each section should be shown, defaulting to true.
        this.sections = this.sectionOptions.filter((section) =>
          typeof section.isVisible === "function"
            ? section.isVisible(this.model)
            : true,
        );
      },

      /**
       * Renders this view
       * @returns {ToolbarView} Returns the rendered view element
       */
      render() {
        // Save a reference to this view
        const view = this;

        // Insert the template into the view
        this.$el.html(this.template({}));

        // Ensure the view's main element has the given class name
        this.el.classList.add(this.className);

        // Select and save a reference to the elements that will contain the
        // links/tabs and the section content.
        this.contentContainer = document.querySelector(
          `.${view.classes.contentContainer}`,
        );
        this.linksContainer = document.querySelector(
          `.${view.classes.linksContainer}`,
        );

        // sectionElements will store the section link, section content element, and
        // the status of the given section (whether it is active or not)
        this.sectionElements = [];

        // For each section configured in the view's sections property, create a link
        // and render the content. Set a listener for when the link is clicked.
        this.sections.forEach((sectionOption) => {
          // Render the link and content elements
          const linkEl = view.renderSectionLink(sectionOption);
          const { action } = sectionOption;
          let contentEl = null;
          let sectionView;
          if (sectionOption.view) {
            const { contentContainer, sectionContent } =
              view.renderSectionContent(sectionOption);
            contentEl = contentContainer;
            sectionView = sectionContent;
          }
          // Set the section to false to start
          const isActive = false;
          // Save a reference to these elements and their status. sectionEl is an
          // object that has type SectionElement (documented in comments below)
          const sectionEl = {
            linkEl,
            contentEl,
            isActive,
            action,
            sectionView,
          };
          view.sectionElements.push(sectionEl);
          // Attach the link and content to the view
          if (contentEl) {
            view.contentContainer.appendChild(contentEl);
          }
          view.linksContainer.appendChild(linkEl);
          // Add a listener that shows the section when the link is clicked
          linkEl.addEventListener("click", () => {
            view.handleLinkClick(sectionEl);
          });
        });

        // Set the toolbar to open, depending on what is initially set in view.isOpen.
        // Set the first section to active if the toolbar is open.
        if (this.isOpen) {
          this.el.classList.add(this.classes.open);
          view.handleLinkClick(this.sectionElements[0]);
        }

        return this;
      },

      /**
       * A reference to all of the elements required to make up a toolbar section: the
       * section content and the section link (i.e. tab); as well as the status of the
       * section: active or in active.
       * @typedef {object} SectionElement
       * @property {HTMLElement} contentEl The element that contains the toolbar
       * section's content (the content rendered by the associated view)
       * @property {HTMLElement} linkEl The element that acts as a link to show the
       * section's content, and open/close the toolbar.
       * @property {boolean} isActive True if this is the active section, false
       * otherwise.
       * @property {Backbone.View} sectionView The associated Backbone.View instance.
       */

      /**
       * Executed when any one of the tabs/links are clicked. Opens the toolbar if it's
       * closed, closes it if the active section is clicked, and otherwise activates the
       * clicked section content.
       * @param {SectionElement} sectionEl The section that was clicked
       */
      handleLinkClick(sectionEl) {
        const toolbarOpen = this.isOpen;
        let sectionActive = sectionEl.isActive;
        const drawPanel = document.querySelector(this.classes.drawToolPanel); // check if there is another way to get this from sectionEl
        const downloadPanel = document.querySelector(".download-panel");

        this.sectionElements.forEach((section) => {
          const els = section.contentEl?.querySelectorAll("*") || [];
          const hasLayerClass = Array.from(els).some((el) =>
            el.classList.contains("layers-panel"),
          );
          const hasDrawClass = Array.from(els).some((el) =>
            el.classList.contains("draw__tool-panel"),
          );
          if (hasLayerClass) {
            this.layerSection = section;
          }
          if (hasDrawClass) {
            this.drawSection = section;
          }
        });

        if (
          sectionEl.contentEl.querySelector(".draw__tool-panel") &&
          sectionActive
        ) {
          sectionActive = false;
        }
        if (
          toolbarOpen &&
          sectionActive &&
          !sectionEl.contentEl.querySelector(this.classes.drawToolPanel)
        ) {
          this.close();
          if (drawPanel.style.visibility === "visible") {
            drawPanel.style.visibility = "hidden";
            downloadPanel.style.visibility = "hidden";
            this.drawSection.linkEl.classList.remove(this.classes.linkActive); // Change the toolbar link to inactive
          }
          return;
        }

        if (!toolbarOpen && sectionEl.contentEl) {
          this.open();
        }
        if (!sectionActive) {
          if (sectionEl.contentEl) {
            this.inactivateAllSections();
          }
          this.activateSection(sectionEl);

          if (
            !sectionEl.contentEl.querySelector(this.classes.drawToolPanel) &&
            drawPanel.style.visibility === "visible"
          ) {
            drawPanel.style.visibility = "hidden";
            downloadPanel.style.visibility = "hidden";
            this.drawSection.linkEl.classList.remove(this.classes.linkActive); // Change the toolbar link to inactive
          }

          if (
            sectionEl.contentEl.querySelector(this.classes.drawToolPanel) &&
            !sectionActive
          ) {
            if (drawPanel.style.visibility === "") {
              drawPanel.style.visibility = "visible";
              downloadPanel.style.visibility = "visible";
            } else if (drawPanel.style.visibility === "visible") {
              drawPanel.style.visibility = "hidden";
              downloadPanel.style.visibility = "hidden";
              this.drawSection.linkEl.classList.remove(this.classes.linkActive); // Change the toolbar link to inactive
            } else if (drawPanel.style.visibility === "hidden") {
              // const drawButtonEl = document.querySelector(".draw__button");
              drawPanel.style.visibility = "visible";
              downloadPanel.style.visibility = "visible";
              // drawButtonEl.classList.add(this.classes.drawButtonActive);
            }
            // Activate the Layer Panel when Draw Tool is selected
            this.activateSection(this.layerSection);
          }

          // this.activateSection(sectionEl);
        }
      },

      /**
       * Creates a link/tab for a given toolbar section
       * @param {SectionOption} sectionOption The label and icon that are set in the
       * Section Option are used to create the link content
       * @returns {HTMLElement} Returns the link element
       */
      renderSectionLink(sectionOption) {
        // Create a container, label
        const link = document.createElement("div");
        const title = document.createElement("div");
        // Create the icon
        const icon = this.createIcon(sectionOption.icon);

        // Add the relevant classes
        link.classList.add(this.classes.link);
        title.classList.add(this.classes.linkTitle);
        // Add the label text
        title.textContent = sectionOption.label;

        link.append(icon, title);

        return link;
      },

      /**
       * Given the name of a Font Awesome 3.2 icon, or an SVG string, creates an icon
       * element with the appropriate classes for the tool bar link (tab)
       * @param {MapIconString} iconString The string to use to create the icon
       * @returns {HTMLElement} Returns either an <i> element with a Font Awesome icon,
       * or and SVG with a custom icon
       */
      createIcon(iconString) {
        try {
          // The icon element we will create and return. By default, return an empty span
          // element.
          let icon = document.createElement("span");

          // iconString must be string
          if (typeof iconString === "string") {
            // If the icon is an SVG element
            if (IconUtilities.isSVG(iconString)) {
              icon = new DOMParser().parseFromString(
                iconString,
                "image/svg+xml",
              ).documentElement;
              // If the icon is not an SVG, assume it's the name for a Font Awesome icon
            } else {
              icon = document.createElement("i");
              icon.className = `icon-${iconString}`;
            }
          }
          icon.classList.add(this.classes.linkIcon);
          return icon;
        } catch (error) {
          return document.createElement("span");
        }
      },

      /**
       * @typedef {object} SectionContentReturnType
       * @property {HTMLElement} contentContainer - The content container HTML
       * element.
       * @property {Backbone.View} sectionContent - The Backbone.View instance
       */

      /**
       * Creates a container for a toolbar section's content, then rendered the
       * specified view in that container.
       * @param {SectionOption} sectionOption The view and view options that are set in
       * the Section Option are used to create the content container
       * @returns {SectionContentReturnType} The content container with the
       * rendered view, and the Backbone.View itself.
       */
      renderSectionContent(sectionOption) {
        const view = this;
        // Create the container for the toolbar section content
        const contentContainer = document.createElement("div");
        // Add the class that identifies a toolbar section's content
        contentContainer.classList.add(this.classes.content);
        // Render the toolbar section view
        // Merge the icon and label with the other section options
        const viewOptions = {
          label: sectionOption.label,
          icon: sectionOption.icon,
          model: this.model,
          ...sectionOption.viewOptions,
        };
        // Convert any values in the form of 'model.someAttribute' to the model
        // attribute that is specified.
        Object.entries(viewOptions).forEach(([key, value]) => {
          if (typeof value === "string" && value.startsWith("model.")) {
            const attr = value.replace(/^model\./, "");
            viewOptions[key] = view.model.get(attr);
          }
        });
        const SectionView = sectionOption.view;
        const sectionContent = new SectionView(viewOptions);
        contentContainer.appendChild(sectionContent.el);
        sectionContent.render();
        return { contentContainer, sectionContent };
      },

      /**
       * Opens the toolbar and displays the content of the active toolbar section
       */
      open() {
        this.isOpen = true;
        this.el.classList.add(this.classes.open);
      },

      /**
       * Closes the toolbar. Also inactivates all sections.
       */
      close() {
        this.isOpen = false;
        this.el.classList.remove(this.classes.open);
        // Ensure that no section is active when the toolbar is closed
        this.inactivateAllSections();
      },

      /**
       * Display the content of a given section
       * @param {SectionElement} sectionEl The section to activate
       */
      activateSection(sectionEl) {
        if (!sectionEl) return;
        if (sectionEl.action && typeof sectionEl.action === "function") {
          const view = this;
          const { model } = this;
          sectionEl.action(view, model);
        } else {
          this.defaultActivationAction(sectionEl);
        }
      },

      /**
       * The default action for a section being activated.
       * @param {SectionElement} sectionEl The section to activate
       */
      defaultActivationAction(sectionEl) {
        const el = sectionEl;
        el.isActive = true;
        el.contentEl.classList.add(this.classes.contentActive);
        el.linkEl.classList.add(this.classes.linkActive);
      },

      /**
       * Hide the content of a section
       * @param {SectionElement} sectionEl The section to inactivate
       */
      inactivateSection(sectionEl) {
        const el = sectionEl;
        el.isActive = false;
        if (sectionEl.contentEl) {
          sectionEl.contentEl.classList.remove(this.classes.contentActive);
          sectionEl.linkEl.classList.remove(this.classes.linkActive);
        }
      },

      /**
       * Hide all of the sections in a toolbar view
       */
      inactivateAllSections() {
        const view = this;
        this.sectionElements.forEach((sectionEl) => {
          view.inactivateSection(sectionEl);
        });
      },
    },
  );

  return ToolbarView;
});
