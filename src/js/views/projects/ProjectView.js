define([
        'jquery',
        'underscore',
        'backbone',
        'text!templates/projectInfo.html', 'models/projects/Project',
        'collections/ProjectList'],
    function ($, _, Backbone, template, Project, ProjectList) {
        /**
         * @class ProjectView
         * @classdesc    This is a base view for projects list loading. It is structured
         * on the premise that a project gets selected to be having its details viewed. The template associated
         * with this view has a placeholder to render the projects with the desired way.
         * @classcategory Views/Projects
         * @extends Backbone.View
         * @since 2.X
         */
        var ProjectView = Backbone.View.extend(
            /** @lends ProjectView.prototype */{
            el: "#Content",
            template: _.template(template),
            projectList: undefined, // Set default list if not using projectsApiUrl
            selectedProject: undefined,
            load: undefined,
            events: {
                "change #projects": "handleSelectProject"
            },

            initialize: function (options) {
                this.getProjectsList()


                // After projectList fetch call is successful, set the default selected project to the first project
                // received from the projectsList then render to load the select element.
                this.listenTo(this.projectList, 'sync', this.setSelectedProject);
                this.listenTo(this.projectList, 'sync', this.render);

                // In case the token was not loaded already, get the projects after it gets loaded.
                this.listenTo(MetacatUI.appUserModel, 'change:token', this.getProjectsList);
            },

            /**
             *
             * @returns {ProjectView}
             */
            render: function () {
                // If a project selection logic is implemented, pass down the selection.
                if(this.selectedProject !== undefined) {
                    this.$el.html(this.template({
                        projectList: this.projectList,
                        selectedProject: this.selectedProject
                    }));
                } else {
                    this.$el.html(this.template({
                        projectList: this.projectList,
                    }));
                }
                return this;
            },

            /**
             * Handles the change event for selecting a project in the dropdown and then render.
             * @param {Event} e
             * @since 2.X
             */
            handleSelectProject: function (e) {
                // Set the selectedProject based on the selected project id from the select element.
                this.selectedProject = this.projectList.findWhere({id: e.target.value});
                this.render();
                return;
            },

            /**
             * Call back to set the selectedProject
             * This is used as a callback to only set the current project on the success of the fetch call.
             *  @since 2.X
             */
            setSelectedProject: function () {
                if (this.selectedProject === undefined)
                    this.selectedProject = this.projectList.at(0)
                this.render()
            },

            /**
             * Call back to initialize the ProjectsList
             * This is used as a callback so that the fetch would happen after the change:token event gets loaded.
             *  @since 2.X
             */
            getProjectsList: function (){
                // Note that if the projectsApiUrl config is not set, projectsList will fall to the default set.
                if(MetacatUI.appModel.get("projectsApiUrl")){
                    // Get the projects for the user
                    this.projectList = new ProjectList({
                        authToken: MetacatUI.appUserModel.get("token"),
                        urlBase: MetacatUI.appModel.get("projectsApiUrl")
                    })
                    this.projectList.fetch({
                        parse: true,
                        data: {can_manage: true}
                    })
                }
            }
        });
        return ProjectView;
    });
