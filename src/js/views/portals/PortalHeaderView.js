define(["jquery",
    "underscore",
    "backbone",
    "text!templates/portals/portalHeader.html"], function($, _, Backbone, PortalHeaderTemplate){

    /**
    * @class PortalHeaderView
    * @classdesc The PortalHeaderView is the view at the top of portal pages
     * that shows the portal's title, synopsis, and logo
     * @classcategory Views/Portals
     */
     var PortalHeaderView = Backbone.View.extend(
       /** @lends PortalHeaderView.prototype */{

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
          var view = this;
          var node = _.find(MetacatUI.nodeModel.get("members"), function(nodeModel) {
						return nodeModel.identifier.toLowerCase() == "urn:node:" + (view.model.get("label")).toLowerCase();
            });

          //If there is no memberSince date, then hide this statistic and exit
          if( !node.memberSince ){
            this.$("#first-upload-container").hide();
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
          this.$("#first-upload-container").text("DataONE Member Repository since " + y);
        }

     });

     return PortalHeaderView;
});
