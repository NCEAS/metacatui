define(['underscore',
        'jquery',
        'backbone',
        'models/project/ProjectModel',
        "views/project/editor/ProjEditorSettingsView",
        "views/project/editor/ProjEditorDataView",
        "views/project/editor/ProjEditorMdSectionView",
        "text!templates/project/editor/projEditorSections.html",
        "text!templates/project/editor/projEditorSectionLink.html"],
function(_, $, Backbone, Project, ProjEditorSettingsView, ProjEditorDataView,
         ProjEditorMdSectionView,
         Template, SectionLinkTemplate){

  /**
  * @class ProjEditorSectionsView
  */
  var ProjEditorSectionsView = Backbone.View.extend({

    /**
    * The type of View this is
    * @type {string}
    */
    type: "ProjEditorSections",

    /**
    * The HTML tag name for this view's element
    * @type {string}
    */
    tagName: "div",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: "proj-editor-sections",

    /**
    * The ProjectModel that is being edited
    * @type {Project}
    */
    model: undefined,

    /**
    * The currently active editor section. e.g. Data, Metrics, Settings, etc.
    * @type {string}
    */
    activeSection: "",

    /**
    * References to templates for this view. HTML files are converted to Underscore.js templates
    */
    template: _.template(Template),
    sectionLinkTemplate: _.template(SectionLinkTemplate),

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
      ".add-section"    : "addSection",
      ".remove-section" : "removeSection",
      ".rename-section" : "renameSection"
    },

    /**
    * Creates a new ProjEditorSectionsView
    * @constructs ProjEditorSectionsView
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){

    },

    /**
    * Renders the ProjEditorSectionsView
    */
    render: function(){

      //Insert the template into the view
      this.$el.html(this.template());

      //TODO: Iterate over each section in the ProjectModel `sections` and
      // add the tab to the tab navigation and render a ProjEditorSectionView for each.

      //TODO: Add a "Add section" button/tab

      //TODO: Render a ProjEditorDataView and corresponding tab

      //TODO: Render a ProjEditorSectionView for the Metrics section and corresponding tab

      //Render a Settings section
      var settingsView = new ProjEditorSettingsView({
        model: this.model
      });
      settingsView.render();
      this.$(".proj-editor-settings-container")
          .html(settingsView.el)
          .attr("id", settingsView.getName({ linkFriendly: true }));
      this.addSectionLink(settingsView);

      //TODO: Switch to the active section, if one is specified.

    },

    /**
    * Add a link to the given editor section
    * @param {ProjEditorSectionView} sectionView - The view to add a link to
    */
    addSectionLink: function(sectionView){

      this.$(".section-links-container").append(this.sectionLinkTemplate({
        href: "#" + sectionView.getName({ linkFriendly: true }),
        sectionName: sectionView.getName()
      }))

    },

    /**
    * Adds a section and tab to this view and the ProjectModel
    * @param {Event} [e] - (optional) The click event on the Add button
    */
    addSection: function(e){

    },

    /**
    * Removes a section and its tab from this view and the ProjectModel
    * @param {Event} [e] - (optional) The click event on the Remove button
    */
    removeSection: function(e){

    },

    /**
    * Renames a section in the tab in this view and in the ProjectSectionModel
    * @param {Event} [e] - (optional) The click event on the Rename button
    */
    renameSection: function(){

    },

    /**
    * Manually switch to a section subview by making the tab and tab panel active.
    * Navigation between sections is usually handled automatically by the Bootstrap
    * library, but a manual switch may be necessary sometimes
    * @param {string} sectionName - The section to switch to
    */
    switchSection: function(sectionName){

    }

  });

  return ProjEditorSectionsView;

});
