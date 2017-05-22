/* global define */
define(['jquery', 'underscore', 'backbone', 'models/DataONEObject'], 
    function($, _, Backbone, DataONEObject) {

	var EMLParty = Backbone.Model.extend({
		
		defaults: function(){
			return {
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
				role: null,
				references: null,
				userId: [],
				xmlID: null,
				type: null,
				typeOptions: ["associatedParty", "contact", "creator", "metadataProvider", "publisher"],
				roleOptions: ["custodianSteward", "principalInvestigator", "collaboratingPrincipalInvestigator",
				              "coPrincipalInvestigator", "user"],
				parentModel: null
			}
		},
		
		initialize: function(options){
			if(options && options.objectDOM) 
				this.set(this.parse(options.objectDOM));
			
			if(!this.get("xmlID"))
				this.createID();
			
			this.on("change:individualName change:organizationName change:positionName " +
					"change:address change:phone change:fax change:email " +
					"change:onlineUrl change:references change:userId change:role", this.trickleUpChange);
			
			this.on("change:role", this.setType);
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
			var addresses = $(objectDOM).children("address") || [],
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
			modelJSON.onlineUrl 	   = [$(objectDOM).find("onlineurl").first().text()];
			modelJSON.userId 	       = [$(objectDOM).find("userid").first().text()];
						
			//Set the id attribute
			modelJSON.xmlID = $(objectDOM).attr("id");			
			
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
			
			//Concatenate all the given names into one, for now
			//TODO: Support multiple given names
			givenName.each(function(i, name){
				if(i==0)
					person.givenName[0] = "";
				
				person.givenName[0] += $(name).text() + " ";
				
				if(i==givenName.length-1)
					person.givenName[0] = person.givenName[0].trim();
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
			name.givenName  = [MetacatUI.appUserModel.get("firstName")];
			name.surName    = MetacatUI.appUserModel.get("lastName");
			this.set("individualName", name);
			
			//Get the email and username
			this.set("email", [MetacatUI.appUserModel.get("email")]);
			this.set("userId", [MetacatUI.appUserModel.get("username")]);
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
				 if(!Array.isArray(name.salutation) && name.salutation) name.salutation = [name.salutation];
				 _.each(name.salutation, function(salutation) {
					 $(nameNode).append("<salutation>" + salutation + "</salutation>");
				 });
				 
				 //Given name
				 if(!Array.isArray(name.givenName) && name.givenName) name.givenName = [name.givenName];				 
				 _.each(name.givenName, function(givenName) {
					 $(nameNode).prepend("<givenname>" + givenName + "</givenname>");
				 });
				 
				 // surname
				 if(name.surName)
					 $(nameNode).append("<surname>" +  name.surName + "</surname>");
			}
			
			 // organizationName
			if(this.get("organizationName")){
				//Get the organization name node
				if($(objectDOM).find("organizationname").length)
					var orgNameNode = $(objectDOM).find("organizationname").detach();
				else
					var orgNameNode = document.createElement("organizationname");
					
				//Insert the text
				$(orgNameNode).text(this.get("organizationName"));
					
				//If the DOM is empty, append it
				if( !$(objectDOM).children().length )
					$(objectDOM).append(orgNameNode);
				else{
					var insertAfter = this.getEMLPosition(objectDOM, "organizationname");
					
					if(insertAfter && insertAfter.length)
						insertAfter.after(orgNameNode);
					else
						$(objectDOM).prepend(orgNameNode);
				}
			}
			//Remove the organization name node if there is no organization name
			else{
				var orgNameNode = $(objectDOM).find("organizationname");
				if(orgNameNode.length)
					orgNameNode.remove();
			}
			 
			 // positionName
			if(this.get("positionName")){
				//Get the name node
				if($(objectDOM).find("positionname").length)
					var posNameNode = $(objectDOM).find("positionname").detach();
				else
					var posNameNode = document.createElement("positionname");
					
				//Insert the text
				$(posNameNode).text(this.get("positionName"));
				
				//If the DOM is empty, append it
				if( !$(objectDOM).children().length )
					$(objectDOM).append(posNameNode);
				else
					this.getEMLPosition(objectDOM, "positionname").after(posNameNode);
			} 
			 
			 // address
			 _.each(this.get("address"), function(address, i) {
				 
				 var addressNode =  $(objectDOM).find("address")[i];
				 
				 if(!addressNode){
					 addressNode = document.createElement("address");
					 this.getEMLPosition(objectDOM, "address").after(addressNode);
				 }
				 
				 _.each(address.deliveryPoint, function(deliveryPoint, ii){
					 if(!deliveryPoint) return;
					 
					 var delPointNode = $(addressNode).find("deliverypoint")[ii];
					 
					 if(!delPointNode){
						 delPointNode = document.createElement("deliverypoint");
						 
						 //Add the deliveryPoint node to the address node
						 //Insert after the last deliveryPoint node
						 var appendAfter = $(addressNode).find("deliverypoint")[ii-1];
						 if(appendAfter)
							 $(appendAfter).after(delPointNode);
						 //Or just prepend to the beginning
						 else
							 $(addressNode).prepend(delPointNode);
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
				 
				 if(!phoneNode.length){
					 phoneNode = $(document.createElement("phone")).attr("phonetype", "voice");
					 this.getEMLPosition(objectDOM, "phone").after(phoneNode);
				 }
				 
				 $(phoneNode).text(phone);				 
			 }, this);
			 
			 // fax[es]
			 _.each(this.get("fax"), function(fax) {
				 var faxNode = $(objectDOM).find("phone[phonetype='facsimile']");
				 
				 if(!faxNode.length){
					 faxNode = $(document.createElement("phone")).attr("phonetype", "facsimile");
					 this.getEMLPosition(objectDOM, "phone").after(faxNode);
				 }
				 
				 $(faxNode).text(fax);	
			 }, this);
			 
			 // electronicMailAddress[es]
			 _.each(this.get("email"), function(email) {
				 var emailNode = $(objectDOM).find("electronicmailaddress");
				 
				 if(!emailNode.length){
					 emailNode = document.createElement("electronicmailaddress");
					 this.getEMLPosition(objectDOM, "electronicmailaddress").after(emailNode);
				 }
				 
				 $(emailNode).text(email);
				 
			 }, this);
			 
			// online URL[es]
			 _.each(this.get("onlineUrl"), function(onlineUrl, i) {
				 var urlNode = $(objectDOM).find("onlineurl")[i];
				 
				 //If there is a XML node but no value, remove the node
				 if(urlNode && !onlineUrl){
					 urlNode.remove();
					 return;
				 }
				 else if(!onlineUrl)
					 return;
				 
				 if(!urlNode){
					 urlNode = document.createElement("onlineurl");
					 this.getEMLPosition(objectDOM, "onlineurl").after(urlNode);
				 }
				 
				 $(urlNode).text(onlineUrl);
				 
			 }, this);
			 
			 //user ID
			 var userId = Array.isArray(this.get("userId")) ? this.get("userId") : [this.get("userId")];
			 _.each(userId, function(id) {
				 if(!id) return; 
				 
				 var idNode = $(objectDOM).find("userid");
				 
				 //Create the userid node
				 if(!idNode.length){
					 
					 idNode = $(document.createElement("userid"));
					 
					 this.getEMLPosition(objectDOM, "userid").after(idNode);
				 }
				 
				 //If this is an orcid identifier, format it with the orcid.org prefix and add the directory attribute
				 if(this.isOrcid(id)){
					 if(id.length == 19)
						 id = "http://orcid.org/" + id;
					 
					 idNode.attr("directory", "https://orcid.org");
				 }
				 else{
					 idNode.attr("directory", "unknown"); 
				 }
				 
				 $(idNode).text(id);
				 
			 }, this);
			 
			// role
			if(this.get("role")){
				if($(objectDOM).find("role").length)
					$(objectDOM).find("role").text(this.get("role"));
				else
					this.getEMLPosition(objectDOM, "role").after( $(document.createElement("role")).text(this.get("role")) );
			} 
						
			//XML id attribute
			this.createID();
			//if(this.get("xmlID"))
				$(objectDOM).attr("id", this.get("xmlID"));
			//else
			//	$(objectDOM).removeAttr("id");
			
			// Remove empty (zero-length or whitespace-only) nodes
			$(objectDOM).find("*").filter(function() { return $.trim(this.innerHTML) === ""; } ).remove();

			 return objectDOM;
		},
		
    	mergeIntoParent: function(){
    		//Get the type of EML Party, in relation to the parent model
			if(this.get("type") && this.get("type") != "associatedParty")
				var type = this.get("type");
			else
				var type = "associatedParty";
			
			//Update the list of EMLParty models in the parent model
			var currentModels = this.get("parentModel").get(type);
			currentModels.push(this);
			this.get("parentModel").set(type, currentModels);
			this.get("parentModel").trigger("change");
			
			//Trigger a custom event that marks the model as valid
			this.trigger("valid");
    	},
		
		/*
         * Returns the node in the given EML snippet that the given node type should be inserted after
         */
        getEMLPosition: function(objectDOM, nodeName){
        	var nodeOrder = [ "individualname", "organizationname", "positionname", "address", "phone",
        	                  "electronicmailaddress", "onlineurl", "userid", "role"];
        	
        	var position = _.indexOf(nodeOrder, nodeName);
        	if(position == -1)
        		return $(objectDOM).children().last();
        	
        	//Go through each node in the node list and find the position where this node will be inserted after
        	for(var i=position-1; i>=0; i--){
        		if($(objectDOM).find(nodeOrder[i]).length)
        			return $(objectDOM).find(nodeOrder[i]).last();
        	}
        	
        	
        	return false;
        },
		
		createID: function(){
			this.set("xmlID", Math.ceil(Math.random() * (9999999999999999 - 1000000000000000) + 1000000000000000));
		},
		
		setType: function(){
			if(this.get("role") && !this.get("type"))
				this.set("type", "associatedParty");
		},
		
		trickleUpChange: function(){
            if ( this.get("parentModel") ) {
    			MetacatUI.rootDataPackage.packageModel.set("changed", true);                
            }
		},
				
		/*
		 * Checks the values of the model to determine if it is EML-valid
		 */
		isValid: function(){
			//The EMLParty must have either an organization name, position name, or surname. It must ALSO have a type or role.
			return ((this.get("organizationName") || 
					this.get("positionName") || 
					(this.get("individualName") && this.get("individualName").surName)))// &&
					//((this.get("type") == "associatedParty" && this.get("role")) || this.get("type")) );
		},
		
		isOrcid: function(username){
			if(!username) return false;
			
			//Checks for ORCIDs using the orcid base URL as a prefix
			if((username.indexOf("http://orcid.org") == 0) && username.length == 36){
				return true;
			}
								
			/* The ORCID checksum algorithm to determine is a character string is an ORCiD 
			 * http://support.orcid.org/knowledgebase/articles/116780-structure-of-the-orcid-identifier
			 */	
			var total = 0,
				baseDigits = username.replace(/-/g, "").substr(0, 15);
			
			for(var i=0; i<baseDigits.length; i++){
				var digit = parseInt(baseDigits.charAt(i));
				total = (total + digit) * 2;
			}
			
			var remainder = total % 11,
				result = (12 - remainder) % 11,
				checkDigit = (result == 10) ? "X" : result.toString(),
				isOrcid = (checkDigit == username.charAt(username.length-1));
			
			return isOrcid;
		},
		
		formatXML: function(xmlString){
			return DataONEObject.prototype.formatXML.call(this, xmlString);
		}
	});
	
	return EMLParty;
});