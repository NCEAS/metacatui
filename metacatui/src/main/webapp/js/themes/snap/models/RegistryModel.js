/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Registry Model 
	// ------------------
	var RegistryModel = Backbone.Model.extend({
		// This model contains additional fields needed for the Registry
		defaults: {
			// include by default in the Registry form for this theme
			formFields: 
				{
					"keyword" : "Science for Nature and People (SNAP)"
				},
			// include in ALL queries for this theme, the key is not used, but must be unique
			searchFields: 
				{
					"SNAP" : "+keywords:%22Science for Nature and People (SNAP)%22"
				},
			// keyword options inserted into the Registry form for user to select from 	
			formOptions:
				{
					"workingGroup" : 
						[
						"Amazon Waters",
						"Better Land-Use Decisions",
						"Chinese Ivory Trade",
						"Coastal Defenses",
						"Data-Limited Fisheries",
						"Ecological Drought",
						"Evidence-Based Conservation",
						"Faith and Conservation",
						"Fire Research Consensus",
						"Fisheries Measures",
						"Forest Sharing or Sparing",
						"Gaming the Future of Climate Communications",
						"Hydraulic Fracturing",
						"Making Ecosystems Count",
						"Natural Capital Accounting",
						"Ridges to Reef Fisheries",
						"Sharing Water",
						"Sustainable Ag Intensification",
						"Sustainable Aquaculture",
						"Water Security"
						]
				},
			// optional filters for specific WGs, keyword categories, etc (side bar use)
			searchOptions:
				{
					"Amazon Waters" : 'keywords:%22Amazon%20Waters%22',
					"Better Land-Use Decisions" : 'keywords:%22Better%20Land%2DUse%20Decisions%22',
					"Chinese Ivory Trade" : 'keywords:%22Chinese%20Ivory%20Trade%22',
					"Coastal Defenses" : 'keywords:%22Coastal%20Defenses%22',
					"Data-Limited Fisheries" : 'keywords:%22Data%2DLimited%20Fisheries%22',
					"Ecological Drought" : 'keywords:%22Ecological%20Drought%22',
					"Evidence-Based Conservation" : 'keywords:%22Evidence%2DBased%20Conservation%22',
					"Faith and Conservation" : 'keywords:%22Faith%20and%20Conservation%22',
					"Fire Research Consensus" : 'keywords:%22Fire%20Research%20Consensus%22',
					"Fisheries Measures" : 'keywords:%22Fisheries%20Measures%22',
					"Forest Sharing or Sparing" : 'keywords:%22Forest%20Sharing%20or%20Sharing%22',
					"Gaming the Future of Climate Communications" : 'keywords:%22Gaming%20the%20Future%20of%20Climate%20Communications%22',
					"Hydraulic Fracturing" : 'keywords:%22Hydraulic%20Fracturing%22',
					"Making Ecosystems Count" : 'keywords:%22Making%20Ecosystems%20Count%22',
					"Natural Capital Accounting" : 'keywords:%22Natural%20Capital%20Accounting%22',
					"Ridges to Reef Fisheries" : 'keywords:%22Ridges%20to%20Reef%20Fisheries%22',
					"Sharing Water" : 'keywords:%22Sharing%20Water%22',
					"Sustainable Ag Intensification" : 'keywords:%22Sustainable%20Ag%20Intensification%22',
					"Sustainable Aquaculture" : 'keywords:%22Sustainable%20Aquaculture%22',
					"Water Security" : 'keywords:%22Water%20Security%22'
				}
			
		}
		
	});
	return RegistryModel;
});
