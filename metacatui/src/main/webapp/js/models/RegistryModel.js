/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Registry Model 
	// ------------------
	var RegistryModel = Backbone.Model.extend({
		// This model contains additional fields needed for the Registry
		defaults: {
			formFields: {},
			searchFields: {},
			formOptions: {},
			searchOptions: {},
			//Valid statuses: insert, processing, complete, error
			status: "insert",
			id: null,
			changed: false
		},
		
		/*  Checks the index for the newly-inserted document. 
		 *  Will check multiple times over the course of 30 minutes, or until it's found */
		checkIndex: function(){
			var model = this,
				timeouts = [],
				checkCount = 0;
			
			var requestSettings = {
				url: appModel.get("queryServiceUrl") + 'q=id:"' + encodeURIComponent(this.get("id")) + '"&rows=1&fl=id&wt=json',
				success: function(data){
				 	//Keep track of how many times we've checked the index
				 	checkCount++;
				 	
					//If we found the solr doc for this entry
				 	if(data.response.numFound == 1){
				 		//Mark the model as complete
				 		model.set("status", "complete");
				 		
				 		//Clear all the timeouts we set earlier
				 		_.each(timeouts, function(timeoutId){
				 			window.clearTimeout(timeoutId);
				 		});
				 	}
				 	//If we have gone through the queue and we still haven't found the entry in the index, 
				 	// then mark this entry as an error.
				 	else if((timeouts.length > 0) && (checkCount > timeouts.length)){
				 		model.set("status", "timeout");
				 		
				 		//Clear all the timeouts we set earlier
				 		_.each(timeouts, function(timeoutId){
				 			window.clearTimeout(timeoutId);
				 		});
				 	}
				},
				error: function(){
					//Update the status to error
					model.set("status", "error");
					
					//Clear all the timeouts we set earlier
			 		_.each(timeouts, function(timeoutId){
			 			window.clearTimeout(timeoutId);
			 		});
				}
			}
			
			//Send the query right away
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));				

			//Now create a queue of queries that will be sent periodically 
			var tenMinutes = 600000;
			for(var msDelay=500; msDelay < tenMinutes; msDelay*=2){
				var timerId = window.setTimeout(function(){
					$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));				
				}, msDelay);	
				timeouts.push(timerId);
			}
		},
		
		reset: function(){
		    return this.set(_.clone(this.defaults));
		}
		
	});
	return RegistryModel;
});
