define(['jquery', 'underscore', 'backbone', 'models/PackageModel', 'text!templates/downloadContents.html', 'text!templates/downloadButton.html'], 				
	function($, _, Backbone, Package, Template, DownloadButtonTemplate) {
	'use strict';

	
	var PackageTable = Backbone.View.extend({
		
		template: _.template(Template),		
		downloadButtonTemplate: _.template(DownloadButtonTemplate),
		
		type: "PackageTable",
		
		tagName : "div",
		
		className : "download-contents",
		
		events: {
			"click .expand-control"   : "expand",
			"click .collapse-control" : "collapse"
		},
		
		initialize: function(options){
			if((options === undefined) || (!options)) var options = {};
			
			this.packageId  = options.packageId	 || null;
			this.memberId	= options.memberId	 || null;
			this.attributes = options.attributes || null;
			this.className += options.className  || "";
			this.currentlyViewing = options.currentlyViewing || null;
			this.numVisible = options.numVisible || 4;
			this.parentView = options.parentView || null;			
			this.title = options.title || "Files in this dataset";
			this.nested = (typeof options.nested === "undefined")? false : options.nested;
			
			//Set up the Package model
			if((typeof options.model === "undefined") || !options.model){
				this.model = new Package();
				this.model.set("memberId", this.memberId);
				this.model.set("packageId", this.packageId);
			}
			
			//Get the members
			if(this.packageId)    this.model.getMembers();
			else if(this.memberId) this.model.getMembersByMemberID(this.memberId);
			
			 this.onMetadataView = (this.parentView && this.parentView.type == "Metadata");
			 this.hasEntityDetails = (this.onMetadataView && (this.model.get("members").length < 150))? this.parentView.hasEntityDetails() : false;
			
			this.listenTo(this.model, "changeAll", this.render);
		},
		
		/*
		 * Creates a table of package/download contents that this metadata doc is a part of
		 */
		render: function(){
						
			var view = this,
				members = this.model.get("members");
			
			//If the model isn't complete, we may be still waiting on a response from the index so don't render anything yet
			if(!this.model.complete) return false;

			// Grab all of our URLs
			var queryServiceUrl   = appModel.get('queryServiceUrl');
			var packageServiceUrl = appModel.get('packageServiceUrl');
			
			//Start the HTML for the rows
			var	tbody = $(document.createElement("tbody"));
							
			//Filter out the packages from the member list
			members = _.filter(members, function(m){ return(m.type != "Package") });
			
			//Filter the members in order of preferred appearance
			members = this.sort(members);			
			this.sortedMembers = members;
			
			var metadata = this.model.getMetadata();
			
			//Count the number of rows in this table
			var numRows = members.length;
			
			//Cut down the members list to only those that will be visible
			members = members.slice(0, this.numVisible);
			this.rowsComplete = false;
			
			//Create the HTML for each row
			_.each(members, function(solrResult){					
				//Append the row element
				$(tbody).append(view.getMemberRow(solrResult));
			});
			
			var bodyRows = $(tbody).find("tr");
			this.numHidden = numRows - this.numVisible;
			
			//Draw the footer which will have an expandable/collapsable control
			if(this.numHidden > 0){
				var tfoot        = $(document.createElement("tfoot")),
					tfootRow     = $(document.createElement("tr")),
					tfootCell    = $(document.createElement("th")).attr("colspan", "100%"),
					item         = (this.numHidden == 1)? "item" : "items",
					expandLink   = $(document.createElement("a")).addClass("expand-control control").text("Show " + this.numHidden + " more " + item + " in this data set"),
					expandIcon   = $(document.createElement("i")).addClass("icon icon-caret-right icon-on-left"),
					collapseLink = $(document.createElement("a")).addClass("collapse-control control").text("Show less").css("display", "none"),
					collapseIcon = $(document.createElement("i")).addClass("icon icon-caret-up icon-on-left");

				$(tfoot).append(tfootRow);
				$(tfootRow).append(tfootCell);
				$(tfootCell).append(expandLink, collapseLink);
				$(expandLink).prepend(expandIcon);
				$(collapseLink).prepend(collapseIcon);
			}

			if(bodyRows.length == 0){
				tbody.html("<tr><td colspan='100%'>This is an empty dataset.</td></tr>");
			}
			
			//Draw and insert the HTML table
			var downloadButtonHTML = "";
			if(this.model.getURL() && this.model.get("id")){
				if(this.model.getTotalSize() < appModel.get("maxDownloadSize")){				
					downloadButtonHTML = this.downloadButtonTemplate({ 
						href: this.model.get("url"),
						id: this.model.get("id"),
						text: "Download all",
						className: "btn btn-primary ",
						isPublic: this.model.get("isPublic")
					});	
				}
				else{
					downloadButtonHTML = this.downloadButtonTemplate({
						text: "Download all",
						tooLarge: true
					});
				}
			}
			
			this.$el.html(this.template({
				downloadButton : downloadButtonHTML,
				readsEnabled   : this.readsEnabled,
					   title   : this.title || "Files in this dataset",
			          metadata : this.nested ? metadata : null,
			           colspan : bodyRows.first().find("td").length,
					 packageId : this.model.get("id"),
					    nested : this.nested
			}));
			
			//Add the table body and footer
			this.$("thead").after(tbody);
			if(typeof tfoot !== "undefined") this.$(tbody).after(tfoot);
												
			return this;
		},
		
		sort: function(models){
			//Default to the package model members as the models to sort
			if(!models){
				var models = this.model.get("members");
				//If this model doesn't have members, return an empty array or a falsey value
				if(!models) return models;
			}
			
			// One == already sorted!
			if(models.length == 1) return models;
			//If there are too many models to sort (takes too much time) then just get the metadata to display first
			else if(models.length > 150){
				var view = this;
				
				
				//Find the metadata doc we are currently viewing
				var currentMetadata = _.find(models, function(m){ return (m.get("id") == view.currentlyViewing) });
				//Add it to the front
				if(currentMetadata){
					models = _.without(models, currentMetadata);
					models.unshift(currentMetadata);
				}
				
				//Return the newly sorted array
				return models;
			}
				
			
			var view = this,
				metadataView = this.onMetadataView? this.parentView : null;
			
			//** If this is not a nested package AND the parent view is the metadata view, then sort by order of appearance in the metadata **/
			if(!this.nested && (metadataView && !_.findWhere(metadataView.subviews, {type: "MetadataIndex"}))){
				if(metadataView.hasEntityDetails()){
				
					//If we are currently viewing a metadata document, find it
					if(this.currentlyViewing)			
						var currentMetadata = _.find(models, function(m){ return (m.get("id") == view.currentlyViewing) });
					
					//For each model, find its position on the Metadata View page
					var numNotFound = 0;
					_.each(models, function(model){
						if(currentMetadata == model) return;
						
						var container = view.parentView.findEntityDetailsContainer(model.get("id"));
						if(container) model.offsetTop = $(container)[0].offsetTop;
						else{
							model.offsetTop = window.outerHeight;
							numNotFound++;
						}
					});
					
					//Continue only if we found the entity details section for at least one model, if not, sort by the default method later
					if(numNotFound < models.length-1){ //Minus 1 since we don't count the metadata				
						//Sort the models by this position
						models = _.sortBy(models, "offsetTop");
						
						//Move the metadata model that we are currently viewing in the Metadata view to the top		
						if(currentMetadata){
							models = _.without(models, currentMetadata);
							models.unshift(currentMetadata);
						}
						
						//Flatten the array in case we have nesting
						models = _.flatten(models);
						
						//Return the sorted array
						return models;
					}
				}
			} 
			
			//** For tables with no accompanying metadata (nested or not on the Metadata View), default to sorting by group then alpha by name**/			
			//Split the members of this package into groups based on their format type (metaata, data, image, code, etc)			
			var groupedModels = _.groupBy(models, function(m){
					if(!m.get("type") || (typeof m.get("type") == "undefined"))
						return "data";
					return m.get("type");
				}),
				sortedModels = [];
			
			var rowOrder = ["metadata", "image", "PDF", "program", "data", "annotation"];
			
			for(var i=0; i<rowOrder.length; i++){
				//Sort the members/rows alphabetically within each group
				/*models = _.sortBy(models, function(m){
					if(m.get("type") == "metadata") return "!"; //Always display metadata first since it will have the title in the table
					return m.get("type");
				});	*/				
				var group = groupedModels[rowOrder[i]];
				group = _.sortBy(group, function(m){
					return m.get("fileName") || m.get("id");
				});
				sortedModels.push(group);
			}
			
			models = _.flatten(sortedModels);

			return models;
		},

		getMemberRow: function(memberModel, options){			
			var formatType = memberModel.get("formatType"),
				type       = memberModel.type == "Package" ? "data" : memberModel.getType(),
				id		   = memberModel.get("id"),
				entityName = memberModel.get("fileName"),
				url        = memberModel.get("url"),
				hidden     = (typeof options === "undefined") ? false : options.hidden,
			    collapsable = hidden? true : (typeof options === "undefined") ? false : options.collapsable;
			
			if(!url){
				memberModel.setURL();
				url = memberModel.get('url');
			}
			//Use the metadata title instead of the ID
			if(!entityName && (formatType == "METADATA")) entityName = memberModel.get("title");
			if((formatType == "METADATA") && entityName) entityName =  "Metadata: " + entityName;
			else if((formatType == "METADATA") && !entityName) entityName = "Metadata";
	
			//Display the id in the table if not name is present
			if((typeof entityName === "undefined") || !entityName) entityName = id;
			
			//Create a row for this member of the data package
			var tr = $(document.createElement("tr"));
			
			//Icon cell (based on formatType)
			var iconCell = $(document.createElement("td")).addClass("format-type"),
				formatTypeIcon = document.createElement("i"),
				icon = "icon-table";
			
			//Determine the icon type based on format type
			if(type == "program")
				icon = "icon-code";
			else if(type == "data")
				icon = "icon-table";
			else if(type == "metadata")
				icon = "icon-file-text";
			else if (type == "image")
				icon = "icon-picture";
			else if (type == "pdf")
				icon = "icon-file pdf";
			
			$(formatTypeIcon).addClass(icon).tooltip({
				placement: "top",
				trigger: "hover focus",
				title: type.charAt(0).toUpperCase() + type.slice(1)
				
			});
			$(iconCell).html(formatTypeIcon);
			$(tr).append(iconCell);
			
			
			//Name cell
			var nameCell = $(document.createElement("td")).addClass("name wrap-contents");				
			var nameEl = $(document.createElement("span")).text(entityName);
			$(nameCell).html(nameEl);
			$(tr).append(nameCell);
			
			if(entityName == id)
				$(nameCell).addClass("entity-name-placeholder").attr("data-id", id);
			
			//"More info" cell				
			var moreInfoCell = $(document.createElement("td")).addClass("more-info");

			//If we are on the metadata view and there is no entity details section, then append a blank cell
			var	entityDetails = this.hasEntityDetails? this.parentView.findEntityDetailsContainer(id) : false,
				currentlyViewing = (id == this.currentlyViewing);
			if((this.onMetadataView && !this.hasEntityDetails) || (this.onMetadataView && !entityDetails) || currentlyViewing || this.nested){
				$(tr).append(moreInfoCell);
			}
			else{
				var moreInfo = $(document.createElement("a"))
								.attr("href", "#view/" + id)
								.addClass("preview")
								.attr("data-id", id)
								.text("More info");
				$(moreInfoCell).append(moreInfo);					
			}
			$(tr).append(moreInfoCell);
	
			//Format id cell
			var fileTypeCell = $(document.createElement("td")).addClass("formatId wrap-contents");			
			$(fileTypeCell).html(memberModel.getFormat());
			$(tr).append(fileTypeCell);
			
			//File size cell
			var sizeCell = $(document.createElement("td")).addClass("size");
			var size = memberModel.bytesToSize();
			$(sizeCell).text(size);
			$(tr).append(sizeCell);
	
			//The number of reads/downloads cell
			var reads = memberModel.get("read_count_i") || memberModel.get("reads");
			var readsCell = $(document.createElement("td")).addClass("downloads");		
			this.readsEnabled = false;
			$(tr).append(readsCell);
			if((typeof reads !== "undefined") && reads){ 
				if(formatType == "METADATA") reads += " views";
				else 						 reads += " downloads";
				$(readsCell).text(reads);
				this.readsEnabled = true;
			}
			
			//Download button cell
			var downloadBtnCell = $(document.createElement("td")).addClass("download-btn btn-container");	
			
			var downloadButtonHTML = this.downloadButtonTemplate({ 
				href: url, 
				fileName: entityName,
				id: memberModel.get("id"),
				isPublic: memberModel.get("isPublic"),
			});
			var downloadButton = $.parseHTML(downloadButtonHTML.trim());
			
			if(appUserModel.get("loggedIn") && !memberModel.get("isPublic"))
				$(downloadButton).on("click", null, this, this.download);
			
			$(downloadBtnCell).append(downloadButton);
			$(tr).append(downloadBtnCell);
			
			if(collapsable)
				tr.addClass("collapse");
			if(hidden)
				tr.css("display", "none");

			return tr;
		},

		download: function(e){				
			if(e && $(e.target).attr("data-id") && appUserModel.get("loggedIn")){
				e.preventDefault();
				var id = $(e.target).attr("data-id");
				
				var packageModel = this.model? this.model : (e.data && e.data.model)? e.data.model : null;
				
				if(!packageModel) return true;
					
				//Find the model with this ID
				packageModel = (packageModel.get("id") == id) ? packageModel : _.find(packageModel.get("members"), function(m){
					return (m.get("id") == id);
				});
				
				//If we found a model, fire the download event
				if(packageModel && !packageModel.get("isPublic")) 
					packageModel.downloadWithCredentials();
			}
			else
				return true;			
		},
		
		expand: function(e){
			//Don't do anything...
			e.preventDefault();
			
			var view = this;
			
			//If this is a nested dataset, we need to actually draw the remaining rows
			if(!this.rowsComplete){	
				var tbody = this.$("tbody");
				
				//Create the HTML for each row
				var members = this.sortedMembers.slice(this.numVisible);
				_.each(members, function(solrResult){					
					//Append the row element
					$(tbody).append(view.getMemberRow(solrResult, { collapsable: true }));
				});
				
				//Make the view as complete so we don't do this again
				this.rowsComplete = true;
			}

			this.$("tr.collapse").fadeIn();
			this.$(".expand-control").fadeOut(function(){
				view.$(".collapse-control").fadeIn("fast");
				view.$(".tooltip-this").tooltip();
			});
		},
		
		collapse: function(e){
			//Don't do anything...
			e.preventDefault();
			
			var view = this;

			this.$("tr.collapse").fadeOut();
			this.$(".collapse-control").fadeOut(function(){
				view.$(".expand-control").fadeIn();				
			});			
		}
	});
	
	return PackageTable;

});