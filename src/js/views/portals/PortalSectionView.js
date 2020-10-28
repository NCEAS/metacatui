define(["jquery",
    "underscore",
    "backbone",
    'models/portals/PortalSectionModel',
    "views/MarkdownView",
    "text!templates/portals/portalSection.html"],
    function($, _, Backbone, PortalSectionModel, MarkdownView, Template){

    /**
     * @class PortalSectionView
     * @classdesc The PortalSectionView is a generic view to render
     * portal sections, with a default rendering of a
     * MarkdownView
     * @classcategory Views/Portals
     * @module views/PortalSectionView
     * @name PortalSectionView
     * @extends Backbone.View
     * @constructor
     */
     var PortalSectionView = Backbone.View.extend(
       /** @lends PortalSectionView.prototype */{

       /**
       * The type of View this is
       * @type {string}
       * @readonly
       */
        type: "PortalSection",

        /**
        * The display name for this Section
        * @type {string}
        */
        sectionName: "",

        /**
        * The unique label for this Section. It most likely matches the label on the model, but
        * may include a number after if more than one section has the same name.
        * @type {string}
        */
        uniqueSectionLabel: "",

        /**
        * The HTML tag name for this view's element
        * @type {string}
        */
        tagName: "div",

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: "tab-pane portal-section-view",

        /**
        * Specifies if this section is active or not
        * @type {boolean}
        */
        active: false,

        /**
        * The PortalSectionModel that is being edited
        * @type {PortalSection}
        */
        model: undefined,

        /**
        * @type {UnderscoreTemplate}
        */
        template: _.template(Template),

        /**
        * @param {Object} options - A literal object with options to pass to the view
        * @property {PortalSection} options.model - The PortalSection rendered in this view
        * @property {string} options.sectionName - The name of the portal section
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

        /**
         Renders the view
        */
        render: function() {

          //Add the active class to the element
          if( this.active ){
            this.$el.addClass("active");
          }

          //Add an id to this element so links work
          this.$el.attr("id", this.getName({ linkFriendly: true }));

          this.$el.html(this.template({
            imageURL: this.model.get("image")? this.model.get("image").get("imageURL") : "",
            title: this.model.get("title"),
            introduction: this.model.get("introduction")
          }));

          this.$el.data("view", this);

          //If there is Markdown, render it
          if( this.model.get("content").get("markdown") ){

            //Create a MarkdownView
            this.markdownView = new MarkdownView({
              markdown: this.model.get("content").get("markdown"),
              citations: this.model.get("literatureCited"),
              showTOC: true
            });

            // Listen to the markdown view and when it is rendered, format the rendered markdown
            this.listenTo(this.markdownView, "mdRendered", this.postMarkdownRender);

            // Render the view
            this.markdownView.render();

            // Add the markdown view element to this view
            this.$(".portal-section-content").html(this.markdownView.el);

          }

        },



        /**
        * This funciton is called after this view has fully rendered and is
        * visible on the webpage
        */
        postRender: function(){

          _.each(this.subviews, function(subview){
              if(subview.postRender){
                subview.postRender();
              }
          });

          if(this.markdownView){
            this.markdownView.postRender();
          }
        },

        /**
        * When the portal section markdown is rendered in a MarkdownView, format the
        * resulting HTML as needed for this view
        */
        postMarkdownRender: function(){




          // If the window location has a hash, scroll to it
          if( window.location.hash && this.$(window.location.hash).length ){
            var view = this;
            // Wait 0.5 seconds to allow images time to load before we scroll down the page
            setTimeout(function(){
              // Scroll to the element specified in the hash
              MetacatUI.appView.scrollTo( view.$(window.location.hash) );
            }, 500);
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
          //If the model is a PortalSectionModel, use the label from the model
          else if( PortalSectionModel.prototype.isPrototypeOf(this.model) ){
            name = this.model.get("label");
          }
          else{
            name = "Untitled";
          }

          if( typeof options == "object" ){
            if( options.linkFriendly ){
              name = name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/ /g, "-");
            }
          }

          return name;

        }
     });

     return PortalSectionView;
});
