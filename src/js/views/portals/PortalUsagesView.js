define(["jquery",
  "underscore",
  "backbone",
  "collections/SolrResults",
  "collections/Filters",
  "collections/bookkeeper/Usages",
  "views/portals/PortalListView",
  "text!templates/portals/portalList.html"],
  function($, _, Backbone, SearchResults, Filters, Usages, PortalListView, Template){

    /**
    * @class PortalUsagesView
    * @classdesc A view that shows a list of Portal Usages
    * @extends PortalListView
    * @constructor
    */
    return PortalListView.extend(
      /** @lends PortalUsagesView.prototype */{

      /**
      * A reference to the Usages collection that is rendered in this view
      * @type {Usages}
      */
      usagesCollection: null,

      /**
      * Renders this view
      */
      render: function(){

        try{

          //If the "my portals" feature is disabled, exit now
          if(MetacatUI.appModel.get("showMyPortals") === false){
            return;
          }

          if( !this.usagesCollection ){
            this.usagesCollection = new Usages();
          }

          //When in DataONE Plus Preview mode, search for portals in Solr first,
          // then create Usage models for each portal in Solr.
          if( MetacatUI.appModel.get("dataonePlusPreviewMode") ){

            this.listenTo(this.searchResults, "sync", function(){

              //Create a Usage for each portal found in Solr
              this.searchResults.each(function(searchResult){
                this.usagesCollection.add({
                  instanceId: searchResult.get("seriesId"),
                  status: "active",
                  quantity: 1,
                  nodeId: searchResult.get("datasource")
                });
              }, this);

              //Merge the Usages and Search Results
              this.mergeSearchResults();

              //Update the view with info about the corresponding Usage model
              this.showUsageInfo();
            });

            if( MetacatUI.appModel.get("dataonePlusPreviewPortals").length ){

              this.altReposChecked = 0;
              this.altReposToCheck = [];
              this.additionalPortalsToDisplay = [];

              _.each( MetacatUI.appModel.get("alternateRepositories"), function(altRepo){

                var portalsInThisRepo = _.where(MetacatUI.appModel.get("dataonePlusPreviewPortals"),
                                          { datasource: altRepo.identifier });

                if( portalsInThisRepo.length ){

                  var searchResults = new SearchResults();
                  this.listenToOnce(searchResults, "reset", function(){

                    if( searchResults.length ){
                      this.additionalPortalsToDisplay = this.additionalPortalsToDisplay.concat( searchResults.models );
                    }

                    if(typeof this.altReposChecked == "number" ){
                      this.altReposChecked++;
                      if( this.altReposChecked == this.altReposToCheck ){
                        //Call the PortalListView render function
                        PortalListView.prototype.render.call(this);
                      }
                    }

                    //Create a Usage for each portal found in Solr
                    searchResults.each(function(searchResult){
                      this.usagesCollection.add({
                        instanceId: searchResult.get("seriesId"),
                        status: "active",
                        quantity: 1,
                        nodeId: searchResult.get("datasource")
                      });
                    }, this);

                    //Merge the Usages and Search Results
                    this.mergeSearchResults(searchResults);

                    //Update the view with info about the corresponding Usage model
                    this.showUsageInfo();

                  });

                  //Create a Filters() collection
                  var portalFilters = new Filters();
                  portalFilters.mustMatchIds = true;
                  portalFilters.addWritePermissionFilter();
                  portalFilters.add({
                    fields: ["obsoletedBy"],
                    values: ["*"],
                    matchSubstring: false,
                    exclude: true
                  });
                  portalFilters.add({
                    fields: ["datasource"],
                    values: [altRepo.identifier],
                    matchSubstring: false,
                    exclude: false
                  });
                  var portalIds = _.pluck(portalsInThisRepo, "seriesId");
                  portalFilters.add({
                    fields: ["seriesId"],
                    values: portalIds,
                    operator: "OR",
                    matchSubstring: false
                  });

                  searchResults.rows = portalIds.length;
                  searchResults.fields = this.searchFields;

                  searchResults.queryServiceUrl = altRepo.queryServiceUrl;

                  searchResults.setQuery( portalFilters.getQuery() );

                  this.altReposToCheck++;

                  //Get the first page of results
                  searchResults.toPage(0);
                }

              }, this);


              return;

            }

            //Call the PortalListView render function
            PortalListView.prototype.render.call(this);

            //Don't do anything else in this render function
            return;
          }

          //Insert the template
          this.$el.html(this.template());

          //When the collection has been fetched, redner the Usage list
          this.listenToOnce(this.usagesCollection, "sync", this.getSearchResultsForUsages);

          //Listen to the collection for errors
          this.listenToOnce(this.usagesCollection, "error", this.showError);

          //When the SearchResults are retrieved, merge them with the Usages collection
          this.listenToOnce(this.searchResults, "sync", function(){
            this.mergeSearchResults();

            //Update the view with info about the corresponding Usage model
            this.showUsageInfo();
          });

          //Fetch the collection
          this.usagesCollection.fetch({
            quotaType: "portal",
            subject: MetacatUI.appUserModel.get("username")
          });

        }
        catch(e){
          console.error("Failed to render the PortalUsagesView: ", e);
        }

      },

      /**
      * Using the Usages collection, this function creates Filters that search for
      * the portal objects for those Usages
      * @param {Usages} usages The Usages collection to get search results for
      */
      getSearchResultsForUsages: function(usages){

        try{

          //Set the number of portals to the number of usages found
          this.numPortals = this.usagesCollection.length;

          var portalIds = this.usagesCollection.pluck("instanceId");

          //If there are no given filters, create a Filter for the seriesId of each portal Usage
          if( !this.filters && portalIds.length ){
            this.filters = new Filters();

            this.filters.mustMatchIds = true;
            this.filters.add({
              fields: ["seriesId"],
              values: portalIds,
              operator: "OR",
              matchSubstring: false,
              exclude: false
            });

            //Only get Portals that the user is an owner of
            this.filters.addWritePermissionFilter();
          }
          //If the filters set on this view is an array of JSON, add it to a Filters collection
          else if( this.filters.length && !Filters.prototype.isPrototypeOf(this.filters) ){
            //Create search filters for finding the portals
            var filters = new Filters();

            filters.add( this.filters );

            this.filters = filters;
          }
          else{
            this.filters = new Filters();
          }

          this.getSearchResults();

        }
        catch(e){
          this.showError();
          console.error("Failed to create search results for the portal list: ", e);
        }

      },

      /**
      * Merges the SearchResults collection with the Usages collection
      */
      mergeSearchResults: function(searchResults){

        if(typeof searchResults == "undefined"){
          var searchResults = this.searchResults;
        }

        this.usagesCollection.mergeCollections(searchResults);

        //If in DataONE Plus Preview mode, total the portal count from Solr and use that as the portal totalUsage
        if( MetacatUI.appModel.get("dataonePlusPreviewMode") ){

          var portalQuotas = MetacatUI.appUserModel.getQuotas("portal");

          if( portalQuotas.length ){
            portalQuotas[0].set("totalUsage", this.usagesCollection.length);
          }

        }
      },

      /**
      * Shows the Usage info for each Portal in this view
      */
      showUsageInfo: function(){

        this.usagesCollection.each(function(usage){

          //Find the list item HTML element for this Usage
          var listItem = this.$("[data-seriesId='" + usage.get("instanceId") + "']");

          //If a list item is found, update it
          if( listItem.length ){

            //Disable the Edit button if the Usage status is "inactive"
            if( usage.get("status") == "inactive" ){
              listItem.find(".edit.btn")
                      .attr("disabled", "disabled")
                      .popover({
                        trigger: "hover focus click",
                        placement: "top",
                        delay: {
                          show: 800
                        },
                        html: true,
                        content: "To edit this " + MetacatUI.appModel.get("portalTermSingular") + ", contact us at " +
                                 "<a href='mailto:" + MetacatUI.appModel.get("emailContact") + "'>" +
                                 MetacatUI.appModel.get("emailContact") + "</a>" +
                                 " to activate it. It may be deactivated because your " +
                                  MetacatUI.appModel.get("dataonePlusName") + " membership has ended."
                      });
            }

          }

        }, this);

        //Add a "Create" button to create a new portal, since we know the total Usage and
        // remaining Quota now.
        this.renderCreateButton();

      }

    });
});
