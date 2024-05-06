define(['jquery', 'underscore', 'backbone', 'views/ExpandCollapseListView', 'text!templates/provStatement.html'], 				
	function($, _, Backbone, ExpandCollapseList, ProvTemplate) {
	'use strict';

	/*
	 * Constructs a list of provenance statements based on the indexed prov fields of Solr documents.
	 * Renders a list of paragraph tags with sentences and links to the objects in the sentence.
	 * The Prov Statement template can be used to display other UI elements along with the textual prov statements.
	 * @extends Backbone.View
	 */
	var ProvStatementView = Backbone.View.extend(
		/** @lends ProvStatementView */{
		
		/*
		 * OPTIONS
		 * model 	     : A SolrResult model that the statements are using as a context. The prov statements will call this model "this data" or "this image", etc.
		 * 		           Provenance traces that do not involve this model will not be displayed.
		 * relatedModels : an array of SolrResult models that this view will look through to find the prov trace. 
		 */
		initialize: function(options){
			if((options === undefined) || (!options)) var options = {};
			
			this.className       += options.className        || "";
			this.model		      = options.model		     || null;
			this.relatedModels    = options.relatedModels    || new Array();
			this.currentlyViewing = options.currentlyViewing || null;
			
			this.relatedModels = _.uniq(_.flatten(this.relatedModels));
		},
		
		template: _.template(ProvTemplate),
		
		tagName : "p",
		
		className : "provenance-statement-container",
		
		//Prov fields / predicates in the prov statements that we do not want to display
		skipPredicates: ["prov_generatedByExecution", 
		                 "prov_generatedByUser", 
		                 "prov_instanceOfClass",
		                 "prov_wasGeneratedBy", 
		                 "prov_usedByExecution", 
		                 "prov_usedByUser",
		                 "prov_wasExecutedByExecution",
		                 "prov_wasExecutedByUser"],
		                 
		subviews: new Array(),
		
		events: {
			
		},
		
		/*
		 * Creates a provenance statement and inserts it into the template
		 */
		render: function(){
			//We need a SolrResult model in order to create a statement
			if(!this.model) return false;
			
			var view = this,
				statementsContainer = $(document.createElement("div"));
			
			//Add the provenance statement HTML from the template
			this.$el.html(view.template());
			
			//Make a triple for each prov property
			function Triple(s, p, o){
				this.subject   = s;
				this.predicate = p;
				this.object    = o;
				
				if(typeof s === "object")
					this.subjectID = s.get("id");
				else this.subjectID = s;
				
				if(typeof o === "object")
					this.objectID = o.get("id");
				else this.objectID = o;
			}
			var allTriples = new Array();
			
			//Make a list of predicates that we want to use in the prov statements
			var predicates = _.difference(MetacatUI.appSearchModel.getProvFields(), this.skipPredicates);			
			
			//Look for prov traces in all the models
			var allModels = _.union([this.model], this.relatedModels);			
			
			_.each(allModels, function(model, i, list){
				_.each(predicates, function(p, ii){
					if((typeof model.get(p) !== "undefined") && model.get(p)){
						
						var predicateValues = model.get(p),
							inversePredicate = view.getInversePredicate(p);
						
						_.each(predicateValues, function(value, iii){
							
							//Find a model in the "relatedModels" option if there is one that matches
							var modelFromID = _.find(view.relatedModels, function(m){ return(m.get("id") == value); }),
								tripleObject;
							
							if(typeof modelFromID === "undefined") tripleObject = value;
							else                                   tripleObject = modelFromID;
							
							//Create the Triple
							var triple = new Triple(model, p, tripleObject);							
							
							//Make sure this triple does not already exist as an inverse
							var hasInverse = false, 
							    x = 0;
							if((typeof allTriples[inversePredicate] !== "undefined")){
								while (!hasInverse && (x < allTriples[inversePredicate].length-1)){
									var inverseTriple = allTriples[inversePredicate][x];
									
									//If the triples match, then this triple's subject == its inverse's object AND this triple's object == its inverse's subject.
									if((inverseTriple.subjectID == triple.objectID) && (inverseTriple.objectID == triple.subjectID))
										hasInverse = true;
									
									x++;
								}
							}
							
							if(!hasInverse){
								if((typeof allTriples[p] === "undefined") || (!allTriples[p])) 
									allTriples[p] = new Array(triple);
								else
									allTriples[p].push(triple);		
							}						
						});
					}
				});				
			});
			
			//Basic info about our context model
			if(this.model.type == "Package")
				var noun = "package";
			else
				var noun = this.model.getType();
			
			var id = this.model.get("id");
			
			//Get a list of the predicates that we saved earlier
			var populatedPredicates = Object.keys(allTriples); 

			//Go through this array of triples, sorted by predicate
			_.each(populatedPredicates, function(predicate, i){
				//Start the statement/sentence when this model is the subject
				var subjStatementBegin = "This " + noun + " " + view.getPredicate(predicate),
					subjList		   = new Array();
				
				//State the statement/sentence when this model is the object
				var objStatementBegin = "This " + noun + " " + view.getPredicate(predicate, true),
					objList           = new Array();

				//Go through each triple type, based on predicate, in order to make prov statements
				_.each(allTriples[predicate], function(triple, ii){
					var type = "";
					
					//If the subject of this triple equals the id of this model, then structure the sentence as so
					if((triple.subject == id) || ((typeof triple.subject === "object") && (triple.subject.get("id") == id))){
						//Get information about the object of this triple
						var objectId   = "",
							objectName = "";
						
						if(typeof triple.object === "string"){
							objectId   = triple.object;
							objectName = triple.object;
						}
						else{
							objectId   = triple.object.get("id");
							objectName = triple.object.get("fileName");
						}
						var objectModel = _.find(view.relatedModels, function(m){ 
							return(m.get("id") == objectId); 
						});
						
						//Get the type of object this is so we can make an icon out of it
						if(typeof objectModel !== "undefined") 
							type = objectModel.getType();
						
						var icon = $(document.createElement("i")).attr("class", "icon " + view.getIconType(type));
						
						if(!objectName){
							if(typeof objectModel !== "undefined") 
								objectName = objectModel.get("id")
							else
								objectName = type || "";
						}		
						
						var linkText = $(document.createElement("span")).text(objectName).prepend(icon);
						
						//Make a link out of the object ID
						var link = $(document.createElement("a")).attr("href", "<%= MetacatUI.root %>/view/" + encodeURIComponent(objectId))
				                                                 .prepend(linkText)
				                                                 .attr("data-id", objectId)
															     .addClass("highlight-node preview node-link");
						
						//Is the triple object the entity the user is currently viewing?
						if(view.currentlyViewing && (view.currentlyViewing.get("id") == objectId)){
							$(linkText).addClass("currently-viewing pointer highlight-node node-link").attr("data-id", objectId);
							var linkContainer = $(document.createElement("span"))
													.prepend($(document.createElement("span")).text("the " + view.currentlyViewing.getType() + " you are currently viewing, "), linkText);
							subjList.push(linkContainer);
						}
						else
							subjList.push(link);
					}
					//If the object of this triple equals the id of this model, then structure the sentence as so
					else if((triple.object == id) || ((typeof triple.object === "object") && (triple.object.get("id") == id))){
						//Get information about the subject of this triple
						var subjectId   = "",
							subjectName = "";
					
						if(typeof triple.subject === "string"){
							subjectId   = triple.subject;
							subjectName = triple.subject;
						}
						else{
							subjectId   = triple.subject.get("id");
							subjectName = triple.subject.get("fileName");
						}
						
						var subjectModel = _.find(view.relatedModels, function(m){ 
							return(m.get("id") == subjectId); 
						});
						
						//Get the type of object this is so we can make an icon out of it
						if(typeof subjectModel !== "undefined") 
							type = subjectModel.getType();
						var icon = $(document.createElement("i")).attr("class", "icon " + view.getIconType(type));
						
						if(!subjectName){
							if(typeof subjectModel !== "undefined") 
								subjectName = subjectModel.get("id")
							else
								subjectName = type || "";
						}	
						
						var linkText = $(document.createElement("span")).text(subjectName);
												
						//Make a link of the subject ID
						var link = $(document.createElement("a")).attr("href", "<%= MetacatUI.root %>/view/" + encodeURIComponent(subjectId))
															     .prepend(icon, linkText)
															     .attr("data-id", subjectId)
															     .addClass("highlight-node preview");
						
						//Is the subject the entity the user is currently viewing?
						if(view.currentlyViewing && (view.currentlyViewing.get("id") == subjectId)){
							$(linkText).addClass("currently-viewing pointer highlight-node").attr("data-id", subjectId);
							var linkContainer = $(document.createElement("span"))
													.prepend($(document.createElement("span")).text("the " + view.currentlyViewing.getType() + " you are currently viewing, "), icon, linkText);
							objList.push(linkContainer);
						}
						else
							objList.push(link);
												                            
					}
				});
				
				//Add these statements to our element
				if(subjList.length > 0){
					var collapseListView = new ExpandCollapseList({list: subjList, prependText: subjStatementBegin, appendText: ". "});
					view.subviews.push(collapseListView);
					var singleStatement  = collapseListView.render().el;
					$(singleStatement).addClass("list-group-item statement");
				}
				if(objList.length > 0){
					var collapseListView = new ExpandCollapseList({list: objList,  prependText: objStatementBegin, appendText: ". "});
					view.subviews.push(collapseListView);
					var singleStatement = collapseListView.render().el;
					$(singleStatement).addClass("list-group-item statement");
				}
				
				//Does this provenance statement already exist? (This can happen when a triple is written in inverse)
				var	allStatements = $(statementsContainer).children(".statement"),
					isUnique = true;
				for(var x=0; x<allStatements.length; x++){
					if($(allStatements[x]).text() == $(singleStatement).text()){
						isUnique = false;
						break;
					}
				}
				//If this statement is unique, add it to the list
				if(isUnique){
					$(statementsContainer).append(singleStatement);
				}
			});
						
			//Insert the list element into the DOM
			view.$el.find(".provenance-statement").append($(statementsContainer));
							
			return this;
		},
		
		/*
		 * Translates the prov field name into a plain-english label to use as the predicate in the prov statement
		 */
		getPredicate: function(provFieldName, inverse){
			if(typeof inverse === "undefined") var inverse = false;
			
			if(provFieldName == "prov_wasDerivedFrom"          && !inverse) return "was derived from ";
			else if(provFieldName == "prov_wasDerivedFrom"     && inverse)  return "was used as an input to create ";
			else if(provFieldName == "prov_generatedByProgram" && !inverse) return "was generated by ";
			else if(provFieldName == "prov_generatedByProgram" && inverse)  return "generated ";
			else if(provFieldName == "prov_generated"          && !inverse)  return "generated ";
			else if(provFieldName == "prov_generated"          && inverse)  return "was generated by ";
			else if(provFieldName == "prov_usedByProgram"      && !inverse) return "was used by ";
			else if(provFieldName == "prov_usedByProgram"      && inverse)  return "used ";
			else if(provFieldName == "prov_used"               && !inverse) return "used ";
			else if(provFieldName == "prov_used"               && inverse)  return "was used by ";
			else return provFieldName + " ";
		},
		
		getInversePredicate: function(p){
			if(p == "prov_generated")               return "prov_generatedByProgram";
			else if(p == "prov_generatedByProgram") return "prov_generated";
			else if(p == "prov_usedByProgram")      return "prov_used";
			else if(p == "prov_used")               return "prov_usedByProgram";
			else                                    return false;
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
		},
		
		onClose: function() {			
			this.$el.remove();
			this.remove();			
		}
	});
	
	return ProvStatementView;		
});
