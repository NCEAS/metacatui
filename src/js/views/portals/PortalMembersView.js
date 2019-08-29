define(["jquery",
    "underscore",
    "backbone",
    "text!templates/metadata/EMLPartyDisplay.html",
    "views/portals/PortalSectionView",
    "views/portals/PortalLogosView",
    "text!templates/portals/portalAcknowledgements.html",
    "text!templates/portals/portalAwards.html"],
    function($, _, Backbone, EMLPartyDisplayTemplate, PortalSectionView,
        PortalLogosView, AcknowledgementsTemplate, AwardsTemplate){

    /* The PortalMembersView is a view to render the
     * portal members tab (within PortalSectionView)
     */
     var PortalMembersView = PortalSectionView.extend({
        type: "PortalMembers",

      //   /* The list of subview instances contained in this view*/
      //   subviews: [], // Could be a literal object {}

      //   /* Renders the compiled template into HTML */
        partyTemplate: _.template(EMLPartyDisplayTemplate),
        acknowledgementsTemplate: _.template(AcknowledgementsTemplate),
        awardsTemplate: _.template(AwardsTemplate),

      //   /* The events that this view listens to*/
      //   events: {

      //   },

      //   /* Construct a new instance of PortalMembersView */
      //   initialize: function() {

      //   },

      //   /* Render the view */
        render: function() {

          if( this.id ){
            this.$el.attr("id", this.id);
          }

            var parties = this.model.get("associatedParties");
            var thisview = this;
            // Group parties into sets of 2 to do 2 per row
            var row_groups = _.groupBy(parties, function(parties, index) {
                return Math.floor(index / 2);
            });

            _.each(row_groups, function(row_group){
                // Create a new bootstrap row for each set of 2 parties
                var newdiv = $('<div class="row-fluid"></div>');
                // Put the empty row into the portal members container
                thisview.$el.append(newdiv);
                // iterate for the 2 parties in this row
                _.each(row_group, function(party) {
                    // Create html links from the urls
                    var regex = /(.+)/gi;
                    var urlLink = [];
                    _.each(party.get("onlineUrl"), function(url){
                        urlLink.push(url.replace(regex, '<a href="$&">$&</a>'));
                    });
                    // set the urlLinks into the model
                    party.set({'urlLink': urlLink});
                    // render party into its row
                    newdiv.append(thisview.partyTemplate(party.toJSON()));
                });
            });

            var acknowledgements = this.model.get("acknowledgments") || "";
            var awards = this.model.get("awards") || "";

            //Add a container element
            if(acknowledgements || awards){
              var ack_div = $('<div class="well awards-info"></div>');
              this.$el.append(ack_div);
            }

            //Add the awards
            if( awards ) {

                ack_div.append(this.awardsTemplate({awards: awards}));
            };

            //Add the acknowledgments
            if( acknowledgements ) {

              ack_div.append(this.acknowledgementsTemplate(acknowledgements.toJSON()));

            };
        },

      //   onClose: function() {

      //   }

     });

     return PortalMembersView;
});
