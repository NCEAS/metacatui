define(["jquery",
    "underscore",
    "backbone",
    "text!templates/metadata/EMLPartyDisplay.html",
    "views/project/ProjectSectionView"],
    function($, _, Backbone, EMLPartyDisplayTemplate, ProjectSectionView){

    /* The ProjectMembersView is a view to render the
     * project members tab (within ProjectSectionView)
     */
     var ProjectMembersView = ProjectSectionView.extend({
        el: "#project-members",
        type: "ProjectMembers",

      //   /* The list of subview instances contained in this view*/
      //   subviews: [], // Could be a literal object {}

      //   /* Renders the compiled template into HTML */
        template: _.template(EMLPartyDisplayTemplate),

      //   /* The events that this view listens to*/
      //   events: {

      //   },

      //   /* Construct a new instance of ProjectMembersView */
      //   initialize: function() {

      //   },

      //   /* Render the view */
        render: function() {
            var parties = this.model.toJSON().associatedParties;
            console.log(parties);
            this.$el.html(this.template({parties: parties}));
            // _.each(parties, function(party) {
            //     console.log(party.get("email"))
            // })
        },

      //   onClose: function() {

      //   }

     });

     return ProjectMembersView;
});
