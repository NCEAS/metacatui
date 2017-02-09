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
        	
        	render: function(){
        		
        		//When the model changes, render again
        		this.listenTo(this.model, "change", this.render);

        		//Format the given names
        		var name = this.model.get("individualName"),
        			fullGivenName = "";
        		
        		_.each(name.givenName, function(givenName){
        			fullGivenName += givenName + " ";
        		});
        		
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
        	}
        	
        	
        });
        
        return EMLPartyView;
    });