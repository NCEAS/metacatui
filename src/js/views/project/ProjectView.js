define(["jquery",
        "underscore",
        "backbone",
        "models/project/ProjectModel",
        "models/Search",
        "models/Stats",
        "text!templates/alert.html",
        "text!templates/loading.html",
        "text!templates/project/project.html",
        "views/project/ProjectHeaderView",
        "views/project/ProjectDataView",
        "views/project/ProjectSectionView",
        "views/project/ProjectMembersView",
        "views/StatsView",
        "views/project/ProjectLogosView"
    ],
    function($, _, Backbone, Project, SearchModel, StatsModel, AlertTemplate, LoadingTemplate, ProjectTemplate, ProjectHeaderView,
        ProjectDataView, ProjectSectionView, ProjectMembersView, StatsView, ProjectLogosView) {
        "use_strict";
        /* The ProjectView is a generic view to render
         * projects, it will hold project sections
         */
        var ProjectView = Backbone.View.extend({

            /**
             * The Project element
             * @type {string}
             */
            el: "#Content",

            /**
             * The type of View this is
             * @type {string}
             */
            type: "Project",

            /**
             * The currently active editor section. e.g. Data, Metrics, Settings, etc.
             * @type {string}
             */
            activeSection: "",

            /**
             * The names of all sections in this project editor
             * @type {Array}
             */
            sectionNames: [],

            /**
             * The seriesId of the project document
             * @type {string}
             */
            projectId: "",

            /**
             * The unique short name of the project
             * @type {string}
             */
            label: "",

            /**
             * The subviews contained within this view to be removed with onClose
             * @type {Array}
             */
            subviews: new Array(), // Could be a literal object {} */

            /**
             * A Project Model is associated with this view and gets created during render()
             * @type {Project}
             */
            model: null,

            /* Renders the compiled template into HTML */
            template: _.template(ProjectTemplate),
            //A template to display a notification message
            alertTemplate: _.template(AlertTemplate),
            //A template for displaying a loading message
            loadingTemplate: _.template(LoadingTemplate),

            /**
             * The events this view will listen to and the associated function to call.
             * @type {Object}
             */
            events: {
              "click #metrics-link" : "renderMetricsView"
            },

            /**
             * Creates a new ProjectView
             * @constructs ProjectView
             */
            initialize: function(options) {
                // Set the current ProjectView properties
                this.projectId = options.projectId ? options.projectId : undefined;
                this.label = options.label ? options.label : undefined;
                this.activeSection = options.activeSection ? options.activeSection : undefined;
            },

            /**
             * Initial render of the ProjectView
             *
             * @return {ProjectView} Returns itself for easy function stacking in the app
             */
            render: function() {

                $("body").addClass("ProjectView");

                // Create a new Project model
                this.model = new Project({
                    seriesId: this.projectId,
                    label: this.label
                });

                // When the model has been synced, render the results
                this.stopListening();
                this.listenTo(this.model, "sync", this.renderProject);

                //If the project isn't found, display a 404 message
                this.listenToOnce(this.model, "notFound", this.showNotFound);

                //Fetch the model
                this.model.fetch({ objectOnly: true });

                return this;
            },

            /**
             * Render the Project view
             */
            renderProject: function() {

                // Insert the overall project template
                this.$el.html(this.template(this.model.toJSON()));

                //Render the header view
                this.headerView = new ProjectHeaderView({
                    model: this.model
                });
                this.headerView.render();
                this.subviews.push(this.headerView);

                //Render the content sections
                _.each(this.model.get("sections"), function(section){
                  this.addSection(section);
                }, this);

                // Render the Data section
                if(!this.model.get("hideData")) {
                    this.sectionDataView = new ProjectDataView({
                        model: this.model,
                        id: "Data",
                        sectionName: "Data"
                    });
                    this.subviews.push(this.sectionDataView);

                    this.$("#project-sections").append(this.sectionDataView.el);

                    //Render the section view and add it to the page
                    this.sectionDataView.render();

                    this.addSectionLink( this.sectionDataView );
                }

                //Render the metrics section
                //Create a navigation link
                this.$("#project-section-tabs").append(
                  $(document.createElement("li"))
                    .append( $(document.createElement("a"))
                               .text("Metrics")
                               .attr("id", "metrics-link")
                               .attr("href", "#Metrics" )
                               .attr("data-toggle", "tab")));

                this.$("#project-sections").append( $(document.createElement("div"))
                                                    .attr("id", "Metrics")
                                                    .addClass("tab-pane") );

                // Render the members section
                if (!this.model.get("hideMembers")) {
                    this.sectionMembersView = new ProjectMembersView({
                        model: this.model,
                        id: "Members",
                        sectionName: "Members"
                    });
                    this.subviews.push(this.sectionMembersView);

                    this.$("#project-sections").append(this.sectionMembersView.el);

                    //Render the section view and add it to the page
                    this.sectionMembersView.render();

                    this.addSectionLink( this.sectionMembersView );
                }

                //Switch to the active section
                this.switchSection();

                //Space out the tabs evenly
                var widthEach = 100/this.$("#project-section-tabs").children().length;
                this.$("#project-section-tabs").children().css("width", widthEach + "%");

                //Render the logos at the bottom of the project page
                var ackLogos = this.model.get("acknowledgmentsLogos") || [];
                this.logosView = new ProjectLogosView();
                this.logosView.logos = ackLogos;
                this.subviews.push(this.logosView);
                this.logosView.render();
                this.$(".project-view").append(this.logosView.el);

                //Scroll to an inner-page link if there is one specified
                if( window.location.hash && this.$(window.location.hash).length ){
                  MetacatUI.appView.scrollTo(this.$(window.location.hash));
                }

            },

            /**
              * Update the path when tabs are clicked
              * @param {Event} [e] - The click event on the navigation elements (tabs)
             */
            updatePath: function(e){

              if(e){
                var sectionView = $(e.target).data("view");
                if( typeof sectionView !== "undefined"){
                  sectionView.postRender();
                }

                // Get the href of the clicked link
                var linkTarget = $(e.target).attr("href");
                linkTarget = linkTarget.substring(1);

                // Set this view's active section name to the link href
                this.activeSection = linkTarget;
              }

              var label = this.label,
                  pathName = window.location.pathname,
                  section  = this.activeSection;

              //Get the new pathname using the active section
              if( !MetacatUI.root.length || MetacatUI.root == "/" ){
                // If it's a new project, the project name might not be in the URL yet
                if(pathName.indexOf(label) < 0){
                  var newPathName = pathName + "/" + label + "/" + section;
                } else {
                  var newPathName = pathName.substring(0, pathName.indexOf(label)) +
                                      label + "/" + section;
                }
              }
              else{
                var newPathName = pathName.substring( pathName.indexOf(MetacatUI.root) + MetacatUI.root.length );
                newPathName = newPathName.substring(0, newPathName.indexOf(label)) +
                                    label + "/" + section;
              }
              //Update the window location
              MetacatUI.uiRouter.navigate( newPathName, { trigger: false } );

            },

            /**
             * Gets a list of section names from tab elements and updates the
             * sectionNames attribute on this view.
             */
            updateSectionNames: function() {

              // Get the section names from the tab elements
              var sectionNames = [];
              this.$("#project-section-tabs")
                .children("li")
                .children("a[href]")
                .each(function(i, anchorEl){
                  sectionNames[i] = $(anchorEl)
                                      .attr("href")
                                      .substring(1)
                });

              // Set the array of sectionNames on the view
              this.sectionNames = sectionNames
            },

            /**
             * Manually switch to a section subview by making the tab and tab panel active.
             * Navigation between sections is usually handled automatically by the Bootstrap
             * library, but a manual switch may be necessary sometimes
             * @param {string} [sectionName] - The section to switch to. If not given, defaults to the activeSection set on the view.
             */
            switchSection: function(sectionName){

              // Make sure the list of section names is up to date
              this.updateSectionNames();

              // If no section name is given, use the active section in the view.
              // If there's also no activeSection, then default to an empty string,
              // which will set the navigation to the first section listed
              if( !sectionName ){
                var sectionName = this.activeSection || ""
              }

              // Match the section name to the list of section names on the view
              // Allow case insensitive navigation to sections
              i = this.sectionNames
                    .map(v => v.toLowerCase())
                    .indexOf(
                      sectionName.toLowerCase()
                    );

              // If there was a match
              if(i>=0){
                sectionName = this.sectionNames[i];
              //Otherwise, switch to the first section listed
              } else {
                if(this.sectionNames.length){
                  sectionName = this.sectionNames[0]
                }
              }

              // Update the activeSection set on the view for consistency with the path
              // and with capitalization
              this.activeSection = sectionName;

              // Render the metrics section if user navigated directly there
              if( sectionName == "Metrics" ){
                this.renderMetricsView();
              }

              // Activate the section content
              this.$(".tab-content").children("#" + sectionName).addClass("active");

              // Activate the tab
              this.$(".nav-tabs").children().each(function(i, li){
                if($(li).children().attr("href") == "#" + sectionName){
                  $(li).addClass("active")
                };
              });

              // Update the path with the new active section
              this.updatePath();

              // Update path when each tab is clicked and shown
              view = this;
              this.$('a[data-toggle="tab"]').on('shown', function(e){
                view.updatePath(e)
              });

            },

            /**
             * Creates a ProjectSectionView to display the content in the given project
             * section. Also creates a navigation link to the section.
             *
             * @param {ProjectSectionModel} sectionModel - The section to render in this view
             */
            addSection: function(sectionModel){

              //Create a new ProjectSectionView
              var sectionView = new ProjectSectionView({
                model: sectionModel
              });

              //Render the section
              sectionView.render();

              //Add the section view to this project view
              this.$("#project-sections").append(sectionView.el);

              this.addSectionLink( sectionView );

            },

            /**
             * Add a link to a section of this project page
             * @param {ProjectSectionView} sectionView - The view to add a link to
             */
            addSectionLink: function(sectionView){

              var label = sectionView.getName();
              var hrefLabel = sectionView.getName({ linkFriendly: true });

              //Create a navigation link
              this.$("#project-section-tabs").append(
                $(document.createElement("li"))
                  .append( $(document.createElement("a"))
                             .text(label)
                             .attr("href", "#" + hrefLabel )
                             .attr("data-toggle", "tab")
                             .data("view", sectionView)));

            },

            /**
             * Render the metrics section
             */
            renderMetricsView: function() {

              if( this.model.get("hideMetrics") ) {
                return;
              }

              //If this subview is already rendered, exit
              if( this.sectionMetricsView ){
                return;
              }

              //Add a loading message to the metrics tab since it can take a while for the metrics query to be sent
              this.$("#Metrics").html(this.loadingTemplate({
                msg: "Getting metrics..."
              }));

              //If the search results haven't been fetched yet, wait. We need the
              // facet counts for the metrics view.
              if( !this.model.get("searchResults").length ){
                this.listenToOnce( this.model.get("searchResults"), "sync", this.renderMetricsView );
                return;
              }

              //Get all the facet counts from the search results collection
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

                //Create a search model that filters by all the data object Ids
                var statsSearchModel = new SearchModel({
                  idOnly: allIDs,
                  formatType: [],
                  exclude: []
                });

                //Create a StatsModel
                var statsModel = new StatsModel({
                  query: statsSearchModel.getQuery(),
                  searchModel: statsSearchModel,
                  supportDownloads: false
                });

              }

              // add a stats view
              this.sectionMetricsView = new StatsView({
                  title: "Statistics and Figures",
                  description: "A summary of all datasets from " + this.model.get("label"),
                  el: "#Metrics",
                  model: statsModel
              });

              this.sectionMetricsView.render();

              this.subviews.push(this.sectionMetricsView);

            },

            /**
             * If the given project doesn't exist, display a Not Found message.
             */
            showNotFound: function(){

              var notFoundMessage = "The project \"" + (this.label || this.projectId) +
                                    "\" doesn't exist.",
                  notification = this.alertTemplate({
                    classes: "alert-error",
                    msg: notFoundMessage,
                    includeEmail: true
                  });

              this.$el.html(notification);

            },

            /**
             * This function is called when the app navigates away from this view.
             * Any clean-up or housekeeping happens at this time.
             */
            onClose: function() {
                //Remove each subview from the DOM and remove listeners
                _.invoke(this.subviews, "remove");

                this.subviews = new Array();

                delete this.sectionMetricsView;

                $("body").removeClass("ProjectView");
            }
        });

        return ProjectView;
    });
