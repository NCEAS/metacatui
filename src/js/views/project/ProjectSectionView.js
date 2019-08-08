define(["jquery",
    "underscore",
    "backbone",
    'models/project/ProjectSectionModel',
    "views/MarkdownView",
    "views/TOCView",
    "text!templates/project/projectSection.html"],
    function($, _, Backbone, ProjectSectionModel, MarkdownView, TOCView, Template){

    /* The ProjectSectionView is a generic view to render
     * project sections, with a default rendering of a
     * MarkdownView
     */
     var ProjectSectionView = Backbone.View.extend({

       /**
       * The type of View this is
       * @type {string}
       */
        type: "ProjectSection",

        /**
        * The display name for this Section
        * @type {string}
        */
        sectionName: "",

        /**
        * The HTML tag name for this view's element
        * @type {string}
        */
        tagName: "div",

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: "tab-pane project-section-view",

        /**
        * Specifies if this section is active or not
        * @type {boolean}
        */
        active: false,

        /**
        * The ProjectSectionModel that is being edited
        * @type {ProjectSection}
        */
        model: undefined,

        template: _.template(Template),

        /**
        * Creates a new ProjectSectionView
        * @constructs ProjectSectionView
        * @param {Object} options - A literal object with options to pass to the view
        * @property {ProjectSection} options.model - The ProjectSection rendered in this view
        * @property {string} options.sectionName - The name of the project section
        */
        initialize: function(options){

          // Get all the options and apply them to this view
          if( typeof options == "object" ) {
              var optionKeys = Object.keys(options);
              _.each(optionKeys, function(key, i) {
                  this[key] = options[key];
              }, this);
          }

        },

        /* Render the view */
        render: function() {

          //Add the active class to the element
          if( this.active ){
            this.$el.addClass("active");
          }

          //Add an id to this element so links work
          this.$el.attr("id", this.getName({ linkFriendly: true }));

          this.$el.html(this.template(this.model.toJSON()));

          this.$el.data("view", this);

          //If there is Markdown, render it
          if( this.model.get("content").get("markdown") ){
            //Create a MarkdownView
            var sectionMarkdownView = new MarkdownView({
              markdown: this.model.get("content").get("markdown"),
              citations: this.model.get("literatureCited")
            });

            //Listen to the markdown view and when it is rendered, format the rendered markdown
            this.listenTo(sectionMarkdownView, "mdRendered", this.postMarkdownRender);

            //Render the view
            sectionMarkdownView.render();

            //Add the markdown view element to this view
            this.$(".project-section-content").html(sectionMarkdownView.el);

            this.markdownView = sectionMarkdownView;

            //Set TOC to render after the Markdown section, so it
            // can get the rendered header tags
            this.listenToOnce(sectionMarkdownView, "mdRendered", this.renderTOC);
          }

        },

        renderTOC: function(){
          //Create a table of contents view
          var tocView = new TOCView({
            contentEl: this.markdownView.el
          });

          this.tocView = tocView;

          tocView.render();

          //If at least one link was created in the TOCView, add it to this view
          if( tocView.$el.find("a").length ){
            this.$(".project-section-content").prepend(tocView.el);

            //Make a two-column layout
            tocView.$el.addClass("span3");
            this.markdownView.$el.addClass("span9");
          }
        },

        /*
        * This funciton is called after this view has fully rendered and is
        * visible on the webpage
        */
        postRender: function(){

          _.each(this.subviews, function(subview){
              if(subview.postRender){
                subview.postRender();
              }
          });

          //Affix the TOC to the top of the window when scrolling past it
          if( !this.tocView && this.markdownView ){
            this.listenToOnce(this.markdownView, "mdRendered", function(){

              this.tocView.$el.affix({
                offset: this.tocView.$el.offset().top
              });

            });
          }
          else if( this.tocView ){
            this.tocView.$el.affix({
              offset: this.tocView.$el.offset().top
            });
          }


        },

        /*
        * When the project section markdown is rendered in a MarkdownView, format the
        * resulting HTML as needed for this view
        */
        postMarkdownRender: function(){

          this.$(".markdown img").addClass("thumbnail").after("<div class='clear'></div>");

          //If the window location has a hash, scroll to it
          if( window.location.hash && this.$(window.location.hash).length ){

            var view = this;

            //Wait one second to allow images time to load before we scroll down the page
            setTimeout(function(){
              //Scroll to the element specified in the hash
              MetacatUI.appView.scrollTo( view.$(window.location.hash) );
            }, 1000);
          }

        },

        /**
        * Gets the name of this section and returns it
        * @param {Object} [options] - Optional options for the name that is returned
        * @property {Boolean} options.linkFriendly - If true, the name will be stripped of special characters
        * @return {string} The name for this section
        */
        getName: function(options){

          var name = "";

          //If a section name is set on the view, use that
          if( this.sectionName ){
            name = this.sectionName;
          }
          //If the model is a ProjectSectionModel, use the label from the model
          else if( ProjectSectionModel.prototype.isPrototypeOf(this.model) ){
            name = this.model.get("label");
          }
          else{
            name = "New section";
          }

          if( typeof options == "object" ){
            if( options.linkFriendly ){
              name = name.replace(/[^a-zA-Z0-9]/g, "-");
            }
          }

          return name;

        }

     });

     return ProjectSectionView;
});
