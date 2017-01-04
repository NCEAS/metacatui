/* global define */
define(['jquery', 'underscore', 'backbone'], 
    function($, _, Backbone) {

	var EMLParty = Backbone.Model.extend({
		
		defaults: {
			originalXML: null,
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
		
		initialize: function(options){
			if(options && options.xml){
				this.set("originalXML", options.xml);
				this.parse(options.xml);
			}
		},
		
		nodeNameMap: {
			"administrativearea"    : "administrativeArea",
			"deliverypoint"         : "deliveryPoint",
			"electronicmailaddress" : "electronicMailAddress",
			"givenname"             : "givenName",
			"individualname"        : "individualName",
			"onlineurl"             : "onlineUrl",
			"organizationname"      : "organizationName",
			"positionname"          : "positionName",
			"postalcode"            : "postalCode",
			"surname"               : "surName",
			"userid"                : "userId",
		},
		
		parse: function(xml){
			if(!xml)
				var xml = this.get("originalXML");
			
			var model = this;
			
			//Set the name
			var person = $(xml).children("individualName");
			
			if(person.length)
				this.set("individualName", this.parsePerson(person));
			
			//Set the phone and fax numbers
			var phones = $(xml).children("phone"),
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
			var addresses = $(xml).children("address"),
				addressesJSON = [];
			
			addresses.each(function(i, address){
				addressesJSON.push(model.parseAddress(address));
			});
				
			this.set("address", addressesJSON);
			
			//Set the other misc. text fields
			this.set("organizationName", $(xml).children("organizationname").text());
			this.set("positionName", $(xml).children("positionname").text());
			this.set("email", _.map($(xml).children("electronicmailaddress"), function(email){
				return  $(email).text();
			}));
			
			//Set the id attribute
			this.set("id", $(xml).attr("id"));
			
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
				person.salutation.push(name.text());
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
		
		toXML: function(){
			
		}
	});
	
	return EMLParty;
});