define(["jquery",
    "underscore",
    "backbone",
    "collections/Filters",
    "collections/SolrResults",
    "text!templates/portals/portalList.html"],
    function($, _, Backbone, Filters, SearchResults, Template){

      return Backbone.View.extend({

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
        searchResults: null,

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

              //Filter datasets by their ownership
              filters.add({
                fields: ["rightsHolder", "writePermission", "changePermission"],
                values: MetacatUI.appUserModel.get("allIdentitiesAndGroups"),
                operator: "OR",
                matchSubstring: false,
                exclude: false
              });

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

            //Create a collection of search results
            var searchResults = new SearchResults();
            this.searchResults = searchResults;

            //Set the query on the SearchResults
            searchResults.setQuery( filters.getQuery() );

            //Get 100 rows
            searchResults.rows = 100;

            //The fields to return
            searchResults.fields = "id,seriesId,title,formatId,label,logo";

            //Listen to the search results collection and render the results when the search is complete
            this.listenToOnce( searchResults, "reset", this.renderList );
            //Listen to the search results collection for errors
            this.listenToOnce( searchResults, "error", this.showError );

            //Get the first page of results
            searchResults.toPage(0);

            //Add a "Create" button to create a new portal
            this.renderCreateButton();
          }
          catch(e){
            console.error(e);
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
            if( !this.searchResults || !this.searchResults.length ){
              var row = this.createListItem();
              row.html("<td colspan='4'>You haven't created or have access to any " +
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

              //Create a logo image
              var logo = "";
              if( searchResult.get("logo") ){
                if( !searchResult.get("logo").startsWith("http") ){
                  searchResult.set("logo", MetacatUI.appModel.get("objectServiceUrl") + searchResult.get("logo"));
                }
                logo = $(document.createElement("img")).attr("src", searchResult.get("logo"));
              }

              //Create an Edit buttton
              var buttons = $(document.createElement("a")).attr("href",
                             MetacatUI.root + "/edit/"+ MetacatUI.appModel.get("portalTermPlural") +"/" + (searchResult.get("label") || searchResult.get("seriesId") || searchResult.get("id")) )
                             .text("Edit")
                             .addClass("btn");

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
              //If the user isn't authorized and the portal quota is not zero, then don't show the button
              if( MetacatUI.appUserModel.get("isAuthorizedCreatePortal") === false &&
                  MetacatUI.appUserModel.get("portalQuota") !== 0 ){
                return;
              }
              else{
                //Create a New portal buttton
                var createButton = $(document.createElement("a"))
                                   .addClass("btn btn-primary")
                                   .attr("href", MetacatUI.root + "/edit/" + MetacatUI.appModel.get("portalTermPlural"))
                                   .append( $(document.createElement("i")).addClass("icon icon-plus icon-on-left"),
                                     "New " + MetacatUI.appModel.get('portalTermSingular'));

                //If the user doesn't have any quota left, disable the button
                if( MetacatUI.appUserModel.get("portalQuota") === 0 ){
                  createButton.attr("disabled", "disabled")
                             .tooltip({
                               title: "You have reached your portal quota.",
                               delay: 500,
                               placement: "top",
                               trigger: "hover"
                             });
                }

                //Add the create button to the view
                this.$(this.createBtnContainer).html(createButton);
                //Reset the isAuthorizedCreatePortal attribute
                MetacatUI.appUserModel.set("isAuthorizedCreatePortal", null);
              }
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

          //Show an error message
          MetacatUI.appView.showAlert(
            "Something went wrong while getting this list of portals.",
            "alert-error",
            this.$(this.listContainer));
        }

      });

    });
