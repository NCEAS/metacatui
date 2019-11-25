define(["jquery",
    "underscore",
    "backbone",
    "text!templates/portals/portalVisualizations.html",
    "views/portals/PortalSectionView.js"],
    function($, _, Backbone, PortalVisualizationsTemplate, PortalSectionView){

    /* The PortalVisualizationsView is a view to render the
     * portal visualizations tab (within PortalSectionView)
     */
     var PortalVisualizationsView = PortalSectionView.extend({

        /* The Portal Visualizations Element*/
        el: "#portal-visualizations",

        /* TODO: Decide if we need this */
        type: "PortalVisualizations",

        /* The list of subview instances contained in this view*/
        subviews: [], // Could be a literal object {}

        /* Renders the compiled template into HTML */
        template: _.template(PortalVisualizationsTemplate),

        /* The events that this view listens to*/
        events: {

        },

        /* Construct a new instance of PortalVisualizationsView */
        initialize: function() {

        },

        /* Render the view */
        render: function() {

        },

        onClose: function() {

        }

     });

     return PortalVisualizationsView;
});
