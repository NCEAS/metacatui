define(["jquery",
  "underscore",
  "backbone",
  "collections/Filters",
  "collections/bookkeeper/Usages",
  "views/portals/PortalListView",
  "text!templates/portals/portalList.html"],
  function($, _, Backbone, Filters, Usages, PortalListView, Template){

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

          //Insert the template
          this.$el.html(this.template());

          //When the collection has been fetched, redner the Usage list
          this.listenToOnce(this.usagesCollection, "sync", this.getSearchResultsForUsages);

          //Listen to the collection for errors
          this.listenToOnce(this.usagesCollection, "error", this.showError);

          //Fetch the collection
          this.usagesCollection.fetch({
            quotaType: "portal",
            subject: MetacatUI.appUserModel.get("username")
          });

          if(MetacatUI.appModel.get("enableCreatePortals")){
            //Add a "Create" button to create a new portal
            this.renderCreateButton();
          }

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
            this.filters.add({
              fields: ["seriesId"],
              values: portalIds,
              operator: "OR",
              matchSubstring: false,
              exclude: false
            });
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

      }

    });
});
