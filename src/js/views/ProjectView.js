/*global define */
define(['jquery',
				'underscore',
				'backbone',
				'bootstrap',
				'models/ProjectModel',
				'models/CollectionModel',
				'models/SolrResult',
				'models/DataONEObject',
				'views/DataCatalogView',
				'views/StatsView',
				'text!templates/project.html',
				'text!templates/projectHeader.html',
				'text!templates/about.html'],
	function($, _, Backbone, Bootstrap, Project, Collection, SearchResults, DataONEObject, DataCatalogView, StatsView, ProjectTemplate, ProjectHeaderTemplate, testTemplate) {
	'use strict';

	// Our overall **AppView** is the top-level piece of UI.
	var ProjectView = Backbone.View.extend({

		el: '#Content',
		headerContainer: "#project-header-container",
		searchContainer: "#project-search-container",
		descriptionContainer: "#project-description-container",
		personnelContainer: "#project-personnel-container",
		logoContainer: "#project-logos-container",
		statsContainer: "#project-stats-container",
		allPersonnelContainer: "#project-personnel-container-all",
		acknowledgmentsContainer: "#project-acknowledgments-container",

		type: "Project",

		template: _.template(ProjectTemplate),
		headerTemplate: _.template(ProjectHeaderTemplate),

		events: {
			"click .nav-tabs a" : "switchTab"
		},

		initialize: function () {
			this.projectId = MetacatUI.appModel.get("projectId");
			this.model = new Project();
			this.collectionModel = new Collection();

			return this;
		},

		// Render the main view and/or re-render subviews. Don't call .html() here
		// so we don't lose state, rather use .setElement(). Delegate rendering
		// and event handling to sub views
		render: function () {

			MetacatUI.appModel.set('headerType', 'default');

			// Load the project model which contains the collection ID, then get the collection
			this.listenTo(this.model, 'change:projectCollection', this.getCollectionModel);

			// Render the project metadata after both the project model and colelction model have been loaded
			this.listenTo(this.collectionModel, 'change:id', this.renderProjectMetadata);

			this.getModel();

			return this;
		},

		getModel: function(){
		 	this.model.set("id", this.projectId);
			this.model.fetch();
		},

		getCollectionModel: function(){
			this.collectionModel.set("id", this.model.get("projectCollection"));
			this.collectionModel.fetch();
		},

		renderProjectMetadata: function(){
			MetacatUI.t = this;
			this.$el.html(this.template({ id: this.projectId }));

			//Insert project header with title/synopsis
			this.insertHeader();

			//Insert project search
			this.insertProjectSearch();

			//Insert project description
			this.insertProjectDescription();

			//Insert primary project personnel
			this.insertProjectPersonnel();

			//Insert project logos
			this.insertProjectLogos();

			//Insert stats
			//this.insertProjectStats();

			//Insert people in the people tab
			this.insertProjectPeopleTab();

			//Insert project acknowledgments();
			this.insertProjectAcknowledgments();
		},

		insertHeader: function() {
			this.$(this.headerContainer).html(this.headerTemplate({
				title : this.model.get('title'),
				synopsis : this.model.get('synopsis'),
				logo: this.model.get('logos')[0].get("imageURL") //Inserts first logo in list as title logo
			}));
		},

		insertProjectSearch: function(){
			//TODO pass Collection definition to catalog view - below isn't working yet

			var search = this.collectionModel.get('searchModel');
			var results = this.collectionModel.get('searchResults');

			MetacatUI.appModel.searchResults = results;
			var view = new DataCatalogView({
				el: this.$("#project-search-results"),
				mode: "list",
				searchModel: search,
			  resultsModel: results,
				isSubView: true,
				filters : true
			});

			view.render();
			view.$(".auto-height").removeClass("auto-height").css("height", "auto");
		},

		//TODO will need to parse markdown
		insertProjectDescription: function() {
			this.$(this.descriptionContainer).html(
				this.model.get('projectDescription')
			);
		},

		insertProjectPersonnel: function() {
			this.$(this.personnelContainer).prepend("<h4 class='project-section-title'>Project Members</h4>");

			var personnelList = this.model.get('personnel');
			var primaryList = _.filter(personnelList, function(personnel){ return personnel.get("role").includes("primary") });

			var personnelHTML = this.generatePersonnelHTML(primaryList);

		  this.$("#members-list-container").append(personnelHTML);
		},

		insertProjectPeopleTab: function() {
			this.$(this.allPersonnelContainer).prepend("<h4 class='project-section-title'>Project Members</h4>");

			var personnelList = this.model.get('personnel');
			var personnelHTML = this.generatePersonnelHTML(personnelList);

		  this.$("#members-list-container-all").append(personnelHTML);
		},

		generatePersonnelHTML: function(personnelList) {
			var personnelHTML = "";
			_.each(personnelList, function(personnel, index){

				// TODO this is cluged in here until I can figure out why EMLParty isn't parsing the first/last name
				var firstname = $(personnel.get("objectDOM")).find("givenName").text(),
					lastname = $(personnel.get("objectDOM")).find("surName").text(),
					org = personnel.get("organizationName") || "",
					position = personnel.get("positionName") || "",
					email = personnel.get("email") || "";

				if(index%2 == 0) {
					personnelHTML += "<div class='row top-buffer'><div class='span6'><strong>" +
					firstname + " " + lastname + "</strong> " + org + "<br> " + position +
					"<br>" + "Contact: " + email + "</div>";
				} else {
					personnelHTML += "<div class='span6'><strong>" + firstname + " " + lastname +
					"</strong> " + org + "<br>" + position + "<br>" +
					"Contact: " + email + "</div></div>";
				}
			});

			return personnelHTML;
		},

		insertProjectLogos: function() {
			var view = this;
			var logoList = view.model.get('logos');

			// Right now this assumes that all logos are stored externally and referenced via a url and that we don't want to redisplay the first logo
			_.each(logoList.slice(1), function(logo){
				var url = logo.get("imageURL");
				view.$("#project-logos-container").append("<div class='logo-image'><image src="+url+"></image></div>");
			});

		},

		insertProjectAcknowledgments: function() {
			//Insert acknowledgments info
			this.$(this.acknowledgmentsContainer).prepend("<h4 class='project-section-title'>Acknowledgments</h4>");
			var acknowledgments = this.model.get('acknowledgments');
		  this.$(this.acknowledgmentsContainer).append("<span>" + acknowledgments + "</span>");

			//Add the funding info
			this.$(this.acknowledgmentsContainer).append("<br><br><h4 class='project-section-title'>Funding</h4>");
			var fundingSources = this.model.get('funding'),
				view = this;
			_.each(fundingSources, function(funding){
				view.$(view.acknowledgmentsContainer).append("<span>" + funding + "</span><br>");
			});
		},

		insertProjectStats: function(){
			//TODO - edit the stats model so that we can pass in a project ID and find all associated packages
			//var username = "http://orcid.org/0000-0002-6220-0134";
			//var username = this.model.get("username");
			var view = this;

			//Insert a couple stats into the profile
			this.listenToOnce(MetacatUI.statsModel, "change:firstUpload", this.insertFirstUpload);

			this.listenToOnce(MetacatUI.statsModel, "change:totalUploads", function(){
				view.$("#total-upload-container").text(MetacatUI.appView.commaSeparateNumber(MetacatUI.statsModel.get("totalUploads")));
			});

			MetacatUI.statsModel.once("change:downloads", function(){
				if( !this.get("downloads") )
					view.$("#total-download-wrapper, section.downloads").hide();
				else
					view.$("#total-download-container").text(MetacatUI.appView.commaSeparateNumber(this.get("downloads")));
			});

			//Create a base query for the statistics
			var statsSearchModel = this.collectionModel.get("searchModel").clone();
			statsSearchModel.set("exclude", [], {silent: true}).set("formatType", [], {silent: true});
			MetacatUI.statsModel.set("query", statsSearchModel.getQuery());
			MetacatUI.statsModel.set("searchModel", statsSearchModel);

			//Create the description for this profile
			var description = "A summary of all datasets from " + this.model.get("title");


			//Render the Stats View for the project
			this.statsView = new StatsView({
				title: "Statistics and Figures",
				description: description,
				el: this.$(this.statsContainer)
			});
			//this.subviews.push(this.statsView);
			this.statsView.render();

			if(this.model.noActivity)
				this.statsView.$el.addClass("no-activity");
		},

		switchTab: function(e){
			e.preventDefault();

			var link = $(e.target);

		  link.tab('show');
			$(e.relatedTarget).tab('hide');

			this.$(".nav-tabs li").removeClass("active");
			link.parent("li").addClass("active");

			this.$(link.attr("data-target")).show();
		},

	});
	return ProjectView;
});
