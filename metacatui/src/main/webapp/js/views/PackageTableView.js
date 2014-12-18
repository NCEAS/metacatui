define(['jquery', 'underscore', 'backbone', 'models/PackageModel', 'text!templates/downloadContents.html'], 				
	function($, _, Backbone, Package, Template) {
	'use strict';

	
	var PackageTable = Backbone.View.extend({
		
		initialize: function(options){
			if((options === undefined) || (!options)) var options = {};
			
			this.id   		= options.id	 	 || null;
			this.attributes = options.attributes || null;
			this.className += options.className  || "";
		},
		
		template: _.template(Template),
		
		tagName : "div",
		
		className : "download-contents container",
		
		events: {
			
		},
		
		/*
		 * Creates a table of package/download contents that this metadata doc is a part of
		 */
		render: function(pid){
			var view = this;
			
			//Keep a map of resource map ID <-> objects in that resource map 
			var packages = new Array();
			//Keep a list of all resource map objects
			var maps = new Array();
			var objects = new Array();

			var resourceMapQuery = "";
			
			// Grab all of our URLs
			var queryServiceUrl   = appModel.get('queryServiceUrl');
			var packageServiceUrl = appModel.get('packageServiceUrl') || appModel.get('objectServiceUrl');
			var objectServiceUrl  = appModel.get('objectServiceUrl');
			
			//Does a route to an EML info page exist?
			var routes = Object.keys(uiRouter.routes),
				EMLRoute = false;
			for(var i=0; i<routes.length; i++){
				if(routes[i].indexOf("tools") > -1){
					EMLRoute = true;
					i = routes.length;
				}
			}
						
			//*** Find each resource map that this metadata is a part of 
			// surround pid value in "" so that doi characters do not affect solr query
			var query = 'fl=resourceMap,read_count_i,size,formatType,formatId,id' +
						'&wt=json' +
						'&rows=100' +
						'&q=formatType:METADATA+-obsoletedBy:*+id:"' + pid + '"';

			$.get(queryServiceUrl + query, function(data, textStatus, xhr) {
						
				var resourceMap = data.response.docs[0].resourceMap;
						
				// Is this metadata part of a resource map?
				if(resourceMap !== undefined){
					
					//Add to our list and map of resource maps if there is at least one
					_.each(resourceMap, function(resourceMapID){
						packages[resourceMapID] = new Array();
						resourceMapQuery += 'resourceMap:"' + encodeURIComponent(resourceMapID) + '"%20OR%20id:"' + encodeURIComponent(resourceMapID) + '"%20OR%20';
					});

					//*** Find all the files that are a part of those resource maps
					var query = 'fl=resourceMap,read_count_i,size,formatType,formatId,id,wasDerivedFrom,wasGeneratedBy,used,wasInformedBy&wt=json&rows=100&q=-obsoletedBy:*+%28' + resourceMapQuery + 'id:"' + encodeURIComponent(pid) + '"%29';
					$.get(queryServiceUrl + query, function(moreData, textStatus, xhr) {
								
						var pids   = [], //Keep track of each object pid
							images = [], //Keep track of each data object that is an image
							pdfs   = [], //Keep track of each data object that is a PDF 
							other = []; //Keep track of all non-metadata and non-resource map objects
							
						//Separate the resource maps from the data/metadata objects
						_.each(moreData.response.docs, function(doc){
							if(doc.formatType == "RESOURCE"){											
								maps.push(doc);
							}
							else{
								objects.push(doc);
								pids.push(doc.id);
								
								//Keep track of each data objects so we can display them later
								//if(view.isImage(doc)) images.push(doc);
								//else if(view.isPDF(doc)) pdfs.push(doc);
								//else if(doc.formatType != "METADATA") other.push(doc);
							}
						});
										
						//Now go through all of our objects and add them to our map
						_.each(objects, function(object){
							_.each(object.resourceMap, function(resourceMapId){
								if (packages[resourceMapId]) {
									packages[resourceMapId].push(object);												
								}												
							});
						});
						
						var pkg = new Package();
						pkg.id = "r_test_pkg.2014100615271412634444.1";
						pkg.getMembers();
											
						//For each resource map package, add a table of its contents to the page 
						var count = 0;
						_.each(maps, function(thisMap){
							var dataWithDetailsOnPage = [],
								packageSize			  = 0;
							
							//If a data object in this package is mentioned in the metadata, insert a link to its details
							_.each(packages[thisMap.id], function(object){
								if(view.$el.find(":contains(" + object.id + ")").length){
									dataWithDetailsOnPage.push(object.id);
								}
								
								packageSize += object.size;								
								object.formattedSize = view.bytesToSize(object.size, 2);
							});
							
							thisMap.formattedSize = view.bytesToSize(packageSize, 2);
							
							view.$el.append(view.template({
								objects: packages[thisMap.id],
								resourceMap: thisMap,
								package_service: packageServiceUrl,
								object_service: objectServiceUrl,
								EMLRoute: EMLRoute,
								dataWithDetailsOnPage: dataWithDetailsOnPage
							}));
						}); 
						
						//Replace Ecogrid Links with DataONE API links
						//view.replaceEcoGridLinks(pids);
						
						//Display data objects if they are visual
						//view.insertVisuals(images, "image");
						//view.insertVisuals(pdfs, "pdf");
						//view.insertVisuals(other);
					    
					}, "json").error(function(){
						console.warn(reponse);
					});
				}	
				//If this is just one metadata object, just send that info alone
				else{
					var object = data.response.docs[0];
					object.formattedSize = view.bytesToSize(object.size, 2);
					
					view.$el.append(view.template({
						objects: data.response.docs,
						resourceMap: null,
						package_service: packageServiceUrl,
						object_service: objectServiceUrl,
						EMLRoute: EMLRoute
					}));
				}
										
				//Initialize any popovers
				$('.popover-this').popover();
						
			}, "json").error(function(){
				console.warn(repsonse);
			});
			
			return this;
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