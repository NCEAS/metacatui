define(["jquery",
    "underscore",
    "backbone",
    "models/Search",
    "models/MetricsModel",
    "models/Stats",
    "views/portals/PortalSectionView",
    "views/StatsView",
    "text!templates/loading.html"],
    function($, _, Backbone, SearchModel, MetricsModel, StatsModel, PortalSectionView, StatsView,
      LoadingTemplate){

    /**
     * @class PortalMetricsView
     * @classdec The PortalMetricsView is a view to render the
     * portal metrics tab (within PortalSectionView)
     * @extends PortalSectionView
     * @constructor
     */
     var PortalMetricsView = PortalSectionView.extend(
       /** @lends PortalMetricsView.prototype */{
        type: "PortalMetrics",

        /**
        * A unique name for this Section
        * @type {string}
        */
        uniqueSectionLabel: "Metrics",

        /**
        * The display name for this Section
        * @type {string}
        */
        sectionName: "Metrics",

        /**
        * The Portal Model this Metrics section is part of
        * @type {Portal}
        */
        model: undefined,

        /**
        * Aggregated Quality Metrics flag
        * @type {boolean}
        */
        hideMetadataAssessment: false,


        /**
        * Aggregated Citation Metrics flag
        * @type {boolean}
        */
        hideCitationsChart: false,


        /**
        * Aggregated Download Metrics flag
        * @type {boolean}
        */
        hideDownloadsChart: false,


        /**
        * Aggregated View Metrics flag
        * @type {boolean}
        */
        hideViewsChart: false,

        /**
        A template for displaying a loading message
        * @type {Underscore.Template}
        */
        loadingTemplate: _.template(LoadingTemplate),

        /* Render the view */
        render: function() {

            if( this.model && this.model.get("metricsLabel") ){
              this.uniqueSectionLabel = this.model.get("metricsLabel");
              this.sectionName = this.model.get("metricsLabel");
            }

            this.$el.data("view", this);

            //Add a loading message to the metrics tab since it can take a while for the metrics query to be sent
            this.$el.html(this.loadingTemplate({
              msg: "Getting " + this.model.get("metricsLabel").toLowerCase() + "..."
            }));

        },

        /**
         * Render the metrics inside this view
         */
        renderMetrics: function() {

          try{

            if( this.model.get("hideMetrics") == true ) {
              return;
            }

            // If the search results haven't been fetched yet, wait.
            if( !this.model.get("searchResults").header ){
              this.listenToOnce( this.model.get("searchResults"), "sync", this.renderMetrics );
              return;
            }

            // If there are no datasets in the portal collection
            if(this.model.get("searchResults").header.get("numFound") == 0 ){
                  // The description for when there is no data in the collection
              var description = "There are no datasets in " + this.model.get("label") + " yet.",
                  // use a dummy-ID to create a 'no-activity' metrics view
                  allIDs = "0";
            }
            // For portals with data in the collection
            else {
                  // The description to use for a portal with data
              var description = "A summary of all datasets from " + this.model.get("label"),
                  // Get all the facet counts from the search results collection
                  facetCounts = this.model.get("allSearchResults").facetCounts,
                  //Get the id facet counts
                  idFacets = facetCounts? facetCounts.id : [],
                  //Get the documents facet counts
                  documentsFacets = facetCounts? facetCounts.documents : [],
                  //Start an array to hold all the ids
                  allIDs = [];

              //If there are resource map facet counts, get all the ids
              if( idFacets && idFacets.length ){

                //Merge the id and documents arrays
                var allFacets = idFacets.concat(documentsFacets);

                //Get all the ids, which should be every other element in the
                // facets array
                for( var i=0; i < allFacets.length; i+=2 ){
                  allIDs.push( allFacets[i] );
                }
              }

            }

            // Create a search model that filters by all the data object Ids
            var statsSearchModel = new SearchModel({
              idOnly: allIDs,
              formatType: [],
              exclude: []
            });

            // Create a StatsModel
            var statsModel = new StatsModel({
              query: statsSearchModel.getQuery(),
              searchModel: statsSearchModel,
              supportDownloads: false
            });

            var label_list = [];
            label_list.push(this.model.get("label"));

            var metricsModel = new MetricsModel();
            this.metricsModel = metricsModel;

            if (this.nodeView) {

              // TODO: replace the following logic with dataone bookkeeper service
              // check if the repository is a dataone member
              if (MetacatUI.appModel.get("dataonePlusMembers").includes(this.model.get("seriesId"))) {
                this.hideMetadataAssessment = false || MetacatUI.appModel.get("hideRepositoryMetadataAssessments");
                this.hideCitationsChart = false || MetacatUI.appModel.get("hideRepositoryCitationsChart");
                this.hideDownloadsChart = false || MetacatUI.appModel.get("hideRepositoryDownloadsChart");
                this.hideViewsChart = false || MetacatUI.appModel.get("hideRepositoryViewsChart");
              }
              else{
                this.hideMetadataAssessment = true;
                this.hideCitationsChart = true;
                this.hideDownloadsChart = true;
                this.hideViewsChart = true;
              }

              // set the statsModel
              statsModel = MetacatUI.statsModel;

              if (!this.hideCitationsChart || !this.hideDownloadsChart || !this.hideViewsChart) {
                // create a metrics query for repository object
                var pid_list = new Array();
                pid_list.push(this.model.get("seriesId"));
                this.metricsModel.set("pid_list", pid_list);
                this.metricsModel.set("filterType", "repository");
              }
              else{
                this.metricsModel.set("pid_list", []);
                this.metricsModel.set("filterType", "");
              }
            }
            else {
              // create a metrics query for portal object
              this.metricsModel.set("pid_list", label_list);
              this.metricsModel.set("filterType", "portal");
            }
            
            this.metricsModel.fetch();

            // Add a stats view
            this.statsView = new StatsView({
                title: "Statistics and Figures",
                description: description,
                metricsModel: this.metricsModel,
                el: document.createElement("div"),
                model: statsModel,
                userType: "portal",
                hideMetadataAssessment: this.hideMetadataAssessment,
                // Rendering metrics on the portal
                hideCitationsChart: this.hideCitationsChart,
                hideDownloadsChart: this.hideDownloadsChart,
                hideViewsChart: this.hideViewsChart,
            });

            //Insert the StatsView into this view
            this.$el.html(this.statsView.el);

            //Render the StatsView
            this.statsView.render();

          }
          catch(e){
            console.log("Failed to render the metrics view. Error message: " + e);
          }

        },

        /**
         * Functionality to execute after the view has been created and rendered initially
         */
        postRender: function(){
          //If there is no StatsView rendered yet, then render it
          if( !this.statsView ){
            this.renderMetrics();
          }
        }

     });

     return PortalMetricsView;
});
