/*global define */
define(["jquery", "underscore", "backbone"], function ($, _, Backbone) {
  "use strict";

  /**
   * @class AccessRule
   * @classdesc A model that specifies a single permission set on a DataONEObject
   * @classcategory Models
   * @extends Backbone.Model
   */
  var AccessRule = Backbone.Model.extend(
    /** @lends AccessRule */
    {
      defaults: function () {
        return {
          subject: null,
          read: null,
          write: null,
          changePermission: null,
          name: null,
          dataONEObject: null,
        };
      },

      initialize: function () {},

      /**
       * Translates the access rule XML DOM into a JSON object to be set on the model.
       * @param {Element} accessRuleXML An <allow> DOM element that contains a single access rule
       * @return {JSON} The Access Rule values to be set on this model
       */
      parse: function (accessRuleXML) {
        // If there is no access policy, do not attempt to parse anything
        if (typeof accessRuleXML === "undefined" || !accessRuleXML) {
          return {};
        }

        var accessRuleXMLObj = $(accessRuleXML);

        // Start an access rule object with the given subject
        var parsedAccessRule = {
          subject: accessRuleXMLObj.find("subject").text(),
        };

        _.each(
          accessRuleXMLObj.find("permission"),
          function (permissionNode, idx) {
            let permissionText = $(permissionNode).text().trim();

            // Check if the permission text is not empty
            if (permissionText.length) {
              // Save the parsed permission
              parsedAccessRule[permissionText] = true;
            } else {
              // This is added as a workaround for malformed permission XML
              // introduced by Chromium 120.X
              // See https://github.com/NCEAS/metacatui/issues/2235

              // Define the regular expression
              let globalPermRegex = /<permission><\/permission>(.*)/g;
              // Define the regular expression
              let permRegex = /<permission><\/permission>(.*)/;

              let accessRoleStr = accessRuleXMLObj.html();

              let matches = accessRoleStr.match(globalPermRegex);

              // Check if matches exist and have a length
              if (matches && matches.length && idx < matches.length) {
                let permMatch = matches[idx].match(permRegex);

                // Check if permMatch exists and has a length
                if (permMatch && permMatch.length) {
                  parsedAccessRule[permMatch[1]] = true;
                }
              }
            }
          },
        );

        return parsedAccessRule;
      },

      /**
       * Takes the values set on this model's attributes and creates an XML string
       * to be inserted into a DataONEObject's system metadata access policy.
       * @returns {object} The access rule XML object or null if not created
       */
      serialize: function () {
        // Serialize the allow rules
        if (
          this.get("read") ||
          this.get("write") ||
          this.get("changePermission")
        ) {
          // Create the <allow> element
          var allowElement = document.createElement("allow");

          // Create the <subject> element and set its text content
          var subjectElement = document.createElement("subject");
          subjectElement.textContent = this.get("subject");

          // Append the <subject> and <permission> elements to <allow>
          allowElement.appendChild(subjectElement);

          // Create the <permission> elements and set their text content
          var permissions = ["read", "write", "changePermission"];
          for (var i = 0; i < permissions.length; i++) {
            if (this.get(permissions[i])) {
              var permissionElement = document.createElement("permission");
              permissionElement.textContent = permissions[i];
              allowElement.appendChild(permissionElement);
            }
          }

          // Return the <allow> element
          return allowElement;
        }

        // If no access rule is created, return null
        return null;
      },

      /**
       * Gets and sets the subject info for the subjects in this access policy.
       */
      getSubjectInfo: function () {
        //If there is no subject, exit now since there is nothing to retrieve
        if (!this.get("subject")) {
          return;
        }

        //If the subject is "public", there is no subject info to retrieve
        if (this.get("subject") == "public") {
          this.set("name", "Anyone");
          return;
        }

        //If this is the current user, we can use the name we already have in the app.
        if (this.get("subject") == MetacatUI.appUserModel.get("username")) {
          if (MetacatUI.appUserModel.get("fullName")) {
            this.set("name", MetacatUI.appUserModel.get("fullName"));
            return;
          }
        }

        var model = this;

        var ajaxOptions = {
          url:
            MetacatUI.appModel.get("accountsUrl") +
            encodeURIComponent(this.get("subject")),
          type: "GET",
          dataType: "text",
          processData: false,
          parse: false,
          success: function (response) {
            //If there was no response, exit now
            if (!response) {
              return;
            }

            var xmlDoc;

            try {
              xmlDoc = $.parseXML(response);
            } catch (e) {
              //If the parsing XML failed, exit now
              console.error(
                "The accounts service did not return valid XML.",
                e,
              );
              return;
            }

            //If the XML string was not parsed correctly, exit now
            if (!XMLDocument.prototype.isPrototypeOf(xmlDoc)) {
              return;
            }

            var subjectNode;

            if (model.isGroup()) {
              //Find the subject XML node for this person, by matching the text content with the subject
              subjectNode = $(xmlDoc).find(
                "group subject:contains(" + model.get("subject") + ")",
              );
            } else {
              //Find the subject XML node for this person, by matching the text content with the subject
              subjectNode = $(xmlDoc).find(
                "person subject:contains(" + model.get("subject") + ")",
              );
            }

            //If no subject XML node was found, exit now
            if (!subjectNode || !subjectNode.length) {
              return;
            }

            //If more than one subject was found (should be very unlikely), then find the one with the exact matching subject
            if (subjectNode.length > 1) {
              _.each(subjectNode, function (subjNode) {
                if ($(subjNode).text() == model.get("subject")) {
                  subjectNode = $(subjNode);
                }
              });
            }

            var name;
            if (model.isGroup()) {
              //Get the group name
              name = $(subjectNode).siblings("groupName").text();

              //If there is no group name, then just use the name parsed from the subject
              if (!name) {
                name = model
                  .get("subject")
                  .substring(3, model.get("subject").indexOf(",DC=dataone"));
              }
            } else {
              //Get the first and last name for this person
              name =
                $(subjectNode).siblings("givenName").text() +
                " " +
                $(subjectNode).siblings("familyName").text();
            }

            //Set the name on the model
            model.set("name", name);
          },
        };

        //Send the XHR
        $.ajax(ajaxOptions);
      },

      /**
       * Returns true if the subbject set on this AccessRule is for a group of people.
       * @returns {boolean}
       */
      isGroup: function () {
        try {
          //Check if the subject is a group subject
          var matches = this.get("subject").match(/CN=.+,DC=dataone,DC=org/);
          return Array.isArray(matches) && matches.length;
        } catch (e) {
          console.error(
            "Couldn't determine if the subject in this AccessRule is a group: ",
            e,
          );
          return false;
        }
      },
    },
  );

  return AccessRule;
});
