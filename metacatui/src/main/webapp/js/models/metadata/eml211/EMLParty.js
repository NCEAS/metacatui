/* global define */
define(['jquery', 'underscore', 'backbone', 'models/DataONEObject'], 
    function($, _, Backbone, DataONEObject) {

	var EMLParty = Backbone.Model.extend({
		
		defaults: {
			objectXML: null,
			objectDOM: null,
			individualName: {},
			organizationName: null,
			positionName: null,
			address: [],
			phone: [],
			fax: [],
			email: [],
			onlineUrl: [],
			role: null,
			references: null,
			userId: [],
			id: null,
			type: null,
			typeOptions: ["associatedParty", "contact", "creator", "metadataProvider", "publisher"],
			roleOptions: ["custodianSteward", "principalInvestigator", "collaboratingPrincipalInvestigator",
			              "coPrincipalInvestigator", "user"],
			parentModel: null
		},
		
		initialize: function(options){
			if(options && options.objectDOM) 
				this.set(this.parse(options.objectDOM));

			this.on("change:individualName change:organizationName change:positionName " +
					"change:address change:phone change:fax change:email " +
					"change:onlineUrl change:references change:userId change:role", this.trickleUpChange);
		},

		/*
         * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased EML node names (valid in EML). 
         * Used during parse() and serialize()
         */
		nodeNameMap: function(){
			return {
				"administrativearea"    : "administrativeArea",
				"deliverypoint"         : "deliveryPoint",
				"electronicmailaddress" : "electronicMailAddress",
				"givenname"             : "givenName",
				"individualname"        : "individualName",
				"metadataprovider"		: "metadataProvider",
				"onlineurl"             : "onlineUrl",
				"organizationname"      : "organizationName",
				"positionname"          : "positionName",
				"postalcode"            : "postalCode",
				"surname"               : "surName",
				"userid"                : "userId"
			}
		},
		
		parse: function(objectDOM){
			if(!objectDOM)
				var objectDOM = this.get("objectDOM");				
			
			var model = this,
				modelJSON = {};
			
			//Set the name
			var person = $(objectDOM).children("individualname");
			
			if(person.length)
				modelJSON.individualName = this.parsePerson(person);
			
			//Set the phone and fax numbers
			var phones = $(objectDOM).children("phone"),
				phoneNums = [],
				faxNums = [];
			
			phones.each(function(i, phone){
				if($(phone).attr("phonetype") == "voice")
					phoneNums.push($(phone).text());
				else if($(phone).attr("phonetype") == "facsimile")
					faxNums.push($(phone).text());
			});
			
			modelJSON.phone = phoneNums;
			modelJSON.fax   = faxNums;
			
			//Set the address
			var addresses = $(objectDOM).children("address"),
				addressesJSON = [];
			
			addresses.each(function(i, address){
				addressesJSON.push(model.parseAddress(address));
			});
				
			modelJSON.address = addressesJSON;
			
			//Set the other misc. text fields
			modelJSON.organizationName = $(objectDOM).children("organizationname").text();
			modelJSON.positionName     = $(objectDOM).children("positionname").text();
			modelJSON.email            = _.map($(objectDOM).children("electronicmailaddress"), function(email){
											return  $(email).text();
										 });
			modelJSON.role 			   = $(objectDOM).find("role").text();
			modelJSON.onlineUrl 	   = [$(objectDOM).find("onlineUrl").first().text()];
			
			//Set the id attribute
			modelJSON.id = $(objectDOM).attr("id");			
			
			return modelJSON;
		},
		
		parseNode: function(node){
			if(!node || (Array.isArray(node) && !node.length))
				return;
			
			this.set($(node)[0].localName, $(node).text());
		},
		
		parsePerson: function(personXML){
			var person = {
					givenName: [],
					surName: "",
					salutation: []
				},
				givenName  = $(personXML).find("givenname"),
				surName     = $(personXML).find("surname"),
				salutations = $(personXML).find("salutation");
			
			givenName.each(function(i, name){
				person.givenName.push($(name).text());
			});
			
			person.surName = surName.text();
			
			salutations.each(function(i, name){
				person.salutation.push($(name).text());
			});
			
			return person;
		},
		
		parseAddress: function(addressXML){
			var address    = {},
				delPoint   = $(addressXML).find("deliverypoint"),
				city       = $(addressXML).find("city"),
				adminArea  = $(addressXML).find("administrativearea"),
				postalCode = $(addressXML).find("postalcode"),
				country    = $(addressXML).find("country");
		
			address.city               = city.length? city.text() : "";
			address.administrativeArea = adminArea.length? adminArea.text() : "";
			address.postalCode         = postalCode.length? postalCode.text() : "";
			address.country            = country.length? country.text() : "";	
			
			//Get an array of all the address line (or delivery point) values
			var addressLines = [];
			_.each(delPoint, function(addressLine, i){
				addressLines.push($(addressLine).text());
			}, this);
			
			address.deliveryPoint = addressLines;
			
			return  address;
		},
		
		serialize: function(){
			var objectDOM = this.updateDOM(),
				xmlString = objectDOM.outerHTML;
		
			//Camel-case the XML
	    	xmlString = this.formatXML(xmlString);
	    	
	    	return xmlString;
		},
		
		/*
		 * Updates the attributes on this model based on the application user (the app UserModel)
		 */
		createFromUser: function(){
			//Create the name from the user
			var name = this.get("individualName") || {};
			name.givenName = [MetacatUI.appUserModel.get("firstName")];
			name.surName    = MetacatUI.appUserModel.get("lastName");
			this.set("individualName", name);
			
			//Get the email and username
			this.set("email", MetacatUI.appUserModel.get("email"));			
			this.set("userId", MetacatUI.appUserModel.get("username"));
		},
		
		/*
		 * Makes a copy of the original XML DOM and updates it with the new values from the model.
		 */
		updateDOM: function(){
			 var type = this.get("type") || "associatedParty", 
			 	 objectDOM = this.get("objectDOM")? this.get("objectDOM").cloneNode(true) : document.createElement(type);
			 				
			 //There needs to be at least one individual name, organization name, or position name
			 if(!this.get("individualName") && !this.get("organizationName") && !this.get("positionName"))
				 return "";
			 
			var name = this.get("individualName");
			if(name){
				//Get the individualName node
				var nameNode = $(objectDOM).find("individualname");
				if(!nameNode.length){
					nameNode = document.createElement("individualname");
					$(objectDOM).prepend(nameNode);
				}
				
				//Empty the individualName node
				$(nameNode).empty();
				
				 // salutation[s]
				 _.each(name.salutation, function(salutation) {
					 $(nameNode).append("<salutation>" + salutation + "</salutation>");
				 });
				 
				 //Given name
				 _.each(name.givenName, function(givenName) {
					 $(nameNode).prepend("<givenname>" + givenName + "</givenname>");
				 });
				 
				 // surname
				 $(nameNode).append("<surname>" +  name.surName + "</surname>");
			} 
			 
			 // positionName
			if(this.get("positionName")){
				if($(objectDOM).find("positionname").length)
					$(objectDOM).find("positionname").text(this.get("positionname"));
				else
					$(objectDOM).find("individualName").after( $(document.createElement("positionname")).text(this.get("positionName")) );
			} 
			
			 // organizationName
			if(this.get("organizationName")){
				if($(objectDOM).find("organizationname").length)
					$(objectDOM).find("organizationname").text(this.get("organizationName"));
				else
					$(objectDOM).find("organizationname").after( $(document.createElement("organizationname")).text(this.get("organizationName")) );
			} 
			 
			 // address
			 _.each(this.get("address"), function(address, i) {
				 
				 var addressNode =  $(objectDOM).find("address")[i];
				 
				 if(!addressNode){
					 addressNode = document.createElement("address");
					 $(objectDOM).append(addressNode);
				 }
				 
				 _.each(address.deliveryPoint, function(deliveryPoint, ii){
					 if(!deliveryPoint) return;
					 
					 var delPointNode = $(addressNode).find("deliverypoint")[ii];
					 
					 if(!delPointNode){
						 delPointNode = document.createElement("deliverypoint");
						 $(addressNode).append(delPointNode);
					 }
					 
					 $(delPointNode).text(deliveryPoint);					 
				 });
				 
				 if(address.city){
					 var cityNode = $(addressNode).find("city");
					 
					 if(!cityNode.length){
						 cityNode = document.createElement("city");
						 $(addressNode).append(cityNode);
					 }
					 
					 $(cityNode).text(address.city);
				 }
				 
				 if(address.administrativeArea){
					 var adminAreaNode = $(addressNode).find("administrativearea");
					 
					 if(!adminAreaNode.length){
						 adminAreaNode = document.createElement("administrativearea");
						 $(addressNode).append(adminAreaNode);
					 }

					 $(adminAreaNode).text(address.administrativeArea);
				 }
				 
				 if(address.postalCode){
					 var postalcodeNode = $(addressNode).find("postalcode");
					 
					 if(!postalcodeNode.length){
						 postalcodeNode = document.createElement("postalcode");
						 $(addressNode).append(postalcodeNode);
					 }
					 
					 $(postalcodeNode).text(address.postalCode);
				 }
				 
				 if(address.country){
					 var countryNode = $(addressNode).find("country");
					 
					 if(!countryNode.length){
						 countryNode = document.createElement("country");
						 $(addressNode).append(countryNode);
					 }
					 
					 $(countryNode).text(address.country);
				 }
				 
			 }, this);
			 
			 // phone[s]
			 _.each(this.get("phone"), function(phone) {
				 var phoneNode = $(objectDOM).find("phone[phonetype='voice']");
				 
				 if(!phoneNode){
					 phoneNode = $(document.createElement("phone")).attr("phonetype", "voice");
					 $(objectDOM).append(phoneNode);
				 }
				 
				 $(phoneNode).text(phone);				 
			 });
			 
			 // fax[es]
			 _.each(this.get("fax"), function(fax) {
				 var faxNode = $(objectDOM).find("phone[phonetype='facsimile']");
				 
				 if(!faxNode){
					 faxNode = $(document.createElement("phone")).attr("phonetype", "facsimile");
					 $(objectDOM).append(faxNode);
				 }
				 
				 $(faxNode).text(fax);	
			 });
			 
			 // electronicMailAddress[es]
			 _.each(this.get("email"), function(email) {
				 var emailNode = $(objectDOM).find("electronicmailaddress");
				 
				 if(!emailNode){
					 emailNode = document.createElement("electronicmailaddress");
					 $(objectDOM).append(emailNode);
				 }
				 
				 $(emailNode).text(email);
				 
			 });
			 
			// online URL[es]
			 _.each(this.get("onlineUrl"), function(onlineUrl) {
				 var urlNode = $(objectDOM).find("onlineurl");
				 
				 if(!urlNode){
					 urlNode = document.createElement("onlineurl");
					 $(objectDOM).append(urlNode);
				 }
				 
				 $(urlNode).text(onlineUrl);
				 
			 });
			 
			 //user ID
			 _.each(this.get("userId"), function(userId) {
				 var idNode = $(objectDOM).find("userid");
				 
				 if(!idNode){
					 idNode = document.createElement("userid");
					 $(objectDOM).append(idNode);
				 }
				 
				 $(idNode).text(userId);
				 
			 });
			 
			// role
			if(this.get("role")){
				if($(objectDOM).find("role").length)
					$(objectDOM).find("role").text(this.get("role"));
				else
					$(objectDOM).append( $(document.createElement("role")).text(this.get("role")) );
			} 
			 
			 return objectDOM;
		},
		
		trickleUpChange: function(){
			this.get("parentModel").trigger("change");
		},
		
		formatXML: function(xmlString){
			return DataONEObject.prototype.formatXML.call(this, xmlString);
		}
	});
	
	return EMLParty;
});