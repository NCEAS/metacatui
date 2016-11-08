/* global define */
define(['jquery', 'underscore', 'backbone'], 
    function($, _, Backbone) {

	var EMLParty = Backbone.Model.extend({
		
		defaults: {
			originalXML: null,
			individualname: null,
			organizationname: null,
			role: null,
			address: null,
			phone: null,
			fax: null,
			electronicmailaddress: null,
			onlineUrl: null,
			references: null,
			userId: null,
			id: null
		
		},
		
		initialize: function(options){
			if(options && options.xml){
				this.set("originalXML", options.xml);
				this.parse(options.xml);
			}
		},
		
		parse: function(xml){
			if(!xml)
				var xml = this.get("originalXML");
			
			//Set the name
			var name = $(xml).children("individualname"),
				nameJSON = {};
			
			if(name.length){
				nameJSON.givenname = $(name).children("givenname").text();
				nameJSON.surname   = $(name).children("surname").text();
			}
			this.set("individualname", nameJSON);
			
			//Set the phone numbers
			var phones = $(xml).children("phone"),
				phonesJSON = [];
			
			phones.each(function(i, phone){
				phonesJSON.push({
					number: $(phone).text(),
					phonetype: $(phone).attr("phonetype")
				});
			});
			this.set("phone", phonesJSON);
			
			//Set the address
			var address = $(xml).children("address"),
				addressJSON = {},
				delPoint = $(address).find("deliverypoint"),
				city = $(address).find("city"),
				adminArea = $(address).find("administrativearea"),
				postalCode = $(address).find("postalcode"),
				country = $(address).find("country");
			
			addressJSON.deliverypoint = delPoint.length? delPoint.text() : null;
			addressJSON.city = city.length? city.text() : null;
			addressJSON.administrativearea = adminArea.length? adminArea.text() : null;
			addressJSON.postalcode = postalCode.length? postalCode.text() : null;
			addressJSON.country = country.length? country.text() : null;				
			this.set("address", addressJSON);
			
			//Set the text fields
			var textfields = ["organizationname", "positionname", "electronicmailaddress", "references"];			
			for(var i=0; i<textfields.length; i++){
				this.parseNode($(xml).children(textfields[i])[0]);
			}
			
			//Set the id attribute
			this.set("id", $(xml).attr("id"));
			
		},
		
		parseNode: function(node){
			if(!node || (Array.isArray(node) && !node.length))
				return;
			
			this.set($(node)[0].localName, $(node).text());
		},
		
		toXML: function(){
			
		}
	});
	
	return EMLParty;
});