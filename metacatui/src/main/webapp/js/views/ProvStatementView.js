define(['jquery', 'underscore', 'backbone', 'views/ExpandCollapseListView', 'text!templates/provStatement.html'], 				
	function($, _, Backbone, ExpandCollapseList, ProvTemplate) {
	'use strict';

	/*
	 * Constructs a list of provenance statements based on the indexed prov fields of Solr documents.
	 * Renders a list of paragraph tags with sentences and links to the objects in the sentence.
	 * The Prov Statement template can be used to display other UI elements along with the textual prov statements.
	 */
	var ProvStatementView = Backbone.View.extend({
		
		/*
		 * OPTIONS
		 * model 	     : A SolrResult model that the statements are using as a context. The prov statements will call this model "this data" or "this image", etc.
		 * 		           Provenance traces that do not involve this model will not be displayed.
		 * relatedModels : an array of SolrResult models that this view will look through to find the prov trace. 
		 */
		initialize: function(options){
			if((options === undefined) || (!options)) var options = {};
			
			this.className    += options.className     || "";
			this.model		   = options.model		   || null;
			this.relatedModels = options.relatedModels || new Array();
		},
		
		template: _.template(ProvTemplate),
		
		tagName : "p",
		
		className : "provenance-statement-container",
		
		events: {
			
		},
		
		/*
		 * Creates a provenance statement and inserts it into the template
		 */
		render: function(){
			//We need a SolrResult model in order to create a statement
			if(!this.model) return false;
			
			var view 	    = this,
				statementEl = $(document.createElement("div"));
			
			//Add the provenance statement HTML from the template
			this.$el.html(view.template());
			
			//Make a triple for each prov property
			function Triple(s, p, o){
				this.subject = s;
				this.predicate = p;
				this.object  = o;
			}
			var allTriples = new Array();
			
			//Make a list of predicates that we want to use in the prov statements
			var predicates = searchModel.getProvFields();
			
			//Look for prov traces in all the models
			var allModels = _.union(this.model, this.relatedModels);
			
			_.each(allModels, function(model, i, list){
				_.each(predicates, function(p, ii){
					if((typeof model.get(p) !== "undefined") && model.get(p)){
						var predicateValues = model.get(p);
						_.each(predicateValues, function(value, iii){
							
							//Find a model in the "relatedModels" option if there is one that matches
							var modelFromID = _.find(view.relatedModels, function(m){ return(m.get("id") == value); }),
								tripleObject;
							
							if(typeof modelFromID === "undefined") tripleObject = value;
							else                                   tripleObject = modelFromID;
							
							if((typeof allTriples[p] === "undefined") || (!allTriples[p])) 
								allTriples[p] = new Array(new Triple(model, p, tripleObject));
							else
								allTriples[p].push(new Triple(model, p, tripleObject));							
						});
					}
				});				
			});
			
			//Basic info about our context model
			var noun = this.model.getType(),
				id   = this.model.get("id");
			
			//Get a list of the predicates that we saved earlier
			var populatedPredicates = Object.keys(allTriples); 

			//Go through this array of triples, sorted by predicate
			_.each(populatedPredicates, function(predicate, i){
				//Start the statement/sentence when this model is the subject
				var subjStatementEl = $(document.createElement("p")).text("This " + noun + " " + view.getPredicate(predicate)),
					addSubjStatement = false;
				//State the statement/sentence when this model is the object
				var objStatementEl = $(document.createElement("p")).text("This " + noun + " " + view.getPredicate(predicate, true)),
					addObjStatement = false;

				//Go through each triple type, based on predicate, in order to make prov statements
				_.each(allTriples[predicate], function(triple, ii){
					var type = "";
					
					//If the subject of this triple equals the id of this model, then structure the sentence as so
					if((triple.subject == id) || ((typeof triple.subject === "object") && (triple.subject.get("id") == id))){
						//Make an icon for this data object type
						var objectModel = _.find(view.relatedModels, function(m){ return(m.get("id") == objectId); });
						if(typeof objectModel !== "undefined") type = objectModel.getType();
						
						//Make a link out of the object ID
						var objectId = (typeof triple.object === "string") ? triple.object : triple.object.get("id");
						$(subjStatementEl).append($(document.createElement("a"))
							                                .attr("href", appModel.get("objectServiceUrl") + objectId)
							                                .text(objectId)
				                                            .prepend(
						                                            $(document.createElement("i"))
						                                                      .attr("class", "icon " + view.getIconType(type))));
						
						//Flag that there is a statement with subjects
						addSubjStatement = true;
					}
					//If the object of this triple equals the id of this model, then structure the sentence as so
					else if((triple.object == id) || ((typeof triple.object === "object") && (triple.object.get("id") == id))){
						//Make an icon for this data object type
						var subjectModel = _.find(view.relatedModels, function(m){ return(m.get("id") == subjectId); });
						if(typeof subjectModel !== "undefined") type = subjectModel.getType();
						
						//Make a link of the subject ID
						var subjectId = (typeof triple.subject === "string") ? triple.subject : triple.subject.get("id");
						$(objStatementEl).append(
												$(document.createElement("a"))
													      .attr("href", appModel.get("objectServiceUrl") + subjectId)
										                  .text(subjectId)
										                  .prepend(
												                  $(document.createElement("i"))
												                            .attr("class", "icon " + view.getIconType(type))));
												                  

						//Flag that there is a statement with objects
						addObjStatement = true;
					}
				});
				
				//Add these statements to our element
				if(addSubjStatement) $(statementEl).append(subjStatementEl);
				if(addObjStatement)  $(statementEl).append(objStatementEl);
			});
			
			//Insert the list element into the DOM
			view.$el.find(".provenance-statement").append($(statementEl).html());
							
			return this;
		},
		
		/*
		 * Translates the prov field name into a plain-english label to use as the predicate in the prov statement
		 */
		getPredicate: function(provFieldName, inverse){
			if(typeof inverse === "undefined") var inverse = false;
			
			if(provFieldName == "prov_wasDerivedFrom"          && !inverse) return "was derived from ";
			else if(provFieldName == "prov_wasDerivedFrom"     && inverse)  return "was used as a source to create ";
			else if(provFieldName == "prov_generatedByProgram" && !inverse) return "was generated by the program ";
			else if(provFieldName == "prov_generatedByProgram" && inverse)  return "generated ";
			else return provFieldName + " ";
		},
		
		getIconType: function(type){
			if((typeof type === "undefined") || !type) 
				return "icon-table";
			else if(type == "program")
				return "icon-code";
			else if(type == "data")
				return "icon-table";
			else if(type == "metadata")
				return "icon-file-text";
			else if (type == "image")
				return "icon-picture";
			else if (type == "pdf")
				return "icon-file pdf";
			else if(type == "package")
				return "icon-folder-open";
		}
	});
	
	return ProvStatementView;		
});
