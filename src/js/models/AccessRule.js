/*global define */
define(['jquery', 'underscore', 'backbone'],
	function($, _, Backbone) {
	'use strict';

	// Access Rule Model
	// ------------------
	var AccessRule = Backbone.Model.extend({

		defaults: {
			subject: null,
			read: null,
			write: null,
			changePermission: null,
      dataONEObject: null
		},

		initialize: function(){

		},

		/*
		* Translates the access rule XML DOM into a JSON object to be set on the model.
		* @param {DOM Element} Either an <allow> or <deny> DOM element that contains a single access rule
		* @return {JSON} The Access Rule values to be set on this model
		*/
		parse: function( accessRuleXML ){
			//If there is no access policy, do not attempt to parse anything
			if( typeof accessRuleXML == "undefined" || !accessRuleXML)
				return {};

			accessRuleXML = $(accessRuleXML);

			var allowOrDeny = accessRuleXML.prop("tagName").toLowerCase();

			//Start an access rule object with the given subject
			var parsedAccessRule = {
						subject: accessRuleXML.find("subject").text()
				  }

			_.each( accessRuleXML.find("permission"), function( permissionNode ){
				parsedAccessRule[ $(permissionNode).text() ] = ( allowOrDeny == "allow" ? true : false );
			});

			return parsedAccessRule;

		},

		/*
		* Takes the values set on this model's attributes and creates an XML string
		* to be inserted into a DataONEObject's system metadata access policy.
		* @return {string} The access rule XML string
		*/
		serialize: function(){

				var xml = "";

				//Serialize the allow rules
				if( this.get("read") || this.get("write") || this.get("changePermission") ){

					//Start the "allow" node
					xml += '\t<allow>\n';

					//Add the subject
					xml += '\t\t<subject>' + this.get("subject") + '</subject>\n';

					//Add the read permission
					if( this.get("read") ){
						xml += '\t\t<permission>read</permission>\n';
					}

					//Add the write permission
					if( this.get("write") ){
						xml += '\t\t<permission>write</permission>\n';
					}

					//Add the changePermission permission
					if( this.get("changePermission") ){
						xml += '\t\t<permission>changePermission</permission>\n';
					}

					//Close the "allow" node
					xml += '\t</allow>\n';

				}

				//Serialize the deny rules
				if( this.get("read") === false || this.get("write") === false || this.get("changePermission") === false ){

					//Start the "deny" node
					xml += '\t<deny>\n';

					//Add the subject
					xml += '\t\t<subject>' + this.get("subject") + '</subject>\n';

					//Add the read permission
					if( this.get("read") === false ){
						xml += '\t\t<permission>read</permission>\n';
					}

					//Add the write permission
					if( this.get("write") === false ){
						xml += '\t\t<permission>write</permission>\n';
					}

					//Add the changePermission permission
					if( this.get("changePermission") === false ){
						xml += '\t\t<permission>changePermission</permission>\n';
					}

					//Close the "deny" node
					xml += '\t</deny>\n';

				}

			return xml;

		}

	});

	return AccessRule;

});
