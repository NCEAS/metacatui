define([
  "jquery",
  "underscore",
  "backbone",
  "models/DataONEObject",
  "common/EMLUtilities",
], ($, _, Backbone, DataONEObject, EMLUtilities) => {
  /**
   * @class EMLParty
   * @classcategory Models/Metadata/EML211
   * @classdesc EMLParty represents a single Party from the EML 2.1.1 and 2.2.0
   * metadata schema. This can be a person or organization.
   * @see https://eml.ecoinformatics.org/schema/eml-party_xsd.html#ResponsibleParty
   * @extends Backbone.Model
   * @constructor
   */
  const EMLParty = Backbone.Model.extend(
    /** @lends EMLParty.prototype */ {
      defaults: function () {
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
          roles: [],
          references: null,
          userId: [],
          xmlID: null,
          type: null,
          typeOptions: [
            "associatedParty",
            "contact",
            "creator",
            "metadataProvider",
            "publisher",
          ],
          roleOptions: [
            "custodianSteward",
            "principalInvestigator",
            "collaboratingPrincipalInvestigator",
            "coPrincipalInvestigator",
            "user",
          ],
          parentModel: null,
          removed: false, //Indicates whether this model has been removed from the parent model
        };
      },

      initialize: function (options) {
        if (options && options.objectDOM)
          this.set(this.parse(options.objectDOM));

        if (!this.get("xmlID")) this.createID();
        this.on("change:roles", this.setType);
      },

      /*
       * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased EML node names (valid in EML).
       * Used during parse() and serialize()
       */
      nodeNameMap: function () {
        return {
          administrativearea: "administrativeArea",
          associatedparty: "associatedParty",
          deliverypoint: "deliveryPoint",
          electronicmailaddress: "electronicMailAddress",
          givenname: "givenName",
          individualname: "individualName",
          metadataprovider: "metadataProvider",
          onlineurl: "onlineUrl",
          organizationname: "organizationName",
          positionname: "positionName",
          postalcode: "postalCode",
          surname: "surName",
          userid: "userId",
        };
      },

      /*
            Parse the object DOM to create the model
            @param objectDOM the XML DOM to parse
            @return modelJSON the resulting model attributes object
         */
      parse: function (objectDOM) {
        if (!objectDOM) var objectDOM = this.get("objectDOM");

        var model = this,
          modelJSON = {};

        //Set the name
        var person = $(objectDOM).children("individualname, individualName");

        if (person.length) modelJSON.individualName = this.parsePerson(person);

        //Set the phone and fax numbers
        var phones = $(objectDOM).children("phone"),
          phoneNums = [],
          faxNums = [];

        phones.each(function (i, phone) {
          if ($(phone).attr("phonetype") == "voice")
            phoneNums.push($(phone).text());
          else if ($(phone).attr("phonetype") == "facsimile")
            faxNums.push($(phone).text());
        });

        modelJSON.phone = phoneNums;
        modelJSON.fax = faxNums;

        //Set the address
        var addresses = $(objectDOM).children("address") || [],
          addressesJSON = [];

        addresses.each(function (i, address) {
          addressesJSON.push(model.parseAddress(address));
        });

        modelJSON.address = addressesJSON;

        //Set the text fields
        modelJSON.organizationName =
          $(objectDOM).children("organizationname, organizationName").text() ||
          null;
        modelJSON.positionName =
          $(objectDOM).children("positionname, positionName").text() || null;
        // roles
        modelJSON.roles = [];
        $(objectDOM)
          .find("role")
          .each(function (i, role) {
            modelJSON.roles.push($(role).text());
          });

        //Set the id attribute
        modelJSON.xmlID = $(objectDOM).attr("id");

        //Email - only set it on the JSON if it exists (we want to avoid an empty string value in the array)
        if (
          $(objectDOM).children("electronicmailaddress, electronicMailAddress")
            .length
        ) {
          modelJSON.email = _.map(
            $(objectDOM).children(
              "electronicmailaddress, electronicMailAddress",
            ),
            function (email) {
              return $(email).text();
            },
          );
        }

        //Online URL - only set it on the JSON if it exists (we want to avoid an empty string value in the array)
        if ($(objectDOM).find("onlineurl, onlineUrl").length) {
          // modelJSON.onlineUrl = [$(objectDOM).find("onlineurl, onlineUrl").first().text()];
          modelJSON.onlineUrl = $(objectDOM)
            .find("onlineurl, onlineUrl")
            .map(function (i, v) {
              return $(v).text();
            })
            .get();
        }

        //User ID - only set it on the JSON if it exists (we want to avoid an empty string value in the array)
        if ($(objectDOM).find("userid, userId").length) {
          modelJSON.userId = [
            $(objectDOM).find("userid, userId").first().text(),
          ];
        }

        return modelJSON;
      },

      parseNode: function (node) {
        if (!node || (Array.isArray(node) && !node.length)) return;

        this.set($(node)[0].localName, $(node).text());
      },

      parsePerson: function (personXML) {
        var person = {
            givenName: [],
            surName: "",
            salutation: [],
          },
          givenName = $(personXML).find("givenname, givenName"),
          surName = $(personXML).find("surname, surName"),
          salutations = $(personXML).find("salutation");

        //Concatenate all the given names into one, for now
        //TODO: Support multiple given names
        givenName.each(function (i, name) {
          if (i == 0) person.givenName[0] = "";

          person.givenName[0] += $(name).text() + " ";

          if (i == givenName.length - 1)
            person.givenName[0] = person.givenName[0].trim();
        });

        person.surName = surName.text();

        salutations.each(function (i, name) {
          person.salutation.push($(name).text());
        });

        return person;
      },

      parseAddress: function (addressXML) {
        var address = {},
          delPoint = $(addressXML).find("deliverypoint, deliveryPoint"),
          city = $(addressXML).find("city"),
          adminArea = $(addressXML).find(
            "administrativearea, administrativeArea",
          ),
          postalCode = $(addressXML).find("postalcode, postalCode"),
          country = $(addressXML).find("country");

        address.city = city.length ? city.text() : "";
        address.administrativeArea = adminArea.length ? adminArea.text() : "";
        address.postalCode = postalCode.length ? postalCode.text() : "";
        address.country = country.length ? country.text() : "";

        //Get an array of all the address line (or delivery point) values
        var addressLines = [];
        _.each(
          delPoint,
          function (addressLine, i) {
            addressLines.push($(addressLine).text());
          },
          this,
        );

        address.deliveryPoint = addressLines;

        return address;
      },

      serialize: function () {
        var objectDOM = this.updateDOM(),
          xmlString = objectDOM.outerHTML;

        //Camel-case the XML
        xmlString = this.formatXML(xmlString);

        return xmlString;
      },

      /*
       * Updates the attributes on this model based on the application user (the app UserModel)
       */
      createFromUser: function () {
        //Create the name from the user
        var name = this.get("individualName") || {};
        name.givenName = [MetacatUI.appUserModel.get("firstName")];
        name.surName = MetacatUI.appUserModel.get("lastName");
        this.set("individualName", name);

        //Get the email and username
        if (MetacatUI.appUserModel.get("email"))
          this.set("email", [MetacatUI.appUserModel.get("email")]);

        this.set("userId", [MetacatUI.appUserModel.get("username")]);
      },

      /*
       * Makes a copy of the original XML DOM and updates it with the new values from the model.
       */
      updateDOM: function () {
        var type = this.get("type") || "associatedParty",
          objectDOM = this.get("objectDOM");

        // If there is already an XML node for this model and it is the wrong type,
        //   then replace the XML node contents
        if (objectDOM && objectDOM.nodeName != type.toUpperCase()) {
          objectDOM = $(document.createElement(type)).html(objectDOM.innerHTML);
        }
        // If there is already an XML node for this model and it is the correct type,
        //   then simply clone the XML node
        else if (objectDOM) {
          objectDOM = objectDOM.cloneNode(true);
        }
        // Otherwise, create a new XML node
        else {
          objectDOM = document.createElement(type);
        }

        //There needs to be at least one individual name, organization name, or position name
        if (
          this.nameIsEmpty() &&
          !this.get("organizationName") &&
          !this.get("positionName")
        )
          return "";

        var name = this.get("individualName");
        if (name) {
          //Get the individualName node
          var nameNode = $(objectDOM).find("individualname");
          if (!nameNode.length) {
            nameNode = document.createElement("individualname");
            $(objectDOM).prepend(nameNode);
          }

          //Empty the individualName node
          $(nameNode).empty();

          // salutation[s]
          if (!Array.isArray(name.salutation) && name.salutation)
            name.salutation = [name.salutation];

          _.each(name.salutation, function (salutation) {
            $(nameNode).prepend("<salutation>" + salutation + "</salutation>");
          });

          //Given name
          if (!Array.isArray(name.givenName) && name.givenName)
            name.givenName = [name.givenName];
          _.each(name.givenName, function (givenName) {
            //If there is a given name string, create a givenName node
            if (typeof givenName == "string" && givenName) {
              $(nameNode).append("<givenname>" + givenName + "</givenname>");
            }
          });

          // surname
          if (name.surName)
            $(nameNode).append("<surname>" + name.surName + "</surname>");
        }
        //If there is no name set on the model, remove it from the DOM
        else {
          $(objectDOM).find("individualname").remove();
        }

        // organizationName
        if (this.get("organizationName")) {
          //Get the organization name node
          if ($(objectDOM).find("organizationname").length)
            var orgNameNode = $(objectDOM).find("organizationname").detach();
          else var orgNameNode = document.createElement("organizationname");

          //Insert the text
          $(orgNameNode).text(this.get("organizationName"));

          //If the DOM is empty, append it
          if (!$(objectDOM).children().length) $(objectDOM).append(orgNameNode);
          else {
            var insertAfter = this.getEMLPosition(
              objectDOM,
              "organizationname",
            );

            if (insertAfter && insertAfter.length)
              insertAfter.after(orgNameNode);
            else $(objectDOM).prepend(orgNameNode);
          }
        }
        //Remove the organization name node if there is no organization name
        else {
          var orgNameNode = $(objectDOM).find("organizationname").remove();
        }

        // positionName
        if (this.get("positionName")) {
          //Get the name node
          if ($(objectDOM).find("positionname").length)
            var posNameNode = $(objectDOM).find("positionname").detach();
          else var posNameNode = document.createElement("positionname");

          //Insert the text
          $(posNameNode).text(this.get("positionName"));

          //If the DOM is empty, append it
          if (!$(objectDOM).children().length) $(objectDOM).append(posNameNode);
          else {
            let insertAfter = this.getEMLPosition(objectDOM, "positionname");
            if (insertAfter) insertAfter.after(posNameNode);
            else $(objectDOM).prepend(posNameNode);
          }
        }
        //Remove the position name node if there is no position name
        else {
          $(objectDOM).find("positionname").remove();
        }

        // address
        _.each(
          this.get("address"),
          function (address, i) {
            var addressNode = $(objectDOM).find("address")[i];

            if (!addressNode) {
              addressNode = document.createElement("address");
              this.getEMLPosition(objectDOM, "address").after(addressNode);
            }

            //Remove all the delivery points since they'll be reserialized
            $(addressNode).find("deliverypoint").remove();

            _.each(address.deliveryPoint, function (deliveryPoint, ii) {
              if (!deliveryPoint) return;

              var delPointNode = $(addressNode).find("deliverypoint")[ii];

              if (!delPointNode) {
                delPointNode = document.createElement("deliverypoint");

                //Add the deliveryPoint node to the address node
                //Insert after the last deliveryPoint node
                var appendAfter = $(addressNode).find("deliverypoint")[ii - 1];
                if (appendAfter) $(appendAfter).after(delPointNode);
                //Or just prepend to the beginning
                else $(addressNode).prepend(delPointNode);
              }

              $(delPointNode).text(deliveryPoint);
            });

            if (address.city) {
              var cityNode = $(addressNode).find("city");

              if (!cityNode.length) {
                cityNode = document.createElement("city");

                if (this.getEMLPosition(addressNode, "city")) {
                  this.getEMLPosition(addressNode, "city").after(cityNode);
                } else {
                  $(addressNode).append(cityNode);
                }
              }

              $(cityNode).text(address.city);
            } else {
              $(addressNode).find("city").remove();
            }

            if (address.administrativeArea) {
              var adminAreaNode = $(addressNode).find("administrativearea");

              if (!adminAreaNode.length) {
                adminAreaNode = document.createElement("administrativearea");

                if (this.getEMLPosition(addressNode, "administrativearea")) {
                  this.getEMLPosition(addressNode, "administrativearea").after(
                    adminAreaNode,
                  );
                } else {
                  $(addressNode).append(adminAreaNode);
                }
              }

              $(adminAreaNode).text(address.administrativeArea);
            } else {
              $(addressNode).find("administrativearea").remove();
            }

            if (address.postalCode) {
              var postalcodeNode = $(addressNode).find("postalcode");

              if (!postalcodeNode.length) {
                postalcodeNode = document.createElement("postalcode");

                if (this.getEMLPosition(addressNode, "postalcode")) {
                  this.getEMLPosition(addressNode, "postalcode").after(
                    postalcodeNode,
                  );
                } else {
                  $(addressNode).append(postalcodeNode);
                }
              }

              $(postalcodeNode).text(address.postalCode);
            } else {
              $(addressNode).find("postalcode").remove();
            }

            if (address.country) {
              var countryNode = $(addressNode).find("country");

              if (!countryNode.length) {
                countryNode = document.createElement("country");

                if (this.getEMLPosition(addressNode, "country")) {
                  this.getEMLPosition(addressNode, "country").after(
                    countryNode,
                  );
                } else {
                  $(addressNode).append(countryNode);
                }
              }

              $(countryNode).text(address.country);
            } else {
              $(addressNode).find("country").remove();
            }
          },
          this,
        );

        if (this.get("address").length == 0) {
          $(objectDOM).find("address").remove();
        }

        // phone[s]
        $(objectDOM).find("phone[phonetype='voice']").remove();
        _.each(
          this.get("phone"),
          function (phone) {
            var phoneNode = $(document.createElement("phone"))
              .attr("phonetype", "voice")
              .text(phone);
            this.getEMLPosition(objectDOM, "phone").after(phoneNode);
          },
          this,
        );

        // fax[es]
        $(objectDOM).find("phone[phonetype='facsimile']").remove();
        _.each(
          this.get("fax"),
          function (fax) {
            var faxNode = $(document.createElement("phone"))
              .attr("phonetype", "facsimile")
              .text(fax);
            this.getEMLPosition(objectDOM, "phone").after(faxNode);
          },
          this,
        );

        // electronicMailAddress[es]
        $(objectDOM).find("electronicmailaddress").remove();
        _.each(
          this.get("email"),
          function (email) {
            var emailNode = document.createElement("electronicmailaddress");
            this.getEMLPosition(objectDOM, "electronicmailaddress").after(
              emailNode,
            );

            $(emailNode).text(email);
          },
          this,
        );

        // online URL[es]
        $(objectDOM).find("onlineurl").remove();
        _.each(
          this.get("onlineUrl"),
          function (onlineUrl, i) {
            var urlNode = document.createElement("onlineurl");
            this.getEMLPosition(objectDOM, "onlineurl").after(urlNode);

            $(urlNode).text(onlineUrl);
          },
          this,
        );

        //user ID
        var userId = this.getUserIdArray();
        _.each(
          userId,
          function (id) {
            if (!id) return;

            var idNode = $(objectDOM).find("userid");

            //Create the userid node
            if (!idNode.length) {
              idNode = $(document.createElement("userid"));

              this.getEMLPosition(objectDOM, "userid").after(idNode);
            }

            // If this is an orcid identifier, format it correctly
            const validOrcid = this.validateOrcid(id, true);
            // validOrcid will be false if the ORCID is invalid, and a correctly
            // formatted ORCID if it is valid
            if (validOrcid) {
              // Add the directory attribute
              idNode.attr("directory", "https://orcid.org");
              // Check the orcid ID and standardize it if possible
              id = validOrcid;
            } else {
              idNode.attr("directory", "unknown");
            }

            $(idNode).text(id);
          },
          this,
        );

        //Remove all the user id's if there aren't any in the model
        if (userId.length == 0) {
          $(objectDOM).find("userid").remove();
        }

        // role
        //If this party type is not an associated party, then remove the role element
        if (type != "associatedParty" && type != "personnel") {
          $(objectDOM).find("role").remove();
        }
        //Otherwise, change the value of the role element
        else {
          // If for some reason there is no role, create a default role
          if (!this.get("roles").length) {
            var roles = ["Associated Party"];
          } else {
            var roles = this.get("roles");
          }
          _.each(
            roles,
            function (role, i) {
              var roleSerialized = $(objectDOM).find("role");
              if (roleSerialized.length) {
                $(roleSerialized[i]).text(role);
              } else {
                roleSerialized = $(document.createElement("role")).text(role);
                this.getEMLPosition(objectDOM, "role").after(roleSerialized);
              }
            },
            this,
          );
        }

        //XML id attribute
        this.createID();
        //if(this.get("xmlID"))
        $(objectDOM).attr("id", this.get("xmlID"));
        //else
        //  $(objectDOM).removeAttr("id");

        // Remove empty (zero-length or whitespace-only) nodes
        $(objectDOM)
          .find("*")
          .filter(function () {
            return $.trim(this.innerHTML) === "";
          })
          .remove();

        return objectDOM;
      },

      /*
       * Adds this EMLParty model to it's parent EML211 model in the appropriate role array
       *
       * @return {boolean} - Returns true if the merge was successful, false if the merge was cancelled
       */
      mergeIntoParent: function () {
        //Get the type of EML Party, in relation to the parent model
        if (this.get("type") && this.get("type") != "associatedParty")
          var type = this.get("type");
        else var type = "associatedParty";

        //Update the list of EMLParty models in the parent model
        var parentEML = this.getParentEML();

        if (parentEML.type != "EML") return false;

        //Add this model to the EML model
        var successfulAdd = parentEML.addParty(this);

        //Validate the model
        this.isValid();

        return successfulAdd;
      },

      isEmpty: function () {
        // If we add any new fields, be sure to add the attribute here
        var attributes = [
          "userId",
          "fax",
          "phone",
          "onlineUrl",
          "email",
          "positionName",
          "organizationName",
        ];

        //Check each value in the model that gets serialized to see if there is a value
        for (var i in attributes) {
          //Get the value from the model for this attribute
          var modelValue = this.get(attributes[i]);

          //If this is an array, then we want to check if there are any values in it
          if (Array.isArray(modelValue)) {
            if (modelValue.length > 0) return false;
          }
          //Otherwise, check if this value differs from the default value
          else if (this.get(attributes[i]) !== this.defaults()[attributes[i]]) {
            return false;
          }
        }

        //Check for a first and last name
        if (
          this.get("individualName") &&
          (this.get("individualName").givenName ||
            this.get("individualName").surName)
        )
          return false;

        //Check for addresses
        var isAddress = false;

        if (this.get("address")) {
          //Checks if there are any values anywhere in the address
          _.each(this.get("address"), function (address) {
            //Delivery point is an array so we need to check the first and second
            //values of that array
            if (
              address.administrativeArea ||
              address.city ||
              address.country ||
              address.postalCode ||
              (address.deliveryPoint &&
                address.deliveryPoint.length &&
                (address.deliveryPoint[0] || address.deliveryPoint[1]))
            ) {
              isAddress = true;
            }
          });
        }

        //If we found an address value anywhere, then it is not empty
        if (isAddress) return false;

        //If we never found a value, then return true because this model is empty
        return true;
      },

      /*
       * Returns the node in the given EML snippet that the given node type should be inserted after
       */
      getEMLPosition: function (objectDOM, nodeName) {
        var nodeOrder = [
          "individualname",
          "organizationname",
          "positionname",
          "address",
          "phone",
          "electronicmailaddress",
          "onlineurl",
          "userid",
          "role",
        ];
        var addressOrder = [
          "deliverypoint",
          "city",
          "administrativearea",
          "postalcode",
          "country",
        ];

        //If this is an address node, find the position within the address
        if (_.contains(addressOrder, nodeName)) {
          nodeOrder = addressOrder;
        }

        var position = _.indexOf(nodeOrder, nodeName);
        if (position == -1) return $(objectDOM).children().last();

        //Go through each node in the node list and find the position where this node will be inserted after
        for (var i = position - 1; i >= 0; i--) {
          if ($(objectDOM).find(nodeOrder[i]).length)
            return $(objectDOM).find(nodeOrder[i]).last();
        }

        return false;
      },

      createID: function () {
        this.set(
          "xmlID",
          Math.ceil(
            Math.random() * (9999999999999999 - 1000000000000000) +
              1000000000000000,
          ),
        );
      },

      setType: function () {
        if (this.get("roles")) {
          if (this.get("roles").length && !this.get("type")) {
            this.set("type", "associatedParty");
          }
        }
      },

      trickleUpChange: function () {
        if (this.get("parentModel")) {
          MetacatUI.rootDataPackage.packageModel.set("changed", true);
        }
      },

      removeFromParent: function () {
        if (!this.get("parentModel")) return;
        else if (typeof this.get("parentModel").removeParty != "function")
          return;

        this.get("parentModel").removeParty(this);

        this.set("removed", true);
      },

      /*
       * Checks the values of the model to determine if it is EML-valid
       */
      validate: function () {
        var individualName = this.get("individualName") || {},
          givenName = individualName.givenName || [],
          surName = individualName.surName || null,
          errors = {};

        //If there are no values in this model that would be serialized, then the model is valid
        if (
          !this.get("organizationName") &&
          !this.get("positionName") &&
          !givenName[0]?.length &&
          !surName &&
          !this.get("address").length &&
          !this.get("phone").length &&
          !this.get("fax").length &&
          !this.get("email").length &&
          !this.get("onlineUrl").length &&
          !this.get("userId").length
        ) {
          return;
        }

        //The EMLParty must have either an organization name, position name, or surname.
        // It must ALSO have a type or role.
        if (
          !this.get("organizationName") &&
          !this.get("positionName") &&
          (!this.get("individualName") || !surName)
        ) {
          errors = {
            surName:
              "Either a last name, position name, or organization name is required.",
            positionName: "",
            organizationName: "",
          };
        }
        //If there is a first name and no last name, then this is not a valid individualName
        else if (
          givenName[0]?.length &&
          !surName &&
          this.get("organizationName") &&
          this.get("positionName")
        ) {
          errors = { surName: "Provide a last name." };
        }

        //Check that each required field has a value. Required fields are configured in the {@link AppConfig}
        let roles =
          this.get("type") == "associatedParty"
            ? this.get("roles")
            : [this.get("type")];
        for (let role of roles) {
          let requiredFields = MetacatUI.appModel.get(
            "emlEditorRequiredFields_EMLParty",
          )[role];
          requiredFields?.forEach((field) => {
            let currentVal = this.get(field);
            if (!currentVal || !currentVal?.length) {
              errors[field] =
                `Provide a${["a", "e", "i", "o", "u"].includes(field.charAt(0)) ? "n " : " "} ${field}. `;
            }
          });
        }

        // If there is an email address, validate it
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const email = this.get("email");
        if (email?.length) {
          email.forEach((emailAddress) => {
            if (!emailAddress.match(emailRegex)) {
              errors.email = "Provide a valid email address.";
            }
          });
        }

        // If there is an ORCID, ensure it is valid
        const userId = this.getUserIdArray();
        userId.forEach((id) => {
          if (this.isOrcid(id) && !this.validateOrcid(id)) {
            errors.userId =
              "Provide a valid ORCID in the format https://orcid.org/0000-0000-0000-0000.";
          }
        });

        return Object.keys(errors)?.length ? errors : false;
      },

      /**
       * Get the userId attribute and ensure it is an array
       * @returns {string[]} - An array of userIds
       * @since 2.32.0
       */
      getUserIdArray() {
        const userId = this.get("userId");
        if (!userId) return [];
        if (Array.isArray(userId)) return userId;
        return [userId];
      },

      /**
       * Validate an ORCID string. The following formats are valid according to
       * {@link https://support.orcid.org/hc/en-us/articles/17697515256855-I-entered-my-ORCID-iD-in-a-form-and-it-said-it-s-invalid}.
       * - Full URL (http): http://orcid.org/0000-0000-0000-0000
       * - Full URL (https): https://orcid.org/0000-0000-0000-0000
       * - Numbers only, with hyphens: 0000-0000-0000-0000.
       *
       * The last character in the ORCID iD is a checksum. This checksum must be
       * the digits 0-9 or the letter X, which represents the value 10.
       * @param {string} orcid - The ORCID iD to validate
       * @param {boolean} standardize - If true, the ORCID iD will be
       * standardized to the https://orcid.org/0000-0000-0000-0000 format.
       * @returns {string|boolean} - Returns false if the ORCID iD is invalid, or
       * the string if it is valid. If standardize is true, the returned orcid
       * will be the standardized URL.
       * @since 2.32.0
       */
      validateOrcid(orcid, standardize = false) {
        // isOrcid doesn't allow for the id without orcid.org
        if (!this.isOrcid(orcid) && !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/) {
          return false;
        }

        // Find the 0000-0000-0000-0000 part of the string
        const id = orcid.match(/\d.*[\dX]$/)?.[0];
        // The ORCID must follow the 0000-0000-0000-0000 format exactly
        if (!id?.match(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/)) return false;

        // Only the digits + hypen pattern is valid
        if (id === orcid && !standardize) return orcid;

        // Assuming the ORCID is valid at this point, we can standardize it
        if (standardize) return `https://orcid.org/${id}`;

        // Both the HTTP and HTTPS URL formats are valid
        if (
          orcid.match(/^https?:\/\/orcid.org\/\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/)
        ) {
          return orcid;
        }

        // Remaining options are that the ORCID includes orcid.org but not the
        // entire https or http URL, which makes it invalid.
        return orcid;
      },

      isOrcid: function (username) {
        if (!username) return false;

        //If the ORCID URL is anywhere in this username string, it is an ORCID
        if (username.indexOf("orcid.org") > -1) {
          return true;
        }

        /* The ORCID checksum algorithm to determine is a character string is an ORCiD
         * http://support.orcid.org/knowledgebase/articles/116780-structure-of-the-orcid-identifier
         */
        var total = 0,
          baseDigits = username.replace(/-/g, "").substr(0, 15);

        for (var i = 0; i < baseDigits.length; i++) {
          var digit = parseInt(baseDigits.charAt(i));
          total = (total + digit) * 2;
        }

        var remainder = total % 11,
          result = (12 - remainder) % 11,
          checkDigit = result == 10 ? "X" : result.toString(),
          isOrcid = checkDigit == username.charAt(username.length - 1);

        return isOrcid;
      },

      /*
       *  Clones all the values of this array into a new JS Object.
       *  Special care is needed for nested objects and arrays
       *  This is helpful when copying this EMLParty to another role in the EML
       */
      copyValues: function () {
        //Get a JSON object of all the model copyValues
        var modelValues = this.toJSON();

        //Go through each model value and properly clone the arrays
        _.each(Object.keys(modelValues), function (key, i) {
          //Clone the array via slice()
          if (Array.isArray(modelValues[key]))
            modelValues[key] = modelValues[key].slice(0);
        });

        //Individual Names are objects, so properly clone them
        if (modelValues.individualName) {
          modelValues.individualName = Object.assign(
            {},
            modelValues.individualName,
          );
        }

        //Addresses are objects, so properly clone them
        if (modelValues.address.length) {
          _.each(modelValues.address, function (address, i) {
            modelValues.address[i] = Object.assign({}, address);

            //The delivery point is an array of strings, so properly clone the array
            if (Array.isArray(modelValues.address[i].deliveryPoint))
              modelValues.address[i].deliveryPoint =
                modelValues.address[i].deliveryPoint.slice(0);
          });
        }
        return modelValues;
      },

      /**
       * getName - For an individual, returns the first and last name as a string. Otherwise,
       * returns the organization or position name.
       *
       * @return {string} Returns the name of the party or an empty string if one cannot be found
       *
       * @since 2.15.0
       */
      getName: function () {
        return this.get("individualName")
          ? this.get("individualName").givenName +
              " " +
              this.get("individualName").surName
          : this.get("organizationName") || this.get("positionName") || "";
      },

      /**
       * Return the EML Party as a CSL JSON object. See
       * {@link https://citeproc-js.readthedocs.io/en/latest/csl-json/markup.html#names}.
       * @return {object} The CSL JSON object
       * @since 2.23.0
       */
      toCSLJSON: function () {
        const name = this.get("individualName");
        const csl = {
          family: name?.surName || null,
          given: name?.givenName || null,
          literal:
            this.get("organizationName") || this.get("positionName") || "",
          "dropping-particle": name?.salutation || null,
        };
        // If any of the fields are arrays, join them with a space
        for (const key in csl) {
          if (Array.isArray(csl[key])) {
            csl[key] = csl[key].join(" ");
          }
        }
        return csl;
      },

      /*
       * function nameIsEmpty - Returns true if the individualName set on this
       * model contains only empty values. Otherwise, returns false. This is just a
       * shortcut for manually checking each name field individually.
       *
       * @return {boolean}
       */
      nameIsEmpty: function () {
        var name = this.get("individualName");

        if (!name || typeof name != "object") return true;

        //Check if there are given names
        var givenName = name.givenName,
          givenNameEmpty = false;

        if (
          !givenName ||
          (Array.isArray(givenName) && givenName.length == 0) ||
          (typeof givenName == "string" && givenName.trim().length == 0)
        )
          givenNameEmpty = true;

        //Check if there are no sur names
        var surName = name.surName,
          surNameEmpty = false;

        if (
          !surName ||
          (Array.isArray(surName) && surName.length == 0) ||
          (typeof surName == "string" && surName.trim().length == 0)
        )
          surNameEmpty = true;

        //Check if there are no salutations
        var salutation = name.salutation,
          salutationEmpty = false;

        if (
          !salutation ||
          (Array.isArray(salutation) && salutation.length == 0) ||
          (typeof salutation == "string" && salutation.trim().length == 0)
        )
          salutationEmpty = true;

        if (givenNameEmpty && surNameEmpty && salutationEmpty) return true;
        else return false;
      },

      /*
       * Climbs up the model heirarchy until it finds the EML model
       *
       * @return {EML211 or false} - Returns the EML 211 Model or false if not found
       */
      getParentEML: function () {
        return EMLUtilities.getParentEML(this);
      },

      /**
       * @type {object[]}
       * @property {string} label - The name of the party category to display to the user
       * @property {string} dataCategory - The string that is used to represent this party. This value
       *  should exactly match one of the strings listed in EMLParty typeOptions or EMLParty roleOptions.
       * @property {string} description - An optional description to display below the label to help the user
       *  with this category.
       * @property {boolean} createFromUser - If set to true, the information from the logged-in user will be
       *  used to create an EML party for this category if none exist already when the view loads.
       * @property {number} limit - If the number of parties allowed for this category is not unlimited,
       *  then limit should be set to the maximum allowable number.
       * @since 2.21.0
       */
      partyTypes: [
        {
          label: "Dataset Creators (Authors/Owners/Originators)",
          dataCategory: "creator",
          description:
            "Each person or organization listed as a Creator will be listed in the data" +
            " citation. At least one person, organization, or position with a 'Creator'" +
            " role is required.",
          createFromUser: true,
        },
        {
          label: "Contact",
          dataCategory: "contact",
          createFromUser: true,
        },
        {
          label: "Principal Investigators",
          dataCategory: "principalInvestigator",
        },
        {
          label: "Co-Principal Investigators",
          dataCategory: "coPrincipalInvestigator",
        },
        {
          label: "Collaborating-Principal Investigators",
          dataCategory: "collaboratingPrincipalInvestigator",
        },
        {
          label: "Metadata Provider",
          dataCategory: "metadataProvider",
        },
        {
          label: "Custodians/Stewards",
          dataCategory: "custodianSteward",
        },
        {
          label: "Publisher",
          dataCategory: "publisher",
          description: "Only one publisher can be specified.",
          limit: 1,
        },
        {
          label: "Users",
          dataCategory: "user",
        },
      ],

      formatXML: function (xmlString) {
        return DataONEObject.prototype.formatXML.call(this, xmlString);
      },
    },
  );

  return EMLParty;
});
