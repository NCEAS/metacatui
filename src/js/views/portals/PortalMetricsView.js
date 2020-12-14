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
     * @classcategory Views/Portals
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
        hideMetadataAssessment: MetacatUI.appModel.get("hideSummaryMetadataAssessment"),


        /**
        * Aggregated Citation Metrics flag
        * @type {boolean}
        */
        hideCitationsChart: MetacatUI.appModel.get("hideSummaryCitationsChart"),


        /**
        * Aggregated Download Metrics flag
        * @type {boolean}
        */
        hideDownloadsChart: MetacatUI.appModel.get("hideSummaryDownloadsChart"),


        /**
        * Aggregated View Metrics flag
        * @type {boolean}
        */
        hideViewsChart: MetacatUI.appModel.get("hideSummaryViewsChart"),

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
            if( !MetacatUI.appModel.get("enableSolrJoins") && !this.model.get("searchResults").header ){
              this.listenToOnce( this.model.get("searchResults"), "sync", this.renderMetrics );
              return;
            }

            //Create a Stats Model for retrieving and storing all of the statistics
            var statsModel = new StatsModel();

            //If Solr Joins are enabled, set the query on the StatsModel using the Portal Filters
            if( MetacatUI.appModel.get("enableSolrJoins") && this.model.get("definitionFilters") ){

              statsModel.set("query", this.model.getQuery());

            }
            //Otherwise, construct a query using a Search model and all of the ID facet counts
            else{

              // Get all the facet counts from the search results collection
              var facetCounts = this.model.get("allSearchResults").facetCounts,
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

              // Create a search model that filters by all the data object Ids
              var statsSearchModel = new SearchModel({
                idOnly: allIDs,
                formatType: [],
                exclude: []
              });

              //Sett the query using the query constructing by the Search Model
              statsModel.set("query", statsSearchModel.getQuery());
              //Save a reference to the Search Model on the Stats model
              statsModel.set("searchModel", statsSearchModel);
            }

            var userType = "portal";

            var label_list = [];
            label_list.push(this.model.get("label"));

            var metricsModel = new MetricsModel();
            this.metricsModel = metricsModel;

            if (this.nodeView) {

              userType = "repository";

              // TODO: replace the following logic with dataone bookkeeper service
              // check if the repository is a dataone member
              var dataoneHostedRepos = MetacatUI.appModel.get("dataoneHostedRepos");

              if ((typeof dataoneHostedRepos !== 'undefined') && Array.isArray(dataoneHostedRepos) &&
                  dataoneHostedRepos.includes(this.model.get("seriesId"))){

                if( MetacatUI.appModel.get("hideSummaryMetadataAssessment") !== true )
                  this.hideMetadataAssessment = false;

                if( MetacatUI.appModel.get("hideSummaryCitationsChart") !== true )
                  this.hideCitationsChart = false;

                if( MetacatUI.appModel.get("hideSummaryDownloadsChart") !== true )
                  this.hideDownloadsChart = false;

                if( MetacatUI.appModel.get("hideSummaryViewsChart") !== true )
                  this.hideViewsChart = false;
              }
              //Hide all of the metrics charts
              else{
                this.hideMetadataAssessment = true;
                this.hideCitationsChart = true;
                this.hideDownloadsChart = true;
                this.hideViewsChart     = true;
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

              // creating additional filters for portal Metrics
              var portalQueryFilter = {};
              var portalCollectionQuery = statsModel.get("query");
              portalQueryFilter["filterType"] = "query";
              portalQueryFilter["values"] = [portalCollectionQuery];
              portalQueryFilter["interpretAs"] = "list";
              this.metricsModel.set("filterQueryObject", portalQueryFilter);
            }

            this.metricsModel.fetch();

            // Add a stats view
            this.statsView = new StatsView({
                title: null,
                description: null,
                metricsModel: this.metricsModel,
                el: document.createElement("div"),
                model: statsModel,
                userType: userType,
                userId: this.model.get("seriesId"),
                userLabel: this.model.get("label"),
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
            this.handlePortalMetricsError(e);
          }

        },

        /**
         * Handles error display if something went wrong while displaying metrics
        */
       handlePortalMetricsError: function(error, errorDisplayMessage){

          if(!errorDisplayMessage) {
            var errorDisplayMessage = "<p>Sorry, we couldn't retrieve metrics for the \"" + (this.model.get("label") || this.model.get("portalId")) +
                "\" portal at this time.</p>"
          }

          //Send this exception to Google Analytics
          if(MetacatUI.appModel.get("googleAnalyticsKey") && (typeof ga !== "undefined")){
            var gaMetricsErrorMessage = "Failed to render the Metrics view for the portal: " + (this.model.get("label") || this.model.get("portalId")) + " | v. " + MetacatUI.metacatUIVersion;
            ga("send", "exception", {
              "exDescription": gaMetricsErrorMessage,
              "exFatal": false
            });
          }

          //Show a warning message about the metrics error
          MetacatUI.appView.showAlert(
            errorDisplayMessage,
            "alert-warning",
            this.$el
          );
          this.$(".loading").remove();

          console.log("Failed to render the metrics view. Error message: " + error);
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
