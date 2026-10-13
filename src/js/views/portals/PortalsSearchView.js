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

  const PortalsSearchView = Backbone.View.extend(
    /** @lends PortalsSearchView.prototype */ {
      /**
       * The template for this view.
       */
      template: _.template(
        '<div id="portals-list-container"><div id="portals-list-user"/> <div id="portals-list-all"/> </div>',
      ),

      /**
       * Renders the list of portals
       */
      render() {
        try {
          // Set the header type
          MetacatUI.appModel.set("headerType", "default");

          // Insert the template
          this.$el.html(this.template());

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

          allPortalsView.render();
        } catch (e) {
          console.error(e);
          this.showError();
        }
      },

      /**
       * Displays an error message when rendering this view has failed.
       */
      showError() {
        // Remove the loading elements
        this.$(".loading").remove();

        // Show an error message
        MetacatUI.appView.showAlert(
          `Something went wrong while getting this list of ${MetacatUI.appModel.get(
            "portalTermPlural",
          )}.`,
          "alert-error",
          this.$el,
        );
      },
    },
  );
  return PortalsSearchView;
});
