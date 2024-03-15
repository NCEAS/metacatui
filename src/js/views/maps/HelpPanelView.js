"use strict";

define(["backbone", "text!templates/maps/cesium-nav-help.html"], function (
  Backbone,
  NavHelpTemplate
) {
  /**
   * @class MapHelpPanel
   * @classdesc The MapHelpPanel view displays navigation instructions and other
   * help information for the map.
   * @classcategory Views/Maps
   * @name MapHelpPanel
   * @extends Backbone.View
   * @screenshot views/maps/MapHelpPanel.png
   * @since 2.27.0
   * @constructs MapHelpPanel
   */
  var MapHelpPanel = Backbone.View.extend(
    /** @lends MapHelpPanel.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "MapHelpPanel",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "map-help-panel",

      /**
       * Initializes the MapHelpPanel
       * @param {Object} options - A literal object with options to pass to the
       * view
       * @param {boolean} [options.showFeedback=true] - Set to false to hide the
       * feedback section
       * @param {boolean} [options.showNavHelp=true] - Set to false to hide the
       * navigation instructions section
       * @param {string} [options.feedbackText] - Text to show in the feedback
       * section
       */
      initialize: function (options) {
        if (!options) options = {};

        const validOptions = ["showFeedback", "feedbackText", "showNavHelp"];
        validOptions.forEach((option) => {
          if (options.hasOwnProperty(option)) {
            this[option] = options[option];
          }
        });

      },

      /**
       * The template to use to show the navigation instructions
       * @type {function}
       */
      navHelpTemplate: _.template(NavHelpTemplate),

      /**
       * Set to false to hide the feedback section
       * @type {boolean}
       * @default true
       */
      showFeedback: true,

      /**
       * Set to false to hide the navigation instructions section
       * @type {boolean}
       * @default true
       */
      showNavHelp: true,

      /**
       * Text to show in the feedback section
       * @type {string}
       */
      feedbackText: `Please contact the administrator of this map for help.`,

      /**
       * The sections to show in the help panel
       * @type {Object[]}
       * @property {string} id - The id of the section
       * @property {string} title - The title of the section
       * @property {string} render - The name of the method to call to render
       * the section. The method will be passed the container within which to
       * render the section. It should return the container element with the
       * section added. Methods will be called with the view as the context.
       */
      sections: [
        {
          id: "nav-help",
          title: "Navigation Instructions",
          render: "renderNavHelp",
        },
        {
          id: "feedback",
          title: "Feedback",
          render: "renderFeedback",
        },
      ],

      /**
       * Renders the MapHelpPanel
       * @returns {MapHelpPanel} Returns the view
       */
      render: function () {
        const view = this;

        let sections = JSON.parse(JSON.stringify(view.sections));

        if (view.showFeedback === false) {
          sections = sections.filter((section) => {
            return section.id !== "feedback";
          });
        }

        if (view.showNavHelp === false) {
          sections = sections.filter((section) => {
            return section.id !== "nav-help";
          });
        }

        sections.forEach((section) => {
          view.renderSection(section);
        });

        return view;
      },

      /**
       * Renders a section of the help panel
       * @param {Object} section - The options for the section, see
       * {@link MapHelpPanel#sections}
       */
      renderSection: function (section) {
        try {
          const view = this;
          const renderMethod = view[section.render] || null;
          if (!renderMethod) return;

          const contentContainerClass = "map-help-panel__content";

          const sectionEl = document.createElement("section");
          sectionEl.classList.add("map-help-panel__section");
          sectionEl.innerHTML = `<h3 class="toolbar__content-header">${section.title}</h3>
              <div class="${contentContainerClass}"></div>`;
          const contentEl = sectionEl.querySelector(
            "." + contentContainerClass
          );
          renderMethod.call(view, contentEl);

          view.el.appendChild(sectionEl);

          return sectionEl;
        } catch (e) {
          console.log("Error rendering a help panel section", e);
        }
      },

      /**
       * Renders the navigation instructions
       * @param {HTMLElement} containerEl - The element to render the navigation
       * instructions within
       * @returns {HTMLElement} Returns the container element with the
       * navigation instructions added
       */
      renderNavHelp: function (containerEl) {
        const view = this;
        const cid = this.cid;
        const cesiumUrl =
          "https://cesium.com/downloads/cesiumjs/releases/1.91/Build/Cesium/";

        const mouseButtonId = "nav-help-mouse-" + cid;
        const touchButtonId = "nav-help-touch-" + cid;
        const mouseSectionId = "nav-help-mouse-section-" + cid;
        const touchSectionId = "nav-help-touch-section-" + cid;

        // Create the HTML and add it to the container
        const navHelpHTML = this.navHelpTemplate({
          mouseButtonId,
          touchButtonId,
          mouseSectionId,
          touchSectionId,
          cesiumUrl,
        });
        containerEl.innerHTML = navHelpHTML;

        // Select the elements
        const mouseButtonEl = containerEl.querySelector("#" + mouseButtonId);
        const touchButtonEl = containerEl.querySelector("#" + touchButtonId);
        const mouseSectionEl = containerEl.querySelector("#" + mouseSectionId);
        const touchSectionEl = containerEl.querySelector("#" + touchSectionId);

        // Add listeners to the buttons to toggle the sections
        mouseButtonEl.addEventListener("click", () => {
          view.showSection(mouseSectionEl, mouseButtonEl);
          view.hideSection(touchSectionEl, touchButtonEl);
        });
        touchButtonEl.addEventListener("click", () => {
          view.showSection(touchSectionEl, touchButtonEl);
          view.hideSection(mouseSectionEl, mouseButtonEl);
        });

        // Show only the mouse section by default
        view.hideSection(touchSectionEl, touchButtonEl);
        view.showSection(mouseSectionEl, mouseButtonEl);

        return containerEl;
      },

      /**
       * Renders the feedback section
       * @param {HTMLElement} containerEl - The element to render the feedback
       * section within
       * @returns {HTMLElement} Returns the container element with the feedback
       * section added
       */
      renderFeedback: function (containerEl) {
        containerEl.innerHTML = this.feedbackText;
        return containerEl;
      },

      /**
       * Hides a section by adding the hidden class, and removes the active
       * class from the button if one is provided
       * @param {HTMLElement} sectionEl - The section element to hide
       * @param {HTMLElement} [buttonEl] - The button element to remove the
       * active class from
       */
      hideSection: function (sectionEl, buttonEl) {
        if (!sectionEl) return;
        sectionEl.classList.add("hidden");
        if (!buttonEl) return;
        buttonEl.classList.remove("map-view__button--active");
      },

      /**
       * Shows a section by removing the hidden class, and adds the active class
       * to the button if one is provided
       * @param {HTMLElement} sectionEl - The section element to show
       * @param {HTMLElement} [buttonEl] - The button element to add the active
       * class to
       */
      showSection: function (sectionEl, buttonEl) {
        if (!sectionEl) return;
        sectionEl.classList.remove("hidden");
        if (!buttonEl) return;
        buttonEl.classList.add("map-view__button--active");
      },
    }
  );

  return MapHelpPanel;
});
