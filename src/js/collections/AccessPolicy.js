"use strict";

define(["jquery", "underscore", "backbone", "models/AccessRule"],
    function($, _, Backbone, AccessRule) {

      /*
       * An AccessPolicy collection is a collection of AccessRules that specify
       * the permissions set on a DataONEObject
       */
      var AccessPolicy = Backbone.Collection.extend({

          model: AccessRule,

          /*
          * Parses the given access policy XML and creates AccessRule models for
          * each rule in the access policy XML. Adds these models to this collection.
          * @param {DOM Element} The <accessPolicy> XML DOM that contains a set of
          *   access rules.
          */
          parse: function(accessPolicyXML){

            //Parse each "allow" access rule
      			_.each( $(accessPolicyXML).children(), function(accessRuleXML){

              var accessRuleModel = new AccessRule();
              accessRuleModel.set( accessRuleModel.parse(accessRuleXML) );
              this.add( accessRuleModel );

      			}, this);

          },

          /*
          * Creates an access policy XML from the values set on the member
          * AccessRule models.
          * @return {string} A string of the access policy XML
          */
          serialize: function(){

            //Create the access policy node which will contain all the rules
            var xml = "<accessPolicy>\n";

            //Serialize each AccessRule member model and add to the policy DOM
            this.each(function(accessRule){
              xml += accessRule.serialize();
            });

            xml += "\n</accessPolicy>"

            //Convert the access policy DOM to a string and return it
            return xml;

          },

          /*
          * Removes access rules that grant public access and sets an access rule
          * that denies public read.
          */
          makePrivate: function(){

            //Find the public access rules and remove them
            this.each( function(accessRule){

              //If the access rule subject is `public` and they are given any kind of access,
              if( accessRule.get("subject") == "public" &&
                (accessRule.get("read") || accessRule.get("write") || accessRule.get("changePermission")) ){

                  //Remove this AccessRule model from the collection
                  this.remove(accessRule);

              }

            }, this);

            //Create an access rule that denies public read
            var publicDeny = new AccessRule({
              subject: "public",
              read: false
            });
            //Add this access rule
            this.add(publicDeny);

          },

          /*
          * Removes any AccessRule that denies public read and adds an AccessRule
          * that allows public read
          */
          makePublic: function(){

            //Find any public read deny rule and remove it
            this.each( function(accessRule){

              //If the access rule subject is `public` and they are denied read access
              if( accessRule.get("subject") == "public" && accessRule.get("read") === false ){

                  //Remove this AccessRule model from the collection
                  this.remove(accessRule);

              }

            }, this);

            //Create an access rule that allows public read
            var publicAllow = new AccessRule({
              subject: "public",
              read: true
            });
            //Add this access rule
            this.add(publicAllow);

          },

          /*
          * Returns true if this access policy specifies that it is accessible to
          * the public in any way
          * @return {boolean}
          */
          isPublic: function(){

            var isPublic = false;

            this.each(function(accessRule){

              if( accessRule.get("subject") == "public" &&
                (accessRule.get("read") || accessRule.get("write") || accessRule.get("changePermission")) )
                isPublic == true;

            });

            return isPublic;

          }

      });

      return AccessPolicy;

    });
