define(["jquery",
    "underscore",
    "backbone",
    "collections/Filters",
    "views/portals/PortalListView"],
    function($, _, Backbone, Filters, PortalListView){

      "use strict";

      /**
      * @class PortalsSearchView
      * @classdesc A view that shows a list of Portals in the main app window
      * @classcategory Views/Portals
      * @extends Backbone.View
      * @constructor
      * @since 2.16.0
      * @screenshot views/PortalsSearchView.png
      */

      var PortalsSearchView = Backbone.View.extend(
        /** @lends PortalsSearchView.prototype */{

        /**
        * The template for this view.
        */
        template: _.template('<div id="portals-list-container"><div id="portals-list-user"/> <div id="portals-list-all"/> </div>'),

        /**
        * Renders the list of portals
        */
        render: function(){

          try{

            //Insert the template
            this.$el.html( this.template() );

            //Render the view after the user's authentication has been checked
            if( !MetacatUI.appUserModel.get("checked") ){
              this.listenToOnce(MetacatUI.appUserModel, "change:checked", this.render);
              return;
            }


            let allPortalsView = new PortalListView();

            // Filter datasets that the user has ownership of
            if ( MetacatUI.appUserModel.get("loggedIn") ) {
              let filters = new Filters();
              filters.addWritePermissionFilter();

              //Render My Portals list
              let myPortalsView = new PortalListView();
              myPortalsView.numPortals = 99999;
              myPortalsView.numPortalsPerPage = 5;
              myPortalsView.filters = filters;

              //Create titles for the My Portals and All Portals sections
              var title = $(document.createElement("h4"))
                          .addClass("portals-list-title"),
                  myPortalsTitle  = title.clone().text("My "  + MetacatUI.appModel.get("portalTermPlural")),
                  allPortalsTitle = title.clone().text("All " + MetacatUI.appModel.get("portalTermPlural"));

              this.$("#portals-list-user").append(myPortalsTitle, myPortalsView.el);
              this.$("#portals-list-all").append(allPortalsTitle);

              myPortalsView.render();

              //Exclude portals the user is an owner of from the All portals list
              let allPortalsFilters = new Filters();
              allPortalsFilters.addWritePermissionFilter();
              let permissionFilter = allPortalsFilters.at(allPortalsFilters.length-1);
              if(permissionFilter){
                permissionFilter.set("exclude", true);
                allPortalsView.filters = allPortalsFilters;
              }

            }

            //Render All Portals
            allPortalsView.numPortals = 99999;
            allPortalsView.numPortalsPerPage = 10;

            this.$("#portals-list-all").append(allPortalsView.el);

            allPortalsView.render();

          }
          catch(e){
            console.error(e);
            this.showError();
          }
        },

        /**
        * Queries for the portal objects using the SearchResults collection
        * @param {SolrResult} - The SolrResult model that represent the portal
        * @param {String} - The DOM element id to display the results in-
        * @param {String} - The title of the list section-
        * @param {Boolean} - Does the user have permission to edit the displayed portal-
        */
        getSearchResults: function(filters, contentId, title, editable){

          try{

            //Filter by the portal format ID
            filters.add({
              fields: ["formatId"],
              values: ["dataone.org/portals"],
              matchSubstring: true,
              exclude: false
            });

            //Filter datasets by their ownership
            filters.add({
              fields: ["obsoletedBy"],
              values: ["*"],
              matchSubstring: false,
              exclude: true
            });

            var itemsPerPage = this.portalsPerPage;
            var searchResults = new SearchResults();

            //Get 100 rows
            searchResults.rows = this.numPortals;

            //The fields to return
            searchResults.fields = this.searchFields;

            // Set the query service URL
            try{
              if( MetacatUI.appModel.get("defaultAlternateRepositoryId") ){
                var mnToQuery = _.findWhere( MetacatUI.appModel.get("alternateRepositories"), { identifier: MetacatUI.appModel.get("defaultAlternateRepositoryId") } );
                if( mnToQuery ){
                  searchResults.queryServiceUrl = mnToQuery.queryServiceUrl;
                }
              }
            }
            catch(e){
              console.error("Could not get active alt repo. ", e);
            }

            //Set the query on the SearchResults
            searchResults.setQuery( filters.getQuery() );

            // If the user is not logged in, then only the "All Portals" section will be displayed, so
            // double the number of results that will be displayed for each paged result.
            if ( !MetacatUI.appUserModel.get("loggedIn") ){
                itemsPerPage *= 2;
            }
            //Listen to the search results collection and render the results when the search is complete
            this.listenToOnce( searchResults, "reset", _.partial(this.renderList, searchResults, title, contentId, editable, itemsPerPage));
            //Listen to the search results collection for errors
            this.listenToOnce( searchResults, "error", this.showError );

            //Get the first page of results
            searchResults.toPage(0);

          }
          catch(e){
            this.showError();
            console.error("Failed to fetch the SearchResults for the PortalsList: ", e);
          }
        },

        /**
        * Renders each search result from the SolrResults collection
        * @param {SolrResult} - The SolrResult model that represent the portal
        * @param {String} - The title of the list section-
        * @param {String} - The DOM element id to display the results in
        * @param {Boolean} - Does the user have permission to edit the displayed portal
        * @param {Number} - The number of portals list items to display (for each paged result)
        *
        */
        renderList: function(searchResults, title, containerId, editable, itemsPerPage) {

          try{
            // Get the list container element
            var listContainer = this.$(containerId);

            // If no search results were found, display a message
            if( (!searchResults || !searchResults.length) && !this.additionalPortalsToDisplay.length){
              if (editable) {
                var row = this.createListItem();
                row.html("<td colspan='4' class='center'>You haven't created or have access to any " +
                          MetacatUI.appModel.get("portalTermPlural") + " yet.</td>");
                listContainer.html(row);
              }

              return;
            }

            var title = $(document.createElement("h4"))
                        .addClass("portals-list-title")
                        .text(title);
            listContainer.append(title);

            //Remove any 'loading' elements before adding items to the list
            listContainer.find(".loading").remove();

            //Iterate over each search result and render it
            searchResults.each(function(searchResult){

              //Create a list item element and add the search result element
              // to the list container
              listContainer.append(this.createListItem(searchResult, editable));

            }, this);

            // Create a pager for this list if there are many group members
            var pager = new PagerView({
                pages: this.$(containerId.concat(" .member")),
                itemsPerPage: itemsPerPage,
                classes: "portals-list-entry"
            });

            listContainer.append(pager.render().el);

          }
          catch(e){
            console.error(e);
            this.showError();
          }
        },

        /**
        * Creates a row for the given portal SolrResult model
        * @param {SolrResult} - The SolrResult model that represent the portal
        * @param {Boolean} - Does the user have permission to edit the displayed portal
        * @return {Element}
        */
        createListItem: function(searchResult, editable){

          try{
            var listItem = $(document.createElement("div")).addClass("portals-list-entry")
                            .addClass("member");

            if( searchResult && typeof searchResult.get == "function" ){

              //Don't render a list item for a portal that is already there
              if( this.$("tr[data-seriesId='" + searchResult.get("seriesId") + "']").length ){
                return listItem;
              }

              //Add an id to the list element
              listItem.attr("data-seriesId", searchResult.get("seriesId"));

              //Create a logo image
              var logoImg = "";
              var logoDiv = "";

              if( searchResult.get("logo")) {
                if( !searchResult.get("logo").startsWith("http") ){

                  var urlBase = "";

                  //If there are alt repos configured, use the datasource obbject service URL
                  if( MetacatUI.appModel.get("alternateRepositories").length && searchResult.get("datasource") ){
                    var sourceMN = _.findWhere(MetacatUI.appModel.get("alternateRepositories"), { identifier: searchResult.get("datasource") });
                    if( sourceMN ){
                      urlBase = sourceMN.objectServiceUrl;
                    }
                  }

                  if( !urlBase ){
                    // use the resolve service if there is no object service url
                    // (e.g. in DataONE theme)
                    urlBase = MetacatUI.appModel.get("objectServiceUrl") ||
                              MetacatUI.appModel.get("resolveServiceUrl");
                  }

                  searchResult.set("logo", urlBase + searchResult.get("logo") );
                }

                // Add link to the portal to the list item
                var logoLink = $(document.createElement("a"))
                            .attr("href", MetacatUI.root + "/" + MetacatUI.appModel.get("portalTermPlural")
                            + "/" + encodeURIComponent((searchResult.get("label") || searchResult.get("seriesId") || searchResult.get("id"))) )

                var logoImg = $(document.createElement("img"))
                          .attr("src", searchResult.get("logo"))
                          .attr("alt", searchResult.get("title") + " logo");
                logoLink.append(logoImg);

                logoDiv = $(document.createElement("div"))
                          .addClass("portal-logo")
                          .append(logoLink);

              } else {
                // Create an empty <div>, as no portal image is available.
                logoDiv = $(document.createElement("div"))
                          .addClass("portal-logo")
              }


              var portalLabel = $(document.createElement("h4"))
                          .addClass("portal-label")
                          .text( searchResult.get("label"));

              var portalTitle = $(document.createElement("p"))
                                .addClass("portal-title")
                                .text( searchResult.get("title"));

              var portalInfo;
              portalInfo = $(document.createElement("div"))
                             .addClass("portal-info")
                             .append(portalLabel)
                             .append(portalTitle);

              //Add all the elements to the row
              listItem.append(logoDiv, portalInfo);

              //Create an Edit buttton
              var editButton = "";
              if(Object.values(MetacatUI.uiRouter.routes).includes("renderPortalEditor")){

                editButton = $(document.createElement("a")).attr("href",
                             MetacatUI.root + "/edit/"+ MetacatUI.appModel.get("portalTermPlural") +"/" + encodeURIComponent((searchResult.get("label") || searchResult.get("seriesId") || searchResult.get("id"))) )
                             .text("Edit")
                             .addClass("btn edit");
              }

              var editDiv = $(document.createElement("div"))
                             .addClass("portal-edit-link")
                             .addClass("controls");

              if (editable) {
                editDiv.append(editButton);
              }

              listItem.append(editDiv);
            }

            //Return the list item
            return listItem;
          }
          catch(e){
            console.error(e);
            return "";
          }
        },

        /**
        * Displays an error message when rendering this view has failed.
        */
        showError: function(){

          //Remove the loading elements
          this.$(".loading").remove();

          //Show an error message
          MetacatUI.appView.showAlert(
            "Something went wrong while getting this list of " + MetacatUI.appModel.get("portalTermPlural") + ".",
            "alert-error",
            this.$el);
        }

        });
      return PortalsSearchView;
  });
