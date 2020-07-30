define(["jquery",
    "underscore",
    "backbone",
    "collections/Filters",
    "collections/SolrResults",
    "text!templates/portals/portalList.html"],
    function($, _, Backbone, Filters, SearchResults, Template){

      /**
      * @class PortalListView
      * @classdesc A view that shows a list of Portals
      * @extends Backbone.View
      * @constructor
      */
      return Backbone.View.extend(
        /** @lends PortalListView.prototype */{

        /**
        * An array of Filter models  or Filter model JSON to use in the query.
        * If not provided, a default query will be used.
        * @type {Filter[]}
        */
        filters: null,

        /**
        * A SolrResults collection that contains the results of the search for the portals
        * @type {SolrResults}
        */
        searchResults: new SearchResults(),

        /**
        * A comma-separated list of Solr index fields to retrieve when searching for portals
        * @type {string}
        * @default "id,seriesId,title,formatId,label,logo"
        */
        searchFields: "id,seriesId,title,formatId,label,logo,datasource",

        /**
        * The number of portals to retrieve and render in this view
        * @default 100
        * @type {number}
        */
        numPortals: 100,

        /**
        * An array of additional SolrResult models for portals that will be displayed
        * in this view in addition to the SolrResults found as a result of the search.
        * These could be portals that wouldn't otherwise be found by a search but should be displayed anyway.
        * @type {SolrResult[]}
        */
        additionalPortalsToDisplay: [],

        /**
        * A jQuery selector for the element that the list should be inserted into
        * @type {string}
        */
        listContainer: ".portal-list-container",
        /**
        * A jQuery selector for the element that the Create Portal should be inserted into
        * @type {string}
        */
        createBtnContainer: ".create-btn-container",

        /**
        * References to templates for this view. HTML files are converted to Underscore.js templates
        */
        template: _.template(Template),

        /**
        * Renders the list of portals
        */
        render: function(){

          try{

            //If the "my portals" feature is disabled, exit now
            if(MetacatUI.appModel.get("showMyPortals") === false){
              return;
            }

            //Insert the template
            this.$el.html( this.template() );

            //If there are no given filters, create default ones
            if( !this.filters ){
              //Create search filters for finding the portals
              var filters = new Filters();

              //Filter datasets that the user has ownership of
              filters.addWritePermissionFilter();

              this.filters = filters;
            }
            //If the filters set on this view is an array of JSON, add it to a Filters collection
            else if( this.filters.length && !Filters.prototype.isPrototypeOf(this.filters) ){
              //Create search filters for finding the portals
              var filters = new Filters();

              filters.add( this.filters );

              this.filters = filters;
            }
            //If there is an empty array, create a new Filters collection
            else if( !this.filters.length ){
              this.filters = new Filters();
            }

            //Get the search results and render them
            this.getSearchResults();

            //Display any additional portals in the list that have been passed to
            // the view directly.
            _.each(this.additionalPortalsToDisplay, function(searchResult){
              //Get the list container element
              var listContainer = this.$(this.listContainer);

              //Remove any 'loading' elements before adding items to the list
              listContainer.find(".loading").remove();

              //Create a list item element and add the search result element
              // to the list container
              listContainer.append(this.createListItem(searchResult));
            }, this);

            if( this.additionalPortalsToDisplay.length ){
              //While the search is being sent for the other portals in this list,
              // show a loading sign underneath the additional portals we just displayed.
              var loadingListItem = this.createListItem();
              loadingListItem.html("<td class='loading subtle' colspan='4'>Loading more " +
                                     MetacatUI.appModel.get("portalTermPlural") + "...</td>");
              this.$(this.listContainer).append(loadingListItem);
            }

          }
          catch(e){
            console.error(e);
          }

        },

        /**
        * Queries for the portal objects using the SearchResults collection
        */
        getSearchResults: function(){

          try{

            //Filter by the portal format ID
            this.filters.add({
              fields: ["formatId"],
              values: ["dataone.org/portals"],
              matchSubstring: true,
              exclude: false
            });

            //Filter datasets by their ownership
            this.filters.add({
              fields: ["obsoletedBy"],
              values: ["*"],
              matchSubstring: false,
              exclude: true
            });

            //Get 100 rows
            this.searchResults.rows = this.numPortals;

            //The fields to return
            this.searchResults.fields = this.searchFields;

            //Set the query service URL
            try{
              if( MetacatUI.appModel.get("defaultAlternateRepositoryId") ){
                var mnToQuery = _.findWhere( MetacatUI.appModel.get("alternateRepositories"), { identifier: MetacatUI.appModel.get("defaultAlternateRepositoryId") } );
                if( mnToQuery ){
                  this.searchResults.queryServiceUrl = mnToQuery.queryServiceUrl;
                }
              }
            }
            catch(e){
              console.error("Could not get active alt repo. ", e);
            }

            //Set the query on the SearchResults
            this.searchResults.setQuery( this.filters.getQuery() );

            //Listen to the search results collection and render the results when the search is complete
            this.listenToOnce( this.searchResults, "reset", this.renderList );
            //Listen to the search results collection for errors
            this.listenToOnce( this.searchResults, "error", this.showError );

            //Get the first page of results
            this.searchResults.toPage(0);
          }
          catch(e){
            this.showError();
            console.error("Failed to fetch the SearchResults for the PortalsList: ", e);
          }
        },

        /**
        * Renders each search result from the SolrResults collection
        */
        renderList: function(){

          try{

            //Get the list container element
            var listContainer = this.$(this.listContainer);

            //If no search results were found, display a message
            if( (!this.searchResults || !this.searchResults.length) && !this.additionalPortalsToDisplay.length){
              var row = this.createListItem();
              row.html("<td colspan='4' class='center'>You haven't created or have access to any " +
                        MetacatUI.appModel.get("portalTermPlural") + " yet.</td>");
              listContainer.html(row);
              return;
            }

            //Remove any 'loading' elements before adding items to the list
            listContainer.find(".loading").remove();

            //Iterate over each search result and render it
            this.searchResults.each(function(searchResult){

              //Create a list item element and add the search result element
              // to the list container
              listContainer.append(this.createListItem(searchResult));

            }, this);

            //TODO: Unwrap the call to renderCreateButton() from this if condition,
            // because the ListView will only ever be used when Usages/Bookkeeper is enabled
            if( !MetacatUI.appModel.get("dataonePlusPreviewMode") ){
              //Add a "Create" button to create a new portal
              this.renderCreateButton();
            }

          }
          catch(e){
            console.error(e);

            this.showError();

          }

        },

        /**
        * Creates a table row for the given portal SolrResult model
        * @param {SolrResult} - The SolrResult model that represent the portal
        * @return {Element}
        */
        createListItem: function(searchResult){

          try{

            //Create a table row
            var listItem = $(document.createElement("tr"));

            if( searchResult && typeof searchResult.get == "function" ){

              //Don't render a list item for a portal that is already there
              if( this.$("tr[data-seriesId='" + searchResult.get("seriesId") + "']").length ){
                return listItem;
              }

              //Add an id to the list element
              listItem.attr("data-seriesId", searchResult.get("seriesId"));

              //Create a logo image
              var logo = "";
              if( searchResult.get("logo") ){
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

                logo = $(document.createElement("img"))
                          .attr("src", searchResult.get("logo"))
                          .attr("alt", searchResult.get("title") + " logo");
              }

              //Create an Edit buttton
              var buttons = "";
              if(Object.values(MetacatUI.uiRouter.routes).includes("renderPortalEditor")){

                buttons = $(document.createElement("a")).attr("href",
                             MetacatUI.root + "/edit/"+ MetacatUI.appModel.get("portalTermPlural") +"/" + encodeURIComponent((searchResult.get("label") || searchResult.get("seriesId") || searchResult.get("id"))) )
                             .text("Edit")
                             .addClass("btn edit");
              }


              //Create a link to the portal view with the title as the text
              var titleLink = $(document.createElement("a"))
                              .attr("href", searchResult.createViewURL())
                              .text(searchResult.get("title"));

              //Add all the elements to the row
              listItem.append(
                $(document.createElement("td")).addClass("logo").append(logo),
                $(document.createElement("td")).addClass("portal-label").text( searchResult.get("label") ),
                $(document.createElement("td")).addClass("title").append(titleLink),
                $(document.createElement("td")).addClass("controls").append(buttons));
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
        * Renders a "Create" button for the user to create a new portal
        */
        renderCreateButton: function(){
          try{

            //If the authorization hasn't been checked yet
            if( MetacatUI.appUserModel.get("isAuthorizedCreatePortal") !== true &&
                MetacatUI.appUserModel.get("isAuthorizedCreatePortal") !== false ){
              //Check is this user is authorized to create a new portal
              this.listenToOnce( MetacatUI.appUserModel, "change:isAuthorizedCreatePortal", this.renderCreateButton);
              MetacatUI.appUserModel.isAuthorizedCreatePortal();
            }
            else{

              //Create a New portal buttton
              var createButton = $(document.createElement("a"))
                                 .addClass("btn btn-primary")
                                 .append( $(document.createElement("i")).addClass("icon icon-plus icon-on-left"),
                                   "New " + MetacatUI.appModel.get('portalTermSingular'));

              var isNotAuthorizedNoBookkeeper   = !MetacatUI.appModel.get("enableBookkeeperServices") &&
                                                   MetacatUI.appUserModel.get("isAuthorizedCreatePortal") === false,
                  reachedLimitWithBookkeeper    = MetacatUI.appModel.get("enableBookkeeperServices") &&
                                                  MetacatUI.appUserModel.get("isAuthorizedCreatePortal") === false,
                  reachedLimitWithoutBookkeeper = !MetacatUI.appModel.get("enableBookkeeperServices") &&
                                                   MetacatUI.appModel.get("portalLimit") <= this.searchResults.length;

              //If creating portals is disabled in the entire app, or is only limited to certain groups,
              // then don't show the Create button.
              if( isNotAuthorizedNoBookkeeper ){
                return;
              }
              //If creating portals is enabled, but this person is unauthorized because of Bookkeeper info,
              // then show the Create button as disabled.
              else if( reachedLimitWithBookkeeper || reachedLimitWithoutBookkeeper ){

                 //Disable the button
                 createButton.addClass("disabled");

                 //Add the create button to the view
                 this.$(this.createBtnContainer).html(createButton);

                 var message = "You've already reached the " + MetacatUI.appModel.get("portalTermSingular") +
                               " limit for your ";

                 if( MetacatUI.appModel.get("enableBookkeeperServices") ){
                   message += MetacatUI.appModel.get("dataonePlusName");

                   if( MetacatUI.appModel.get("dataonePlusPreviewMode") ){
                     message += " free preview. ";
                   }
                   else{
                     message += " subscription. ";
                   }

                   var portalQuotas = MetacatUI.appUserModel.getQuotas("portal");
                   if( portalQuotas.length ){
                     message += "(" + portalQuotas[0].get("softLimit") + " " +
                                ((portalQuotas[0].get("softLimit") > 1)? MetacatUI.appModel.get("portalTermPlural") : MetacatUI.appModel.get("portalTermSingular")) + ")";
                   }

                   message += " Contact us to upgrade your subscription.";

                 }
                 else{
                   message += " account. ";

                   var portalLimit = MetacatUI.appModel.get("portalLimit");
                   if( portalLimit > 0 ){
                     message += "(" + portalLimit + " " +
                                ((portalLimit > 1)? MetacatUI.appModel.get("portalTermPlural") : MetacatUI.appModel.get("portalTermSingular")) +
                                ")"
                   }
                 }

                 //Add the tooltip to the button
                 createButton.tooltip({
                   placement: "top",
                   trigger: "hover click focus",
                   delay: {
                     show: 500
                   },
                   title: message
                 });
              }
              else{

                //Add the link URL to the button
                createButton.attr("href", MetacatUI.root + "/edit/" + MetacatUI.appModel.get("portalTermPlural"))

                //Add the create button to the view
                this.$(this.createBtnContainer).html(createButton);
              }

              //Reset the isAuthorizedCreatePortal attribute
              MetacatUI.appUserModel.set("isAuthorizedCreatePortal", null);
            }
          }
          catch(e){
            console.error(e);
          }
        },

        /**
        * Displays an error message when rendering this view has failed.
        */
        showError: function(){

          //Remove the loading elements
          this.$(this.listContainer).find(".loading").remove();

          if( this.$(this.listContainer).children("tr").length == 0 ){

            //Show an error message
            MetacatUI.appView.showAlert(
              "Something went wrong while getting this list of portals.",
              "alert-error",
              this.$(this.listContainer));
          }
        }

      });

    });
