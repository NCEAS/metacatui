define(["jquery",
    "underscore",
    "backbone",
    "text!templates/tableOfContentsLi.html",
    "text!templates/tableOfContentsUL.html",
    "text!templates/tableOfContents.html"],
    function($, _, Backbone, TOCTemplateLi, TOCTemplateUl, TOCTemplate){

    /**
     * @class TOCView
     * @classdesc    The Table of Contents View is a vertical navigation menu that links to other
        sections within the same view.

        The TOC can have 2 levels of content. The top level is referred to as 'topLevelItem'.
        Second level items are referred to as 'h2' (they come from 'h2' tags). H1s get passed
        in when the TOC view is instantiated (see `PortalSectionView.js` for an example). If
        there are 'h2' tags within the 'topLevelItem' containers, these will be listed under
        the 'topLevelItem'.
     * @classcategory Views
    */
    var TOCView = Backbone.View.extend(
        /** @lends TOCView.prototype */{

        tagName: "div",
        className: "toc toc-view",

        type: "TOC",

        /* Renders the compiled template into HTML */
        templateUL: _.template(TOCTemplateUl),
        templateLI: _.template(TOCTemplateLi),
        mainTemplate: _.template(TOCTemplate),
        templateInvisibleH1: _.template(
            '<h1 id="<%=linkDisplay%>" style="display: inline"></h1>'
        ),

        events: {
          'click .dropdown'       : 'toggleDropdown'
    		},

        // The element on the page that contains the content that this table of contents
        //  is associated with.
        contentEl: null,

        /*
        * A list of custom items to insert into the TOC
        * {
            "text": "Portal Description",
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
                this.className = options.className || "toc toc-view";
                this.addScrollspy = options.addScrollspy || true;
                this.affix = options.affix || true;

                if(options.showSubItems === false){
                  this.showSubItems = false;
                }
            }
        },

        /* Render the view */
        render: function() {

          var liTemplate  = this.templateLI,
              h1Template  = this.templateInvisibleH1;

          this.$el.html(
            this.mainTemplate({
              ulTemplate: this.templateUL()
            })
          );

          // Save references to where we should insert the links
          this.desktopUl   = this.$el.find(".desktop ul");
          this.mobile      = this.$el.find(".mobile");
          // Save references to the toggle links (and divider) so we can update their text/display on spyScoll
          this.topLevelMobileToggle = this.mobile.find(".top-level-items .dropdown-toggle");
          this.secondLevelMobileToggle = this.mobile.find(".second-level-items .dropdown-toggle");
          this.mobileDivider = this.mobile.find(".mobile-toc-divider");

          // Render the top level items that have been passed in
          _.each(this.topLevelItems, function(topLevelItem){
              // Create a link to display based on the text of the TOC item
              topLevelItem.linkDisplay = topLevelItem.text.replace(/[\W_]+/g, '-').toLowerCase().replace(/^[\W_]+/g, '');

              // Make an invisible (empty) H1 tag and stick it into the el
              // that's the target of the TOC
              $(topLevelItem.link).prepend(h1Template({linkDisplay: topLevelItem.linkDisplay}));

              // Render the top level item
              this.desktopUl.append(liTemplate(topLevelItem));

              if( typeof topLevelItem.showSubItems == "undefined" || topLevelItem.showSubItems == true ){
                _.each(this.createLinksFromHeaders(topLevelItem.link), function(link, index){
                  this.appendLink(link, index);
                }, this);
              }

          }, this);

          // If no custom top-level items were given, find the headers in the content
          if( !this.topLevelItems.length && this.contentEl ){

            //Create links from the headers found in the content
            _.each(this.createLinksFromHeaders(), function(link, index){
              this.appendLink(link, index);
            }, this);

          }

          var view = this;
          return this;

        },


        /**
         * appendLink - Adds the generated link to both the desktop and mobile TOCs
         *
         * @param  {HTMLLIElement} link  The top-level item to add, including second-level UL if present
         * @param  {number} index The index of the top-level item
         */
        appendLink: function(link, index){

          // Append to the main (desktop) navigation
          this.desktopUl.append(link);

          // Append to the mobile navigation
          var mobileLink = $(link.clone()),
              submenu    = $(mobileLink.find("ul").clone());

          // Make a list of only top-level li's
          mobileLink.find("ul").remove();
          mobileLink.data("index", index);
          this.mobile.find(".top-level-items ul").append(mobileLink);
          // If there's a submenu, add it to the second-level-items menu.
          // Add ID that allows us to match the parent to the submenu.
          if(submenu && submenu.length){
            submenu.addClass("submenu hidden");
            submenu.data("index", index);
            submenu.children("li").data("index", index);
            this.mobile.find(".second-level-items .dropdown-menu").append(submenu);
          }
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
                  "text": $(header).text(),
                  "LIclass": "top-level-item"
              }));

              linkItem.addClass("top-level-item");

              //If we want to show subitems in the table of contents, find them
              if( this.showSubItems ){

                var nextEl = $(header).next(),
                    subHeaderLevel = "H" + (parseInt(headerLevel.charAt(1)) + 1),
                    subItems = $(this.templateUL());

                while(nextEl.length){

                  if( nextEl[0].tagName == subHeaderLevel ){
                    subItems.append(this.templateLI({
                        "link": "#" + nextEl.attr("id"),
                        "text": nextEl.text(),
                        "LIclass": "second-level-item"
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


        /**
         * addScrollspy - Adds and refreshes bootstrap's scrollSpy functionality,
         * and sets the listener to call this view's scrollSpyExtras when
         * Bootstrap's "activate" event is called. This function should be called
         * anytime the DOM is updated.
         */
        renderScrollspy: function(){

          try {

            var view = this;
            var scrollSpyClass = "scrollspy-TOC-" + this.cid;
            var scrollSpyTarget = "." + scrollSpyClass;

            this.$el.addClass(scrollSpyClass);

            // Manually set scrollspy data,
            // see https://github.com/twbs/bootstrap/issues/20022#issuecomment-561376832
            var $spy = $("body").scrollspy({ target: scrollSpyTarget, offset: 35});
            var newSpyData = $spy.data();
            newSpyData.scrollspy.selector = scrollSpyTarget + " .nav li > a";
            $.fn.scrollspy.call($spy, newSpyData);
            $spy.scrollspy("process");
            $spy.scrollspy("refresh");

            // Remove any active classes to start
            var activeEls = this.$(scrollSpyTarget + " .active");
            activeEls.removeClass("active");

            // Add scroll spy
            $("body").off("activate");
            $("body").on("activate", function(e){
              view.scrollSpyExtras(e);
            });
            $(window).off("resize");
            $(window).on("resize", function(){
              $spy.scrollspy("refresh");
            });

          } catch (e) {
            console.log("Error adding scrollspy! Error message: " + e);
          }

        },


        /**
         * affixTOC - description
         */
        postRender: function(){

          try {

            var isVisible = this.$el.find(":visible").length > 0;

            if(this.affix === true && isVisible){
              this.$el.affix({ offset: this.$el.offset().top });
            }

            if(this.addScrollspy && isVisible){
              this.renderScrollspy();
            }

          } catch (e) {
            console.log("Error affixing the table of contents, error message: " + e);
          }

        },

        /**
         * scrollSpyExtras - Adds extra functionality to Bootstrap's scrollSpy function.
         * This function is called anytime the "activate" event is called by bootstrap.
         * For the desktop TOC, if activates the parent LI in the case that a second-level
         * LI is active. For the mobile TOC, it changes text displayed in this.topLevelMobileToggle
         * and this.secondLevelMobileToggle to the active top-level and second-level item, respectively.
         * It also makes only the active second-level menu visible under the secondLevelMobile dropdown.
         *
         * @param  {event} e The "activate" event triggered when an LI element is activated by bootstrap's ScrollSpy
         */
        scrollSpyExtras: function(e){

          try {
            if(e && e.target){
              // console.log($(e.target)[0].innerText);

              var activeLI        = $(e.target),
                  mobileContainer = activeLI.closest(".mobile"),
                  isTopLevel      = activeLI.hasClass("top-level-item"),
                  isMobile        = (mobileContainer && mobileContainer.length);

              // --- DESKTOP --- //

              // For the desktop nav, just highlight the parent item if the
              // activated item is a second-level item.
              if(!isMobile){
                if(!isTopLevel){
                  activeLI.closest(".top-level-item").addClass("active");
                }
                return
              }

              // --- MOBILE --- //

              var allSubmenus     = mobileContainer.find(".submenu"),
                  allToplevelLIs  = mobileContainer.find(".top-level-item"),
                  itemText        = activeLI.find("a").text().trim(),
                  index           = activeLI.data("index"); // Used to match submenus to parent LIs.

              if(isTopLevel){

                // Update the toggle text, hide submenu displays
                this.topLevelMobileToggle.text(itemText);
                this.secondLevelMobileToggle.text("");
                this.secondLevelMobileToggle.closest(".second-level-items").addClass("hidden");
                this.mobileDivider.addClass("hidden");

                // Get the corresponding child submenu that should be active
                var activeSubMenu = _.filter(allSubmenus, function(submenu){
                  return ($(submenu).data("index") == index)
                });

              } else {

                // Get the parent LI, make it active, and update the toggle text
                activeTopLI = _.filter(allToplevelLIs, function(topLI){
                  return ($(topLI).data("index") == index)
                });
                $(activeTopLI).addClass("active");
                this.topLevelMobileToggle.text($(activeTopLI).children("a").text().trim());
                this.secondLevelMobileToggle.text(itemText);

                // Find the menu this LI is within
                var activeSubMenu = activeLI.closest("ul");
              }

              // Hide all submenus so only max 1 is active at a time
              allSubmenus.addClass("hidden");

              // Ensure the active submenu & associated toggle text is shown
              if (activeSubMenu && activeSubMenu.length){
                $(activeSubMenu).removeClass("hidden");
                this.secondLevelMobileToggle.closest(".second-level-items").removeClass("hidden");
                this.mobileDivider.removeClass("hidden");
                if(this.secondLevelMobileToggle.text() == ""){
                  this.secondLevelMobileToggle.text("Sub-sections")
                }
              }
            };

          } catch (error) {
            console.log("error adding extra scrollSpy functionality to portal section, error message: " + error);
          }
        },

        /**
         * toggleDropdown - Extends bootstrap's dropdown menu functionality by
         * hiding the dropdown menu when the user clicks the dropdown toggle or
         * any of the options within the dropdown menu.
         *
         * @param  {event} e The click event on any part of the dropdown element
         */
        toggleDropdown: function(e){

          try {
            if(e && e.target && $(e.target).closest(".dropdown").children(".dropdown-menu")){

                  // The entire dropdown element including toggle and menu
              var $dropdown = $(e.target).closest(".dropdown"),
                  // The menu that we wish to show and hide on click
                  $menu     = $dropdown.children(".dropdown-menu");

              // Wait for bootstrap to add or remove the open class on $dropdown
              setTimeout(function () {
                if($menu.hasClass("hidden") || $dropdown.hasClass("open")){
                  $menu.removeClass("hidden");
                } else {
                  $menu.addClass("hidden");
                }
              }, 5);

            }
          } catch (error) {
            console.log("error hiding TOC dropdown menu on click, error message: " + error);
          }

        },


        /**
         * onClose - Close and destroy the view
         */
        onClose: function() {
          // Make sure to stop scrollSpy listeners
          $("body").off("activate");
          $(window).off("resize");

        }

    });

    return TOCView;
});
