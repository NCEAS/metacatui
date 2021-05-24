define(["jquery",
    "underscore",
    "backbone",
    "collections/Filters",
    "collections/SolrResults",
    "views/PagerView"],
    function($, _, Backbone, Filters, SearchResults, PagerView){

      "use strict";
      
      /**
      * @class PortalsSearchView
      * @classdesc A view that shows a list of Portals in the main app window
      * @classcategory Views/Portals
      * @extends Backbone.View
      * @constructor
      * @since 2.14.2
      * @screenshot views/PortalsSearchView.png
      */

      var PortalsSearchView = Backbone.View.extend(
        /** @lends PortalsSearchView.prototype */{

        /**
        * A comma-separated list of Solr index fields to retrieve when searching for portals
        * @type {string}
        * @default "id,seriesId,title,formatId,label,logo,datasource"
        */
        searchFields: "id,seriesId,title,formatId,label,logo,datasource",

        /**
        * The number of portal search results to retrieve
        * @default 100
        * @type {number}
        */
        numPortals: 1000,
        
        /**
        * The number of portal search results  to display (for each paged result)
        * @default 100
        * @type {number}
        */
        portalsPerPage: 3,

        /**
        * An array of additional SolrResult models for portals that will be displayed
        * in this view in addition to the SolrResults found as a result of the search.
        * These could be portals that wouldn't otherwise be found by a search but should be displayed anyway.
        * @type {SolrResult[]}
        */
        additionalPortalsToDisplay: [],

        /**
        * A jQuery selector for the element that contains all portal lists.
        * @type {string}
        */
        listContainerId: "#portals-list-container",
        
        /**
        * The jQuery selector for the element that the list of portals, that can be edited, should be inserted into.
        * @type {string}
        */
        myPortalsListContainerId: "#portals-list-user",
        
        /**
        * A jQuery selector for the element that the list of portals, that can be viewed only, should be inserted into.
        *  privideges) should be inserted into.
        * @type {string}
        */
        allPortalsListContainerId: "#portals-list-all",
        
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

            var filters = new Filters();

            // Filter datasets that the user has ownership of
            if ( MetacatUI.appUserModel.get("loggedIn") ) {
              filters.addWritePermissionFilter();

              //Get the search results and render them
              this.getSearchResults(filters, this.myPortalsListContainerId, "MY PORTALS", true);
            }
            
            filters = new Filters();
            if ( MetacatUI.appUserModel.get("loggedIn") ){
              //Filter datasets by their ownership
              filters.add({
                fields: ["rightsHolder", "writePermission", "changePermission"],
                values: MetacatUI.appUserModel.get("allIdentitiesAndGroups"),
                operator: "OR",
                matchSubstring: false,
                exclude: true 
              });
            }

            this.getSearchResults(filters, this.allPortalsListContainerId, "ALL PORTALS", false);

          }
          catch(e){
            console.error(e);
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
          this.$(this.listContainerId).find(".loading").remove();
      
          if( this.$(this.listContainerId).children("tr").length == 0 ){
      
            //Show an error message
            MetacatUI.appView.showAlert(
              "Something went wrong while getting this list of portals.",
              "alert-error",
              this.$(this.listContainerId));
          }
        }
      
        });
      return PortalsSearchView;
  });
