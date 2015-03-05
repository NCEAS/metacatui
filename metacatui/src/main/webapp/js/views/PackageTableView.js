define(['jquery', 'underscore', 'backbone', 'models/PackageModel', 'text!templates/downloadContents.html', 'text!templates/downloadButton.html'], 				
	function($, _, Backbone, Package, Template, DownloadButtonTemplate) {
	'use strict';

	
	var PackageTable = Backbone.View.extend({
		
		initialize: function(options){
			if((options === undefined) || (!options)) var options = {};
			
			this.packageId  = options.packageId	 || null;
			this.memberId	= options.memberId	 || null;
			this.attributes = options.attributes || null;
			this.className += options.className  || "";
			this.currentlyViewing = options.currentlyViewing || null;
			
			//Set up the Package model
			if((typeof options.model === "undefined") || !options.model){
				this.model = new Package();
				this.model.set("memberId", this.memberId);
				this.model.set("packageId", this.packageId);
			}
			
			//Set up a listener for when the model is ready to work with
			//this.listenTo(this.model, "complete", this.render);
			
			//Get the members
			if(this.packageId)    this.model.getMembers();
			else if(this.memberId) this.model.getMembersByMemberID(this.memberId);
		},
		
		template: _.template(Template),
		
		downloadButtonTemplate: _.template(DownloadButtonTemplate),
		
		tagName : "div",
		
		className : "download-contents",
		
		events: {
			"click .btn.preview" : "previewData"
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
			var objectServiceUrl  = appModel.get('objectServiceUrl');
			
			var readsEnabled = false;

			//Does a route to an EML info page exist? If not, don't insert any links to EML info
			var routes = Object.keys(uiRouter.routes),
				EMLRoute = false;
			for(var i=0; i<routes.length; i++){
				if(routes[i].indexOf("tools") > -1){
					EMLRoute = true;
					i = routes.length;
				}
			}
			
			//Start the HTML for the rows
			var	tbody = $(document.createElement("tbody"));
		
			//Create the HTML for each row
			_.each(members, function(solrResult){
				
				var formatType = solrResult.get("formatType"),
					id		   = solrResult.get("id");
				
				//Create a row for this member of the data package
				var tr = $(document.createElement("tr"));
				
				//Icon cell (based on formatType)
				var iconCell = $(document.createElement("td")).addClass("format-type");
				var formatTypeIcon = document.createElement("i");
				if(formatType == "METADATA") $(formatTypeIcon).addClass("icon-file-text");
				else 						 $(formatTypeIcon).addClass("icon-table");
				$(iconCell).html(formatTypeIcon);
				$(tr).append(iconCell);
				
				//Id cell
				//TODO: When titles for objects are indexed, use that for display instead of the id
				var idCell = $(document.createElement("td")).addClass("id wrap-contents");				
				var idLink = document.createElement("a");
				$(idLink).attr("href", objectServiceUrl + encodeURIComponent(id))
						 .text(id);
				$(idCell).html(idLink);
				$(tr).append(idCell);

				//Format type cell
				var fileTypeCell = $(document.createElement("td")).addClass("formatId wrap-contents");				
				var fileTypePopover = "";
				var fileType = solrResult.get("formatId");
				if(fileType.substr(0, 3) == "eml"){
					//If the file type is EML, we may want to show a popover element for more info
					if(EMLRoute) fileType = '.xml (<a href="#tools/eml">EML ' + fileTypePopover + '</a>)';
					else fileType = ".xml (EML" + fileTypePopover + ")";
				}
				else if(fileType == "application/pdf") fileType = "PDF"; //Friendlier-looking...
				$(fileTypeCell).html(fileType);
				$(tr).append(fileTypeCell);
				
				//File size cell
				var sizeCell = $(document.createElement("td")).addClass("size");
				var size = view.bytesToSize(solrResult.get("size"));
				$(sizeCell).text(size);
				$(tr).append(sizeCell);

				//The number of reads/downloads cell
				var reads = solrResult.get("downloads");
				if((typeof reads !== "undefined") && (reads !== null)){ 
					var readsCell = $(document.createElement("td")).addClass("downloads");				
					if(formatType == "METADATA") reads += " views";
					else 						 reads += " downloads";
					$(readsCell).text(reads);
					$(tr).append(readsCell);
					readsEnabled = true;
				}
				else readsEnabled = false;
				
				//Download button cell
				var downloadBtnCell = $(document.createElement("td")).addClass("download-btn btn-container");				
				var downloadButtonHTML = view.downloadButtonTemplate({ href: objectServiceUrl + encodeURIComponent(id) });
				$(downloadBtnCell).append(downloadButtonHTML);
				$(tr).append(downloadBtnCell);
				
				//"Preview" link cell
				var moreInfoCell = $(document.createElement("td")).addClass("more-info btn-container");
				var moreInfo     = $(document.createElement("a"))
									.attr("href", "#view/" + id)
									.addClass("btn preview")
									.attr("data-id", encodeURIComponent(id))
									.text("Preview");
				var moreInfoIcon = $(document.createElement("i"))
									.addClass("icon icon-info-sign");
				$(moreInfo).append(moreInfoIcon);					
				$(moreInfoCell).append(moreInfo);
				$(tr).append(moreInfoCell);
				
				//If we are already viewing this object, display the button as disabled with a tooltip
				if(view.currentlyViewing == solrResult.get("id")){
					$(moreInfo).attr("disabled", "disabled").tooltip({
						title: "You are currently viewing this metadata document",
						trigger: "hover"
					});
				}
				
				//Add this row to the table body
				$(tbody).append(tr);
					
			});

			//Draw and insert the HTML table
			var downloadButtonHTML = "";
			if(packageServiceUrl){
				downloadButtonHTML = this.downloadButtonTemplate({ 
					href: packageServiceUrl + encodeURIComponent(this.model.get("id")), 
					text: "Download all",
					className: "btn btn-primary "
				});	
			}
			this.$el.append(this.template({
				downloadButton: downloadButtonHTML,
				readsEnabled: readsEnabled
			}));
			this.$("thead").after(tbody);
			
			return this;
		},
		
		/**
		 * When the "Preview" button in the table is clicked while we are on the Metadata view, 
		 * we want to scroll to the anchor tag of this data object within the page instead of navigating
		 * to the metadata page again, which refreshes the page and re-renders (more loading time)
		 **/
		previewData: function(e){
			//Don't go anywhere yet...
			e.preventDefault();
			
			//Get the target of the click
			var button = $(e.target);
			
			//Are we on the Metadata view? If not, navigate to the link href
			var hash  = window.location.hash;
			var page = hash.substring(hash.indexOf("#")+1, 5);
			if(page != "view") window.location = $(button).attr("href");  
			
			//If we are on the Metadata view, then let's scroll to the anchor
			var id = $(button).attr("data-id");
			var anchor = $("a[name='" + id + "']");
			if(anchor.length) appView.scrollTo(anchor[0]);
		},
		
		/**
		 * Convert number of bytes into human readable format
		 *
		 * @param integer bytes     Number of bytes to convert
		 * @param integer precision Number of digits after the decimal separator
		 * @return string
		 */
		bytesToSize: function(bytes, precision){  
		    var kilobyte = 1024;
		    var megabyte = kilobyte * 1024;
		    var gigabyte = megabyte * 1024;
		    var terabyte = gigabyte * 1024;
		   
		    if ((bytes >= 0) && (bytes < kilobyte)) {
		        return bytes + ' B';
		 
		    } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
		        return (bytes / kilobyte).toFixed(precision) + ' KB';
		 
		    } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
		        return (bytes / megabyte).toFixed(precision) + ' MB';
		 
		    } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
		        return (bytes / gigabyte).toFixed(precision) + ' GB';
		 
		    } else if (bytes >= terabyte) {
		        return (bytes / terabyte).toFixed(precision) + ' TB';
		 
		    } else {
		        return bytes + ' B';
		    }
		}
	});
	
	return PackageTable;

});