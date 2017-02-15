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
        		"change" : "updateModel"
        	},
        	
        	render: function(){
        		
        		//When the model changes, render again
        		//this.listenTo(this.model, "change", this.render);

        		//Format the given names
        		var name = this.model.get("individualName"),
        			fullGivenName = "";
        		
        		_.each(name.givenName, function(givenName){
        			fullGivenName += givenName + " ";
        		});
        		
        		fullGivenName = fullGivenName.trim();
        		
        		//Get the address object
        		var address = Array.isArray(this.model.get("address"))? 
        						(this.model.get("address")[0] || {}) : (this.model.get("address") || {});
        		
        		//Use the template with the editing elements if this view has the "edit" flag on
        		if(this.edit){
        		
	        		//Send all the EMLParty info to the template
	        		this.$el.html(this.editTemplate({
	        			givenName  : fullGivenName,
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
	        			userId     : this.model.get("userId").length? this.model.get("userId")[0] : ""
	        		}));
        		}
        		
        		//If this EML Party is new/empty, then add the new class
        		if(this.isNew)
        			this.$el.addClass("new");

        		return this;
        	},
        	
        	updateModel: function(e){
        		if(!e) return false;
        		
        		//Get the attribute that was changed
        		var changedAttr = $(e.target).attr("data-attribute");
        		if(!changedAttr) return false;
        		
        		//Get the current value
        		var currentValue = this.model.get(changedAttr);
        		
        		//Is this a new EML Party?
        		if(this.isNew){

        			//Get the type of EML Party, in relation to the parent model
        			if(this.model.get("type") && this.model.get("type") != "associatedParty")
        				var type = this.model.get("type");
        			else
        				var type = "associatedParty";
        			
        			//Update the list of EMLParty models in the parent model
    				var currentModels = this.model.get("parentModel").get(type);
    				currentModels.push(this.model);
    				this.model.get("parentModel").set(type, currentModels);

        		}
        		
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
        			
        			this.trigger("change:" + changedAttr);
        		}
        		else
        			this.model.set(changedAttr, $(e.target).val());
        			
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
        	},
        	
        	updateName: function(e){
        		if(!e) return false;

        		//Get the address part that was changed
        		var changedAttr = $(e.target).attr("data-attribute");
        		if(!changedAttr) return false;
        		
        		//TODO: Allow multiple given names - right now we only support editing the first given name
        		var name = this.model.get("individualName"),
        			currentValue = name[changedAttr];
        		
        		//Update the name
        		if(Array.isArray(currentValue)){
	        		//Get the position that this new value should go in
	    			var position = this.$("[data-attribute='" + changedAttr + "']").index(e.target);
	    			
	    			//Put the new value in the array at the correct position
	    			currentValue[position] = $(e.target).val();
	    			this.model.set("individualName", name);
        		}
        		else
        			name[changedAttr] = $(e.target).val();
        		
        		this.model.trigger("change:individualName");
        	}
        });
        
        return EMLPartyView;
    });