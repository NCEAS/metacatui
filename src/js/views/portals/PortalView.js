define(["jquery",
        "underscore",
        "backbone",
        "models/portals/PortalModel",
        "text!templates/alert.html",
        "text!templates/loading.html",
        "text!templates/portals/portal.html",
        "text!templates/portals/editPortals.html",
        "views/portals/PortalHeaderView",
        "views/portals/PortalDataView",
        "views/portals/PortalSectionView",
        "views/portals/PortalMetricsView",
        "views/portals/PortalMembersView",
        "views/portals/PortalLogosView"
    ],
    function($, _, Backbone, Portal, AlertTemplate, LoadingTemplate, PortalTemplate, EditPortalsTemplate, PortalHeaderView,
        PortalDataView, PortalSectionView, PortalMetricsView, PortalMembersView, PortalLogosView) {
        "use_strict";
        /* The PortalView is a generic view to render
         * portals, it will hold portal sections
         */
        var PortalView = Backbone.View.extend({

            /**
             * The Portal element
             * @type {string}
             */
            el: "#Content",

            /**
             * The type of View this is
             * @type {string}
             */
            type: "Portal",

            /**
             * The currently active section view
             * @type {PortalSectionView}
             */
            activeSection: undefined,

            /**
            * The currently active section label. e.g. Data, Metrics, Settings, etc.
            * @type {string}
            */
            activeSectionLabel: "",

            /**
             * The names of all sections in this portal editor
             * @type {Array}
             */
            sectionNames: [],

            /**
             * The seriesId of the portal document
             * @type {string}
             */
            portalId: "",

            /**
             * The unique short name of the portal
             * @type {string}
             */
            label: "",

            /**
            * Flag to add section name to URL. Enabled by default.
            * @type {boolean}
            */
            displaySectionInUrl: true,

            /**
             * The subviews contained within this view to be removed with onClose
             * @type {Array}
             */
            subviews: new Array(), // Could be a literal object {} */

            /**
             * A Portal Model is associated with this view and gets created during render()
             * @type {Portal}
             */
            model: null,

            /* Renders the compiled template into HTML */
            template: _.template(PortalTemplate),
            //A template to display a notification message
            alertTemplate: _.template(AlertTemplate),
            //A template for displaying a loading message
            loadingTemplate: _.template(LoadingTemplate),
            // Template for the 'edit portal' button
            editPortalsTemplate: _.template(EditPortalsTemplate),

            /**
            * A jQuery selector for the element that a single section link will be inserted into
            * @type {string}
            */
            sectionLinkContainer: ".section-link-container",
            /**
            * A jQuery selector for the elements that are links to the individual sections
            * @type {string}
            */
            sectionLinks: ".portal-section-link",
            /**
            * A jQuery selector for the section elements
            * @type {string}
            */
            sectionEls: ".portal-section-view",
            /**
             * The events this view will listen to and the associated function to call.
             * @type {Object}
             */
            events: {
              "click .portal-section-link"   : "handleSwitchSection",
              "click .section-links-container" : "toggleSectionLinks"
            },

            /**
             * Creates a new PortalView
             * @constructs PortalView
             */
            initialize: function(options) {
                // Set the current PortalView properties
                this.portalId = options.portalId ? options.portalId : undefined;
                this.label = options.label ? options.label : undefined;
                this.activeSection = options.activeSection ? options.activeSection : undefined;
                this.activeSectionLabel = options.activeSectionLabel ? options.activeSectionLabel : undefined;
            },

            /**
             * Initial render of the PortalView
             *
             * @return {PortalView} Returns itself for easy function stacking in the app
             */
            render: function() {

                // Add the overall class immediately so the navbar is styled correctly right away
                $("body").addClass("PortalView");

                this.$el.html(this.loadingTemplate({
                  msg: "Loading..."
                }));

                // Create a new Portal model
                this.model = new Portal({
                    seriesId: this.portalId,
                    label: this.label
                });

                // When the model has been synced, render the results
                this.stopListening();
                this.listenToOnce(this.model, "sync", this.renderPortal);

                //If the portal isn't found, display a 404 message
                this.listenToOnce(this.model, "notFound", this.showNotFound);

                //Listen to errors that might occur during fetch()
                this.listenToOnce(this.model, "error", this.showError);

                //Fetch the model
                this.model.fetch({ objectOnly: true });

                return this;
            },

            /**
             * Render the Portal view
             */
            renderPortal: function() {


              // Add edit button if user is authorized
              this.insertOwnerControls();

              // Getting the correct portal label and seriesID
              this.label = this.model.get("label");
              this.portalId = this.model.get("seriesId");

              // Remove the listeners that were set during the fetch() process
              this.stopListening(this.model, "notFound", this.showNotFound);
              this.stopListening(this.model, "error", this.showError);

                // Insert the overall portal template
                this.$el.html(this.template(this.model.toJSON()));

                // Render the header view
                this.headerView = new PortalHeaderView({
                    model: this.model
                });
                this.headerView.render();
                this.subviews.push(this.headerView);

                // Render the content sections
                _.each(this.model.get("sections"), function(section){
                  this.addSection(section);
                }, this);

                // Render the Data section
                if( this.model.get("hideData") !== true ) {
                    this.sectionDataView = new PortalDataView({
                        model: this.model,
                        id: "Data",
                        sectionName: "Data"
                    });
                    this.subviews.push(this.sectionDataView);

                    this.$("#portal-sections").append(this.sectionDataView.el);

                    //Render the section view and add it to the page
                    this.sectionDataView.render();

                    this.addSectionLink( this.sectionDataView );
                }

                //Render the metrics section link
                if ( this.model.get("hideMetrics") !== true ) {

                  //Create a PortalMetricsView
                  var metricsView = new PortalMetricsView({
                    model: this.model,
                    id: this.model.get("metricsLabel"),
                    uniqueSectionName: this.model.get("metricsLabel")
                  });

                  this.subviews.push(metricsView);
                  this.$("#portal-sections").append(metricsView.el);

                  metricsView.render();

                  this.addSectionLink( metricsView );

                }

                // Render the members section
                if ( this.model.get("hideMembers") !== true &&
                     (this.model.get("associatedParties").length || this.model.get("acknowledgments"))){

                    this.sectionMembersView = new PortalMembersView({
                        model: this.model,
                        id: "Members",
                        sectionName: "Members"
                    });
                    this.subviews.push(this.sectionMembersView);

                    this.$("#portal-sections").append(this.sectionMembersView.el);

                    //Render the section view and add it to the page
                    this.sectionMembersView.render();

                    this.addSectionLink( this.sectionMembersView );
                }

                //Switch to the active section
                this.switchSection();

                //Render the logos at the bottom of the portal page
                var ackLogos = this.model.get("acknowledgmentsLogos") || [];
                this.logosView = new PortalLogosView();
                this.logosView.logos = ackLogos;
                this.subviews.push(this.logosView);
                this.logosView.render();
                this.$(".portal-view").append(this.logosView.el);

                //Scroll to an inner-page link if there is one specified
                if( window.location.hash && this.$(window.location.hash).length ){
                  MetacatUI.appView.scrollTo(this.$(window.location.hash));
                }


                // Save reference to this view
                var view = this;

                // On mobile, hide section tabs a moment after page loads so
                // users notice where they are
                setTimeout(function () {
                  view.toggleSectionLinks();
                }, 700);

                // On mobile where the section-links-container is set to fixed,
                // hide the portal navigation element when user scrolls down,
                // show again when the user scrolls up.
                MetacatUI.appView.prevScrollpos = window.pageYOffset;
                $(window).on("scroll", "", undefined, this.handleScroll);

            },

            /**
             * toggleSectionLinks - show or hide the section links nav. Used for
             * mobile/small screens only.
             */
            toggleSectionLinks: function(){
              try{
                // Only toggle the section links on mobile. On mobile, the
                // ".show-sections-toggle" is visible.
                if(this.$(".show-sections-toggle").is(":visible")){
                  this.$("#portal-section-tabs").slideToggle();
                }
              } catch(e){
                console.log("Failed to toggle section links, error message: " + e);
              }
            },

            /*
             * Checks the authority for the logged in user for this portal and
             * inserts control elements onto the page for the user to interact
             * with the portal. So far, this is just an 'edit portal' button.
             */
            insertOwnerControls: function(){

              // Insert the button into the navbar
              var container = $(".edit-portal-link-container");

              var model = this.model;

              this.listenToOnce(this.model, "change:isAuthorized", function(){
                if(!model.get("isAuthorized")){
                  return false;
                } else {
                  container.html(
                    this.editPortalsTemplate({
                      editButtonText: "Edit " + MetacatUI.appModel.get('portalTermSingular'),
                      pathToEdit: MetacatUI.root + "/edit/"+ MetacatUI.appModel.get("portalTermPlural") +"/" + model.get("label")
                    })
                  );
                }
              });

              this.model.checkAuthority("write");
            },

            /**
             * Update the window location path with the active section name
             * @param {boolean} [showSectionLabel] - If true, the section label will be added to the path
            */
            updatePath: function(showSectionLabel){

              var label         = this.model.get("label") || this.newPortalTempName,
                  originalLabel = this.model.get("originalLabel") || this.newPortalTempName,
                  pathName      = decodeURIComponent(window.location.pathname)
                                  .substring(MetacatUI.root.length)
                                  // remove trailing forward slash if one exists in path
                                  .replace(/\/$/, "");

              // Add or replace the label and section part of the path with updated values.
              // pathRE matches "/label/section", where the "/section" part is optional
              var pathRE = new RegExp("\\/(" + label + "|" + originalLabel + ")(\\/[^\\/]*)?$", "i");
              newPathName = pathName.replace(pathRE, "") + "/" + label;

              if( showSectionLabel && this.activeSection ){
                newPathName += "/" + this.activeSection.uniqueSectionLabel;
              }

              // Update the window location
              MetacatUI.uiRouter.navigate( newPathName, { trigger: false } );

            },

            /**
             * Gets a list of section names from tab elements and updates the
             * sectionNames attribute on this view.
             */
            updateSectionNames: function() {

              // Get the section names from the tab elements
              var sectionNames = [];
              this.$(this.sectionLinks)
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
            * @param {PortalSectionView} [sectionView] - The section view to switch to. If not given, defaults to the activeSection set on the view.
            */
            switchSection: function(sectionView){

              //Create a flag for whether the section label should be shown in the URL
              var showSectionLabelInURL = true;

              // If no section view is given, use the active section in the view.
              if( !sectionView ){
                //Use the sectionView set already
                if( this.activeSection ){
                  var sectionView = this.activeSection;
                }
                //Or find the section view by name, which may have been passed through the URL
                else if( this.activeSectionLabel ){
                  var sectionView = this.getSectionByLabel(this.activeSectionLabel);
                }
              }

              //If no section view was indicated, just default to the first visible one
              if( !sectionView ){
                var sectionView = this.$(this.sectionLinkContainer).first().data("view");

                //If we are defaulting to the first section, don't show the section label in the URL
                showSectionLabelInURL = false;

                //If there are no section views on the page at all, exit now
                if( !sectionView ){
                  return;
                }
              }

              // Update the activeSection set on the view
              this.activeSection = sectionView;


              // Activate the section content
              this.$(this.sectionEls).each(function(i, contentEl){
                if($(contentEl).data("view") == sectionView){
                  $(contentEl).addClass("active");
                } else {
                  // make sure no other sections are active
                  $(contentEl).removeClass("active");
                }
              });

              // Activate the link to the content
              this.$(this.sectionLinkContainer).each(function(i, linkEl){
                if( $(linkEl).data("view") == sectionView ){
                  $(linkEl).addClass("active")
                } else {
                  // make sure no other sections are active
                  $(linkEl).removeClass("active")
                };
              });

              //If the section view has post-render functionality, execute it now
              if( typeof sectionView.postRender == "function" ){
                sectionView.postRender();
              }

              //Update the location path with the new section name
              this.updatePath(showSectionLabelInURL);

            },

            /**
            * When a section link has been clicked, switch to that section
            * @param {Event} e - The click event on the section link
            */
            handleSwitchSection: function(e){

              e.preventDefault();

              var sectionView = $(e.target).parents(this.sectionLinkContainer).first().data("view");

              if( sectionView ){
                this.switchSection(sectionView);
              }

            },

            /**
            * Returns the section view that has a label matching the one given.
            * @param {string} label - The label for the section
            * @return {PortalSectionView|false} - Returns false if a matching section view isn't found
            */
            getSectionByLabel: function(label){

              //If no label is given, exit
              if(!label){
                return;
              }

              //Find the section view whose unique label matches the given label. Case-insensitive matching.
              return _.find( this.subviews, function(view){
                if( typeof view.uniqueSectionLabel == "string" ){
                  return view.uniqueSectionLabel.toLowerCase() == label.toLowerCase();
                }
                else{
                  return false;
                }
              });
            },

            /**
            * Creates and returns a unique label for the given section. This label is just used in the view,
            * because portal sections can have duplicate labels. But unique labels need to be used for navigation in the view.
            * @param {PortEditorSection} sectionModel - The section for which to create a unique label
            * @return {string} The unique label string
            */
            getUniqueSectionLabel: function(sectionModel){
              //Get the label for this section
              var sectionLabel = sectionModel.get("label").replace(/[^a-zA-Z0-9 ]/g, "").replace(/ /g, "-"),
                  unalteredLabel = sectionLabel,
                  sectionLabels = this.sectionLabels || [],
                  i = 2;

              //Concatenate a number to the label if this one already exists
              while( sectionLabels.includes(sectionLabel) ){
                sectionLabel = unalteredLabel + i;
                i++;
              }

              return sectionLabel;
            },

            /**
             * Creates a PortalSectionView to display the content in the given portal
             * section. Also creates a navigation link to the section.
             *
             * @param {PortalSectionModel} sectionModel - The section to render in this view
             */
            addSection: function(sectionModel){

              //Create a new PortalSectionView
              var sectionView = new PortalSectionView({
                model: sectionModel
              });

              //Render the section
              sectionView.render();

              //Add the section view to this portal view
              this.$("#portal-sections").append(sectionView.el);

              this.addSectionLink( sectionView );

              //Create a unique label for this section and save it
              var uniqueLabel = this.getUniqueSectionLabel(sectionModel);
              //Set the unique section label for this view
              sectionView.uniqueSectionLabel = uniqueLabel;

              this.subviews.push(sectionView);

            },

            /**
             * Add a link to a section of this portal page
             * @param {PortalSectionView} sectionView - The view to add a link to
             */
            addSectionLink: function(sectionView){

              var label = sectionView.getName();
              var hrefLabel = sectionView.getName({ linkFriendly: true });

              //Create a navigation link
              this.$("#portal-section-tabs").append(
                $(document.createElement("li"))
                  .addClass("section-link-container")
                  .data("view", sectionView)
                  .append( $(document.createElement("a"))
                             .text(label)
                             .attr("href", "#" + hrefLabel )
                             .attr("data-toggle", "tab")
                             .addClass("portal-section-link")
                             .data("view", sectionView)));

            },

            /**
             * If the given portal doesn't exist, display a Not Found message.
             */
            showNotFound: function(){

              var notFoundMessage = "The portal \"" + (this.label || this.portalId) +
                                    "\" doesn't exist.",
                  notification = this.alertTemplate({
                    classes: "alert-error",
                    msg: notFoundMessage,
                    includeEmail: true
                  });

              this.$el.html(notification);

            },

            /**
            * Show an error message in this view
            * @param {SolrResult} model
            * @param {XMLHttpRequest.response} response
            */
            showError: function(model, response){

              var errorMsg = "";
              if( response && response.responseText ){
                errorMsg = "<p>Error details: " + $(response.responseText).text() + "</p>";
              }

              //Show the error message
              MetacatUI.appView.showAlert(
                "<h4><i class='icon icon-frown'></i>Something went wrong while displaying this portal.</h4>" + errorMsg,
                "alert-error",
                this.$el
              );

              //Remove the loading message from this view
              this.$el.find(".loading").remove();

            },

            /**
            * This function is called whenever the window is scrolled.
            */
            handleScroll: function() {
              var menu = $(".section-links-container")[0],
                  menuHeight = $(menu).height(),
                  editorFooterHeight = 73,
                  hiddenHeight = (menuHeight * -1) + 73;
              var currentScrollPos = window.pageYOffset;
              if(MetacatUI.appView.prevScrollpos > currentScrollPos) {
                menu.style.bottom = "73px";
              } else {
                menu.style.bottom = hiddenHeight +"px";
              }
              MetacatUI.appView.prevScrollpos = currentScrollPos;
            },

            /**
             * This function is called when the app navigates away from this view.
             * Any clean-up or housekeeping happens at this time.
             */
            onClose: function() {
                //Remove each subview from the DOM and remove listeners
                _.invoke(this.subviews, "remove");

                this.subviews = new Array();

                //Remove all listeners
                this.stopListening();

                //Delete the metrics view from this view
                delete this.sectionMetricsView;
                //Delete the model from this view
                delete this.model;

                //Remove the scroll listener
                $(window).off("scroll", "", this.handleScroll);

                $("body").removeClass("PortalView");

                $("#editPortal").remove();
            }
        });

        return PortalView;
    });
