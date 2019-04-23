define(["jquery",
    "underscore",
    "backbone",
    "text!templates/tableOfContentsLi.html",
    "text!templates/tableOfContentsUL.html"],
    function($, _, Backbone, TOCTemplateLi, TOCUl){

    /*
        The Table of Contents View is a vertical navigation menu that links to other
        sections within the same view.

        The TOC can have 2 levels of content. The top level is referred to as 'topLevelItem'.
        Second level items are referred to as 'h2' (they come from 'h2' tags). H1s get passed
        in when the TOC view is instantiated (see `ProjectSectionView.js` for an example). If
        there are 'h2' tags within the 'topLevelItem' containers, these will be listed under
        the 'topLevelItem'.
    */
    var TOCView = Backbone.View.extend({

        tagName: "div",
        className: "toc toc-view",

        type: "TOC",

        /* Renders the compiled template into HTML */
        templateUL: _.template(TOCUl),
        templateLI: _.template(TOCTemplateLi),
        templateInvisibleH1: _.template(
            '<h1 id="<%=linkDisplay%>" style="display: inline"></h1>'
        ),

        //The element on the page that contains the content that this table of contents
        //  is associated with.
        contentEl: null,

        /*
        * A list of custom items to insert into the TOC
        * {
            "text": "Project Description",
            "icon": "icon-file-text-alt",
            "link": $(".header"),
            "showSubItems": false
          }
        */
        topLevelItems: {},

        //If set to true, will render one level of sub items/links
        showSubItems: true,

        /* Construct a new instance  */
        initialize: function(options) {
            if(typeof options !== "undefined"){
                this.topLevelItems = options.topLevelItems || "";
                this.contentEl = options.contentEl || "";

                if(options.showSubItems === false){
                  this.showSubItems = false;
                }
            }
        },

        /* Render the view */
        render: function() {
            var liTemplate = this.templateLI;
            var h1Template = this.templateInvisibleH1;
            var ul = this.$el.html(this.templateUL()).find(".toc-ul");

            // Render the top level items that have been passed in
            _.each(this.topLevelItems, function(topLevelItem){
                // Create a link to display based on the text of the TOC item
                topLevelItem.linkDisplay = topLevelItem.text.replace(/[\W_]+/g, '-').toLowerCase().replace(/^[\W_]+/g, '');

                // Make an invisible (empty) H1 tag and stick it into the el
                // that's the target of the TOC
                $(topLevelItem.link).prepend(h1Template({linkDisplay: topLevelItem.linkDisplay}));

                // Render the top level item
                ul.append(liTemplate(topLevelItem));

                if( typeof topLevelItem.showSubItems == "undefined" || topLevelItem.showSubItems == true ){
                  _.each(this.createLinksFromHeaders(topLevelItem.link), function(link){
                    ul.append(link);
                  });
                }

            }, this);

            //If no custom top-level items were given, find the headers in the content
            if( !this.topLevelItems.length && this.contentEl ){

              //Create links from the headers found in the content
              _.each(this.createLinksFromHeaders(), function(link){
                ul.append(link);
              });

            }

            return this;
        },

        createLinksFromHeaders: function( contentEl, headerLevel ){

          //If no content element is specified, use the one attached to this view
          if( !contentEl && this.contentEl ){
            var contentEl = this.contentEl;
          }
          //If there is no content element attached to the view either, then exit
          else if( !contentEl && !this.contentEl ){
            return [];
          }

          //If there is no header level specified, find them in the content
          if( !headerLevel ){
            var headerLevel;

            //Use the first-level header if it exists
            if( $(contentEl).find("h1").length ){
              headerLevel = "h1";
            }
            //Otherwise find second-level headers
            else if( $(contentEl).find("h2").length ){
              headerLevel = "h2";
            }
            //Otherwise find third-level headers
            else if( $(contentEl).find("h3").length ){
              headerLevel = "h3";
            }
            //Exit this function if there are no headers
            else{
              return [];
            }
          }

          //Create an array to contain all the link elements
          var linkItems = [];

          // Within each top level item, look for header tags and
          // render them as second level TOC items
          var headers = $(contentEl).find(headerLevel);

          _.each(headers, function(header) {

              //Create the link HTML
              var linkItem = $(this.templateLI({
                  "link": "#" + $(header).attr("id"),
                  "text": $(header).text()
              }));

              //If we want to show subitems in the table of contents, find them
              if( this.showSubItems ){

                var nextEl = $(header).next(),
                    subHeaderLevel = "H" + (parseInt(headerLevel.charAt(1)) + 1),
                    subItems = $(this.templateUL());

                while(nextEl.length){

                  if( nextEl[0].tagName == subHeaderLevel ){
                    subItems.append(this.templateLI({
                        "link": "#" + nextEl.attr("id"),
                        "text": nextEl.text()
                    }));
                  }
                  else if( nextEl[0].tagName == headerLevel.toUpperCase() ){
                    break;
                  }

                  nextEl = nextEl.next();
                }

                //If at least one subheader/subitem was found, add them to the top-level item
                if( subItems.children().length ){
                  linkItem.append(subItems);
                }
              }

              //Create the link item and add to the array
              linkItems.push( linkItem );

          }, this);

          return linkItems;

        },

        /* Close and destroy the view */
        onClose: function() {

        }

    });

    return TOCView;
});
