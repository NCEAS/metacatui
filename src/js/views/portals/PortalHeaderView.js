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


        /* Render the view */
        render: function() {
          var templateInfo = {
            label: this.model.get("label"),
            description: this.model.get("description"),
            name: this.model.get("name")
          }

          if( this.model.get("logo") ){
            templateInfo.imageURL = this.model.get("logo").get("imageURL");
          }
          else{
            templateInfo.imageURL = "";
          }

          this.$el.append(this.template(templateInfo));

          return this;
        }

     });

     return PortalHeaderView;
});
