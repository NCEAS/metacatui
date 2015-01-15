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
			
			//Set up the Package model
			this.model = new Package();
			this.model.set("memberId", this.memberId);
			this.model.set("packageId", this.packageId);
			
			//Set up a listener for when the model is ready to work with
			this.listenTo(this.model, "complete", this.render);
			
			//Get the members
			if(this.packageId)    this.model.getMembers();
			else if(this.memberId) this.model.getMembersByMemberID(this.memberId);
		},
		
		template: _.template(Template),
		
		downloadButtonTemplate: _.template(DownloadButtonTemplate),
		
		tagName : "div",
		
		className : "download-contents container",
		
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
				
				//Create an icon to represent this object type
				var iconCell = $(document.createElement("td")).addClass("format-type");
				var formatTypeIcon = document.createElement("i");
				if(formatType == "METADATA") $(formatTypeIcon).addClass("icon-file-text");
				else 						 $(formatTypeIcon).addClass("icon-table");
				$(iconCell).html(formatTypeIcon);
				$(tr).append(iconCell);
				
				//Make the id with a link
				//TODO: When titles for objects are indexed, use that for display instead of the id
				var idCell = $(document.createElement("td")).addClass("id ellipsis");				
				var idLink = document.createElement("a");
				$(idLink).attr("href", objectServiceUrl + encodeURIComponent(id))
						 .text(id);
				$(idCell).html(idLink);
				$(tr).append(idCell);

				//Make an element for the file type
				var fileTypeCell = $(document.createElement("td")).addClass("file-type");				
				var fileTypePopover = "";
				var fileType = solrResult.get("formatId");
				if(fileType.substr(0, 3) == "eml"){
					//If the file type is EML, we may want to show a popover element for more info
					if(EMLRoute) fileType = '.xml (<a href="#tools/eml">EML ' + fileTypePopover + '</a>)';
					else fileType = ".xml (EML" + fileTypePopover + ")";
				}
				else if(fileType == "application/pdf") fileType = "PDF"; //Friendlier-looking...
				$(fileTypeCell).text(fileType);
				$(tr).append(fileTypeCell);
				
				//Add the file size
				var sizeCell = $(document.createElement("td")).addClass("size");
				var size = view.bytesToSize(solrResult.get("size"));
				$(sizeCell).text(size);
				$(tr).append(sizeCell);

				//The number of reads/downloads
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
				
				//Make a download button for this item
				var downloadBtnCell = $(document.createElement("td")).addClass("download-btn");				
				var downloadButtonHTML = view.downloadButtonTemplate({ href: objectServiceUrl + encodeURIComponent(id) });
				$(downloadBtnCell).append(downloadButtonHTML);
				$(tr).append(downloadBtnCell);
				
				//Add a "Preview" link
				var moreInfoCell = $(document.createElement("td")).addClass("more-info");				
				var moreInfo = $(document.createElement("a"))
								.attr("href", "#" + id)
								.addClass("btn")
								.text("Preview");
				var moreInfoIcon = $(document.createElement("i"))
									.addClass("icon icon-info-sign");
				$(moreInfo).append(moreInfoIcon);
				$(moreInfoCell).append(moreInfo);
				$(tr).append(moreInfoCell);
				
				$(tbody).append(tr);
					
			});

			//Draw and insert the HTML table
			var downloadButtonHTML = "";
			if(packageServiceUrl){
				downloadButtonHTML = this.downloadButtonTemplate({ 
					href: packageServiceUrl + encodeURIComponent(id), 
					text: "Download all",
					className: "btn btn-primary "
				});	
			}
			this.$el.append(this.template({
				downloadButton: downloadButtonHTML,
				readsEnabled: readsEnabled
			}));
			this.$("thead").after(tbody);
		
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