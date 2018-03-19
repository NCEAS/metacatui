/* global define */
define(['underscore', 'jquery', 'backbone', 'models/metadata/eml211/EMLParty', 
        'text!templates/metadata/EMLParty.html'], 
    function(_, $, Backbone, EMLParty, EMLPartyTemplate){
        
        /* 
            The EMLParty renders the content of an EMLParty model
        */
        var EMLPartyView = Backbone.View.extend({
        	
        	type: "EMLPartyView",
        	
        	tagName: "div",
        	
        	className: "row-fluid eml-party",
        	
        	editTemplate: _.template(EMLPartyTemplate),
        	
        	initialize: function(options){
        		if(!options)
        			var options = {};
        		
        		this.isNew = options.isNew || (options.model? false : true);
        		this.model = options.model || new EMLParty();
        		this.edit  = options.edit  || false;
        		
        		this.$el.data({ model: this.model });
        		
        	},
        	
        	events: {
                "change" 		: "updateModel",
                "focusout"      : "showValidation",
        		"keyup .phone"  : "formatPhone",
        		"mouseover .remove" : "previewRemove",
        		"mouseout .remove"  : "previewRemove"
        	},
        	
        	render: function(){

        		//Format the given names
        		var name = this.model.get("individualName") || {},
        			fullGivenName = "";
        		
        		//Take multiple given names and combine into one given name.
        		//TODO: Support multiple given names as an array
        		if (Array.isArray(name.givenName)) {
					fullGivenName = _.map(name.givenName, function(name) {
							if(typeof name != "undefined" && name)
								return name.trim();
							else
								return "";
						}).join(' ');
				}
        		else
        			fullGivenName = name.givenName;
        		
        		//Get the address object
        		var address = Array.isArray(this.model.get("address"))? 
        						(this.model.get("address")[0] || {}) : (this.model.get("address") || {});
        		
        		//Use the template with the editing elements if this view has the "edit" flag on
        		if(this.edit){
        		
	        		//Send all the EMLParty info to the template
	        		this.$el.html(this.editTemplate({
	        			givenName  : fullGivenName || "",
	        			surName    : name.surName || "",
	        			salutation : name.salutation || "",
	        			orgName    : this.model.get("organizationName") || "",
	        			posName    : this.model.get("positionName") || "",
	        			addressOne : address.deliveryPoint && address.deliveryPoint.length? address.deliveryPoint[0] : "",
	        			addressTwo : address.deliveryPoint && address.deliveryPoint.length > 1? address.deliveryPoint[1] : "",
	        			city       : address.city || "",
	        			adminArea  : address.administrativeArea || "",
	        			country    : address.country || "",
	        			postalCode : address.postalCode || "",
	        			phone      : this.model.get("phone").length? this.model.get("phone")[0] : "",
	        			fax        : this.model.get("fax").length? this.model.get("fax")[0] : "",
	        			email      : this.model.get("email").length? this.model.get("email")[0] : "",
	        			website    : this.model.get("onlineUrl").length? this.model.get("onlineUrl")[0] : "",
	        			userId     : Array.isArray(this.model.get("userId"))? this.model.get("userId")[0] : this.model.get("userId") || "",
	        			uniqueId   : this.model.cid
	        		}));	        		
        		}
        		
        		//If this EML Party is new/empty, then add the new class
        		if(this.isNew){
        			this.$el.addClass("new");
        		}
        		
        		//Save the view and model on the element
        		this.$el.data({
        			model: this.model,
        			view: this
        		});
        		
        		this.$el.attr("data-category", this.model.get("type"));

        		return this;
        	},
        	
        	updateModel: function(e){
        		if(!e) return false;
        		
        		//If this is a new EML Party, add it to the parent EML211 model
        		if(this.isNew){
        			this.model.mergeIntoParent();
        			this.notNew();
        		}
        		
        		//Get the attribute that was changed
        		var changedAttr = $(e.target).attr("data-attribute");
        		if(!changedAttr) return false;
        		
        		//Get the current value
        		var currentValue = this.model.get(changedAttr);
        		
        		//Addresses and Names have special rules for updating
        		switch(changedAttr){
        			case "deliveryPoint":
        				this.updateAddress(e);
        				return;
        			case "city":
        				this.updateAddress(e);
        				return;
        			case "administrativeArea":
        				this.updateAddress(e);
        				return;
        			case "country":
        				this.updateAddress(e);
        				return;
        			case "postalCode":
        				this.updateAddress(e);
        				return;
        			case "surName":
        				this.updateName(e);
        				return;
        			case "givenName":
        				this.updateName(e);
        				return;
        			case "salutation":
        				this.updateName(e);
        				return;
        		}
        		
        		//Update the EMLParty model with the new value
        		if(Array.isArray(currentValue)){
        			//Get the position that this new value should go in
        			var position = this.$("[data-attribute='" + changedAttr + "']").index(e.target);
        			
        			//Put the new value in the array at the correct position
        			currentValue[position] = $(e.target).val();
        			this.model.set(changedAttr, currentValue);     
        			
        			this.model.trigger("change:" + changedAttr);
        			this.model.trigger("change");
        		}
        		else
        			this.model.set(changedAttr, $(e.target).val());
        		
        		this.model.trickleUpChange();
        		    		        			
        	},
        	
        	updateAddress: function(e){
        		if(!e) return false;
        		
        		//Get the address part that was changed
        		var changedAttr = $(e.target).attr("data-attribute");
        		if(!changedAttr) return false;
        		
        		//TODO: Allow multiple addresses - right now we only support editing the first address
        		var address = this.model.get("address")[0] || {},
        			currentValue = address[changedAttr];
        		
        		//Update the address
        		if(Array.isArray(currentValue)){
	        		//Get the position that this new value should go in
	    			var position = this.$("[data-attribute='" + changedAttr + "']").index(e.target);
	    			
	    			//Put the new value in the array at the correct position
	    			currentValue[position] = $(e.target).val();
        		}
        		//Make sure delivery points are saved as arrays
        		else if(changedAttr == "deliveryPoint"){
        			address[changedAttr] = [$(e.target).val()];
        		} 
        		else
        			address[changedAttr] = $(e.target).val();

        		//Update the model
    			var allAddresses = this.model.get("address");
    			allAddresses[0] = address;
    			this.model.set("address", allAddresses);

    			//Manually trigger the change event since it's an object
        		this.model.trigger("change:address");
        		this.model.trigger("change");
        		
        		this.model.trickleUpChange();
        	},
        	
        	updateName: function(e){
        		if(!e) return false;

        		//Get the address part that was changed
        		var changedAttr = $(e.target).attr("data-attribute");
        		if(!changedAttr) return false;
        		
        		//TODO: Allow multiple given names - right now we only support editing the first given name
        		var name = this.model.get("individualName") || {},
        			currentValue = String.prototype.trim(name[changedAttr]);
        		
        		//Update the name
        		if(Array.isArray(currentValue)){
	        		//Get the position that this new value should go in
	    			var position = this.$("[data-attribute='" + changedAttr + "']").index(e.target);
	    			
	    			//Put the new value in the array at the correct position
	    			currentValue[position] = $(e.target).val();
	    			
        		}
        		else if(changedAttr == "givenName"){
        			name.givenName =$(e.target).val().trim();
        		}
        		else
        			name[changedAttr] = $(e.target).val().trim();
        		
        		//Update the value on the model
        		this.model.set("individualName", name);
        		
        		//Manually trigger a change on the name attribute
        		this.model.trigger("change:individualName");
        		this.model.trigger("change");
        		
        		this.model.trickleUpChange();
        	},
            
            /**
             * Validates and displays error messages for the persons' name, position
             * and organization name.
             * 
             * @function showValidation
             */
        	showValidation: function() {

                if (this.model.isValid()) {
                    this.$(".notification").empty();
                    this.$(".error").removeClass("error");
                    return;
                }                
                
                // Check if there are values to validate
                if(this.needsValidation()) {
                	                	
                	//Start the full error message string for all the EMLParty errors
                	var errorMessages = "";
                	
                	//Iterate over each field that has a validation error
                	_.mapObject( this.model.validationError, function(errorMsg, attribute){
                		
                		//Find the input element for this attribute and add the error styling
                		this.$("[data-attribute='" + attribute + "']").addClass("error");
                		
                		//Add this error message to the full error messages string
                		errorMessages += errorMsg + " ";
                		
                	}, this);
                	
            		//Add the full error message text to the notification area and add the error styling
            		this.$(".notification").text(errorMessages).addClass("error");
        		
               }
            },
            
            /**
             * Checks if the user has entered any data in the fields.
             * 
             * @return {bool} True if the user has entered data, false otherwise
             */
            needsValidation: function() {

                // If we add any new fields, be sure to add the data-attribute here.
                attributes = ["country", "city", "administrativeArea", "postalCode", "deliveryPoint","userId",
                 "fax", "phone", "onlineUrl", "email", "givenName", "surName", "positionName", "organizationName"];

                 for(var i in attributes) {
                    var attribute = "[data-attribute='"+attributes[i]+"']";
                    if(this.$(attribute).val() != "") 
                        return true;
                 }
                 return false;
            },

        	// A function to format text to look like a phone number
        	formatPhone: function(e){
        	        // Strip all characters from the input except digits
        	        var input = $(e.target).val().replace(/\D/g,'');

        	        // Trim the remaining input to ten characters, to preserve phone number format
        	        input = input.substring(0,10);

        	        // Based upon the length of the string, we add formatting as necessary
        	        var size = input.length;
        	        if(size == 0){
        	                input = input;
        	        }else if(size < 4){
        	                input = '('+input;
        	        }else if(size < 7){
        	                input = '('+input.substring(0,3)+') '+input.substring(3,6);
        	        }else{
        	                input = '('+input.substring(0,3)+') '+input.substring(3,6)+' - '+input.substring(6,10);
        	        }
        	        
        	        $(e.target).val(input);
        	},
        	
        	previewRemove: function(){
        		this.$("input, img, label").toggleClass("remove-preview");
        	},

        	/*
        	 * Changes this view and its model from -new- to -not new-
        	 * "New" means this EMLParty model is not referenced or stored on a 
        	 * parent model, and this view is being displayed to the user so they can
        	 * add a new party to their EML (versus edit an existing one). 
        	 */
        	notNew: function(){
        		this.isNew = false;
        		
        		this.$el.removeClass("new");
        		this.$el.find(".new").removeClass("new");
        	}
        });
        
        return EMLPartyView;
    });