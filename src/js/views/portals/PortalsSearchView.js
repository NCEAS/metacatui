define([
  "jquery",
  "underscore",
  "backbone",
  "collections/Filters",
  "views/portals/PortalListView",
], ($, _, Backbone, Filters, PortalListView) => {
  "use strict";

  /**
   * @class PortalsSearchView
   * @classdesc A view that shows a list of Portals in the main app window
   * @classcategory Views/Portals
   * @augments Backbone.View
   * @class
   * @since 2.16.0
   * @screenshot views/portals/PortalsSearchView.png
   */

  // CSS class names used within the view
  const CLASS_NAMES = {
    searchForm: "portal-search",
    inputGroup: "input-append",
    searchInput: "input-large",
    searchButton: "btn",
    searchIcon: "icon icon-search icon-on-left",
  };

  // The ID used for the search input field
  const SEARCH_ID = "portal-search-input";

  const PortalsSearchView = Backbone.View.extend(
    /** @lends PortalsSearchView.prototype */ {
      /**
       * Create HTML string for the portals search view.
       * @param {Object} options - The options for the template.
       * @param {string} options.searchTerm - The current search term.
       * @param {string} options.portalTermPlural - The plural term for portals.
       * @returns {string} The HTML template for the view.
       */
      template({ searchTerm = "", portalTermPlural = "portals" }) {
        return `
        <div id="portals-list-container">
          <form class="${CLASS_NAMES.searchForm}">
            <label for="${SEARCH_ID}">Search ${portalTermPlural}</label>
            <div class="${CLASS_NAMES.inputGroup}">
              <input
                id="${SEARCH_ID}"
                type="search"
                value="${searchTerm}"
                class="${CLASS_NAMES.searchInput}"
              />
              <button type="submit" class="${CLASS_NAMES.searchButton}"><i class="${CLASS_NAMES.searchIcon}"></i>Search</button>
            </div>
          </form>
          <div id="portals-list-user"></div>
          <div id="portals-list-all"></div>
        </div>`.trim();
      },

      /**
       * The submitted term shared by both portal lists.
       * @type {string}
       * @since 2.41.0
       */
      searchTerm: "",

      /** @inheritdoc */
      events: {
        [`submit .${CLASS_NAMES.searchForm}`]: "search",
      },

      /** @inheritdoc */
      initialize() {
        this.subviews = [];
      },

      /**
       * Renders the list of portals
       */
      render() {
        try {
          // Set the header type
          MetacatUI.appModel.set("headerType", "default");

          // Insert the template
          this.stopListening();
          this.subviews.forEach((view) => view.remove());
          this.subviews = [];
          this.$el.html(
            this.template({
              portalTermPlural: MetacatUI.appModel.get("portalTermPlural"),
              searchTerm: this.searchTerm,
            }),
          );

          // Render the view after the user's authentication has been checked
          if (!MetacatUI.appUserModel.get("checked")) {
            this.listenToOnce(
              MetacatUI.appUserModel,
              "change:checked",
              this.render,
            );
            return;
          }

          const allPortalsView = new PortalListView();
          allPortalsView.filters = new Filters();
          allPortalsView.searchTerm = this.searchTerm;

          // Create titles for the My Portals and All Portals sections
          const title = $(document.createElement("h4")).addClass(
            "portals-list-title",
          );
          const allPortalsTitle = title
            .clone()
            .text(`All ${MetacatUI.appModel.get("portalTermPlural")}`);

          // Filter datasets that the user has ownership of
          if (MetacatUI.appUserModel.get("loggedIn")) {
            const filters = new Filters();
            filters.addWritePermissionFilter();

            // Render My Portals list
            const myPortalsView = new PortalListView();
            myPortalsView.numPortals = 99999;
            myPortalsView.numPortalsPerPage = 5;
            myPortalsView.filters = filters;
            myPortalsView.searchTerm = this.searchTerm;
            this.subviews.push(myPortalsView);

            // Create titles for the My Portals section
            const myPortalsTitle = title
              .clone()
              .text(`My ${MetacatUI.appModel.get("portalTermPlural")}`);

            this.$("#portals-list-user").append(
              myPortalsTitle,
              myPortalsView.el,
            );

            myPortalsView.render();

            // Exclude portals the user is an owner of from the All portals list
            const allPortalsFilters = new Filters();
            allPortalsFilters.addWritePermissionFilter();
            const permissionFilter = allPortalsFilters.at(
              allPortalsFilters.length - 1,
            );
            if (permissionFilter) {
              permissionFilter.set("exclude", true);
              allPortalsView.filters = allPortalsFilters;
            }
          }

          // Render All Portals
          allPortalsView.numPortals = 99999;
          allPortalsView.numPortalsPerPage = 10;
          allPortalsView.createBtnContainer = "#none";
          allPortalsView.noResultsMessage = `There are no ${MetacatUI.appModel.get(
            "portalTermPlural",
          )} to show.`;

          this.$("#portals-list-all").append(
            allPortalsTitle,
            allPortalsView.el,
          );

          this.subviews.push(allPortalsView);
          allPortalsView.render();
        } catch (e) {
          this.showError(e);
        }
      },

      /**
       * Applies the submitted term to both portal lists.
       * @param {Event} event The form submission
       * @since 2.41.0
       */
      search(event) {
        event.preventDefault();
        this.searchTerm = this.$(`#${SEARCH_ID}`).val().trim();
        this.subviews.forEach((view) => {
          Object.assign(view, { searchTerm: this.searchTerm });
          view.getSearchResults();
        });
      },

      /**
       * Stops searches and listeners while retaining the shared content
       * element.
       * @returns {void}
       * @since 2.41.0
       */
      onClose() {
        this.undelegateEvents();
        this.stopListening();
        this.subviews.forEach((view) => view.remove());
        this.subviews = [];
      },

      /**
       * Closes the search views and removes this element.
       * @returns {PortalsSearchView} This view
       * @since 2.41.0
       */
      remove() {
        this.onClose();
        return Backbone.View.prototype.remove.call(this);
      },

      /**
       * Displays an error message when rendering this view has failed.
       * @param {Error} e The error that occurred while rendering the view.
       */
      showError(e) {
        // Remove the loading elements
        this.$(".loading").remove();

        // See if the error has a message
        const msg = e?.message || (e ? String(e) : "");

        // Show an error message
        MetacatUI.appView.showAlert(
          `Something went wrong while getting this list of ${MetacatUI.appModel.get(
            "portalTermPlural",
          )}. ${msg}`,
          "alert-error",
          this.$el,
        );
      },
    },
  );
  return PortalsSearchView;
});
