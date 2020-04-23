define(["jquery",
    "underscore",
    "backbone",
    "text!templates/portals/portalHeader.html"], function($, _, Backbone, PortalHeaderTemplate){

    /* The PortalHeaderView is the view at the top of portal pages
     * that shows the portal's title, synopsis, and logo
     */
     var PortalHeaderView = Backbone.View.extend({

        /* The Portal Header Element */
        el: "#portal-header-container",

        type: "PortalHeader",

        /* Renders the compiled template into HTML */
        template: _.template(PortalHeaderTemplate),

        initialize: function(options) {
          this.model = options.model ? options.model : undefined;
          this.nodeView = options.nodeView ? options.nodeView : undefined;
        },

        /* Render the view */
        render: function() {

          var templateInfo = {
            label: this.model.get("label"),
            description: this.model.get("description"),
            name: this.model.get("name"),
            viewType: "portalView",
          }

          if ( this.nodeView ) {
            templateInfo.imageURL = this.model.get("logo");

            templateInfo.viewType = "nodeView"

            // Re-inserting the default header
            $(".PortalView #Navbar").addClass("RepositoryPortalView");
          }
          else {
            if( this.model.get("logo") ){
              templateInfo.imageURL = this.model.get("logo").get("imageURL");
            }
            else{
              templateInfo.imageURL = "";
            }
          }


          this.$el.append(this.template(templateInfo));

          // Insert the member since stat
          if (this.nodeView) {
            this.insertMemberSinceStat();
          }

          return this;
        },


        /*
        * Insert the member since stat for this node
        */
        insertMemberSinceStat: function(){

          //Get the member node object
          var node = _.findWhere(MetacatUI.nodeModel.get("members"), {identifier: "urn:node:" + this.model.get("label") });

          //If there is no memberSince date, then hide this statistic and exit
          if( !node.memberSince ){
            this.$("#first-upload-container, #first-upload-year-container").hide();
            return;
          }
          else{
            var firstUpload = node.memberSince? new Date(node.memberSince.substring(0, node.memberSince.indexOf("T"))) : new Date();
          }


          // Construct the first upload date sentence
          var	monthNames = [ "January", "February", "March", "April", "May", "June",
                            "July", "August", "September", "October", "November", "December" ],
            m = monthNames[firstUpload.getUTCMonth()],
            y = firstUpload.getUTCFullYear(),
            d = firstUpload.getUTCDate();

          //For Member Nodes, start all dates at July 2012, the beginning of DataONE
          this.$("#first-upload-container").text("DataONE Member Node since " + y);

          //Construct the time-elapsed sentence
          var now = new Date(),
            msElapsed = now - firstUpload,
            years = msElapsed / 31556952000,
            months = msElapsed / 2629746000,
            weeks = msElapsed / 604800000,
            days = msElapsed / 86400000,
            time = "";

          //If one week or less, express in days
          if(weeks <= 1){
            time = (Math.round(days) || 1) + " day";
            if(days > 1.5) time += "s";
          }
          //If one month or less, express in weeks
          else if(months < 1){
            time = (Math.round(weeks) || 1) + " week";
            if(weeks > 1.5) time += "s";
          }
          //If less than 12 months, express in months
          else if(months <= 11.5){
            time = (Math.round(months) || 1) + " month";
            if(months > 1.5) time += "s";
          }
          //If one year or more, express in years and months
          else{
            var yearsOnly = (Math.floor(years) || 1),
              monthsOnly = Math.round(years % 1 * 12);

            if(monthsOnly == 12){
              yearsOnly += 1;
              monthsOnly = 0;
            }

            time = yearsOnly + " year";
            if(yearsOnly > 1) time += "s";

            if(monthsOnly)
              time += ", " + monthsOnly + " month";
            if(monthsOnly > 1) time += "s";
          }

          this.$("#first-upload-year-container").text(time);
        }

     });

     return PortalHeaderView;
});
