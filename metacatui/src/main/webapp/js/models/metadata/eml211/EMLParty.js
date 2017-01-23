/* global define */
define(['jquery', 'underscore', 'backbone', 'models/DataONEObject'], 
    function($, _, Backbone, DataONEObject) {

	var EMLParty = Backbone.Model.extend({
		
		defaults: {
			objectXML: null,
			objectDOM: null,
			individualName: null,
			organizationName: null,
			positionName: null,
			address: [],
			phone: [],
			fax: [],
			email: [],
			onlineUrl: [],
			references: null,
			userId: [],
			id: null		
		},
		
		initialize: function(attributes){
			if(attributes.objectDOM) this.parse(attributes.objectDOM);
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
			
			var model = this;
			
			//Set the name
			var person = $(objectDOM).children("individualName");
			
			if(person.length)
				this.set("individualName", this.parsePerson(person));
			
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
			
			this.set("phone", phoneNums);
			this.set("fax", faxNums);
			
			//Set the address
			var addresses = $(objectDOM).children("address"),
				addressesJSON = [];
			
			addresses.each(function(i, address){
				addressesJSON.push(model.parseAddress(address));
			});
				
			this.set("address", addressesJSON);
			
			//Set the other misc. text fields
			this.set("organizationName", $(objectDOM).children("organizationname").text());
			this.set("positionName", $(objectDOM).children("positionname").text());
			this.set("email", _.map($(objectDOM).children("electronicmailaddress"), function(email){
				return  $(email).text();
			}));
			
			//Set the id attribute
			this.set("id", $(objectDOM).attr("id"));
			
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
				givenNames  = $(personXML).find("givenName"),
				surName     = $(personXML).find("surName"),
				salutations = $(personXML).find("salutation");
			
			givenNames.each(function(i, name){
				person.givenName.push($(name).text());
			});
			
			person.surName = surName.text();
			
			salutations.each(function(i, name){
				person.salutation.push($(name).text());
			});
			
			return person;
		},
		
		serializePerson: function(personJSON){
			
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
			_.each(delPoint, function(i, addressLine){
				addressLines.push($(addressLine).text());
			}, this);
			
			address.deliveryPoint = addressLines;
			
			return  address;
		},
		
		serializeAddress: function(addressJSON){
			
		},
		
		serialize: function(){
			var objectDOM = this.updateDOM(),
				xmlString = objectDOM.outerHTML;
		
			//Camel-case the XML
	    	xmlString = this.formatXML(xmlString);
	    	
	    	return xmlString;
		},
		
		/*
		 * Makes a copy of the original XML DOM and updates it with the new values from the model.
		 */
		updateDOM: function(){
			 var objectDOM = this.get("objectDOM").cloneNode(true);
			 
			 // salutation[s]
			 $(objectDOM).find("individualName").find("salutation").remove();
			 _.each(this.get("individualName").salutation, function(salutation) {
				 $(objectDOM).find("individualName").append("<salutation>" + salutation + "</salutation>");
			 });
			 // given name[s]
			 $(objectDOM).find("individualName").find("givenName").remove();
			 _.each(this.get("individualName").givenName, function(givenName) {
				 $(objectDOM).find("individualName").append("<givenName>" + givenName + "</givenName>");
			 });
			 // surname
			 $(objectDOM).find("individualName").find("surName").text(this.get("individualName").surName);
			 
			 // positionName
			 $(objectDOM).find("positionName").text(this.get("positionName"));
			 
			 // organizationName
			 $(objectDOM).find("organizationName").text(this.get("organizationName"));
			 
			 // address
			$(objectDOM).find("address").find("deliveryPoint").remove();
			 _.each(this.get("address").deliveryPoint, function(deliveryPoint) {
				 $(objectDOM).find("address").append("<deliveryPoint>" + deliveryPoint + "</deliveryPoint>");
			 });
			 $(objectDOM).find("address").find("city").text(this.get("address").city);
			 $(objectDOM).find("address").find("administrativeArea").text(this.get("address").administrativeArea);
			 $(objectDOM).find("address").find("postalCode").text(this.get("address").postalCode);
			 $(objectDOM).find("address").find("country").text(this.get("address").country);			 
			 
			 // phone[s]
			 $(objectDOM).find("phone").remove();
			 _.each(this.get("phone"), function(phone) {
				 $(objectDOM).append("<phone phonetype='voice'>" + phone + "</phone>");
			 });
			 // fax[es]
			 _.each(this.get("fax"), function(phone) {
				 $(objectDOM).append("<phone phonetype='facsimile'>" + phone + "</phone>");
			 });
			 
			 // electronicMailAddress[es]
			 $(objectDOM).find("electronicMailAddress").remove();
			 _.each(this.get("electronicMailAddress"), function(electronicMailAddress) {
				 $(objectDOM).append("<electronicMailAddress>" + electronicMailAddress + "</electronicMailAddress>");
			 });
			 
			 // onlineUrl[s]
			 $(objectDOM).find("onlineUrl").remove();
			 _.each(this.get("onlineUrl"), function(onlineUrl) {
				 $(objectDOM).append("<onlineUrl>" + onlineUrl + "</onlineUrl>");
			 });
			 
			 // userId[s]
			 $(objectDOM).find("userId").remove();
			 _.each(this.get("userId"), function(userId) {
				 $(objectDOM).append("<userId>" + userId + "</userId>");
			 });
			 
			 return objectDOM;
		},
		
		formatXML: function(xmlString){
			return DataONEObject.prototype.formatXML.call(this, xmlString);
		}
	});
	
	return EMLParty;
});