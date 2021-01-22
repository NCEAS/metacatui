/* global define */
define([
  "jquery",
  "underscore",
  "backbone",
  "models/DataONEObject",
  "models/metadata/eml211/EMLParty",
  "models/metadata/eml211/EMLAward"
], function($, _, Backbone, DataONEObject, EMLParty, EMLAward) {
  var EMLProject = Backbone.Model.extend({
    defaults: {
      objectDOM: null,
      title: null,
      funding: [],
      award: [],
      personnel: null,
      parentModel: null,
      nodeOrder: [
        "title",
        "personnel",
        "abstract",
        "funding",
        "award",
        "studyAreaDescription",
        "designDescription",
        "relatedProject"
      ]
    },

    initialize: function(options) {
      if (options && options.objectDOM) this.set(this.parse(options.objectDOM));

      this.on(
        "change:personnel change:funding change:title",
        this.trickleUpChange
      );
    },

    /**
     * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased
     * EML node names (valid in EML).
     *
     * @return {object} - An object of node names,
     */
    nodeNameMap: function() {
      return {
        descriptorvalue: "descriptorValue",
        designdescription: "designDescription",
        studyareadescription: "studyAreaDescription",
        relatedproject: "relatedProject",
        researchproject: "researchProject",
        title: "title"
      };
    },

    /**
     * Overrides the default Backbone.Model.parse() function to parse the custom
     * collection XML document
     *
     * TODO: This only supports the award, funding and title elements right now
     *
     * @param {XMLDocument} response - The XMLDocument returned from the fetch() AJAX call
     * @return {JSON} The result of the parsed XML, in JSON. To be set directly on the model.
     */
    parse: function(objectDOM) {
      if (!objectDOM) var objectDOM = this.get("objectDOM");

      var modelJSON = {};

      //Parse the title
      var titleNode = $(objectDOM).children("title");
      if (titleNode.length) {
        modelJSON.title = titleNode.text() || null;
      }

      //Parse the funding info
      modelJSON.funding = [];
      var fundingEl = $(objectDOM).children("funding"),
        fundingNodes = fundingEl.children("para").length
          ? fundingEl.children("para")
          : fundingEl;
      //Iterate over each funding node and put the text into the funding array
      _.each(
        fundingNodes,
        function(fundingNode) {
          if ($(fundingNode).text()) {
            modelJSON.funding.push($(fundingNode).text());
          }
        },
        this
      );

      //Parse the award info
      var awardNodes = $(objectDOM).children("award");
      modelJSON.award = [];
      for (var i = 0; i < awardNodes.length; i++) {
        modelJSON.award.push(
          new EMLAward({ objectDOM: awardNodes[i], parentModel: this })
        );
      }

      /*
			var personnelNode = $(objectDOM).find("personnel");
			modelJSON.personnel = [];
			for(var i=0; i<personnelNode.length; i++){
				modelJSON.personnel.push( new EMLParty({ objectDOM: personnelNode[i], parentModel: this }));
			}
      */

      return modelJSON;
    },

    /**
     * Create XML DOM with the new values from the model.
     *
     * @return {XMLDocument} - An XML DOM for the model.
     */
    updateDOM: function() {
      var objectDOM = this.get("objectDOM")
        ? this.get("objectDOM").cloneNode(true)
        : document.createElement("project");

      //Create a project title
      //If there is no title node, create one
      if (!$(objectDOM).find("title").length) {
        var title =
          this.get("title") || this.get("parentModel").get("title") || "";
        $(objectDOM).prepend($(document.createElement("title")).text(title));
      }

      //Create project personnel
      if (!$(objectDOM).find("personnel").length) {
        var personnel = this.get("personnel");

        if (!personnel) {
          personnel = [];

          _.each(
            this.get("parentModel").get("creator"),
            function(creator) {
              var individualName =
                  typeof creator.get("individualName") == "object"
                    ? Object.assign({}, creator.get("individualName"))
                    : null,
                organizationName = creator.get("organizationName"),
                positionName = creator.get("positionName");

              var newPersonnel = new EMLParty({
                roles: ["principalInvestigator"],
                parentModel: this,
                type: "personnel",
                individualName: individualName,
                organizationName: organizationName,
                positionName: positionName
              });

              personnel.push(newPersonnel);

              $(objectDOM).append(newPersonnel.updateDOM());
            },
            this
          );

          this.trigger("change:personnel");
        } else {
          _.each(
            this.get("personnel"),
            function(party) {
              $(objectDOM).append(party.updateDOM());
            },
            this
          );
        }
      }

      // Serialize funding (if needed)
      var fundingNode = $(objectDOM).children("funding");
      if (this.get("funding") && this.get("funding").length > 0) {
        // Create the funding element if needed
        if (fundingNode.length == 0) {
          fundingNode = document.createElement("funding");
          this.getEMLPosition(objectDOM, "funding").after(fundingNode);
        } else {
          // Clear the funding node out of all <para> child elements
          // We only replace <paras> because <funding> is an EMLText module
          // instance and can contain other content we don't want to remove
          // when serializing
          $(fundingNode)
            .children("para")
            .remove();
        }

        //Add a <para> element with the text for each funding info
        _.each(this.get("funding"), function(f) {
          $(fundingNode).append($(document.createElement("para")).text(f));
        });
      } else if (
        (!this.get("funding") || !this.get("funding").length) &&
        fundingNode.length > 0
      ) {
        // Remove all funding elements
        $(fundingNode).remove();
      }

      //Create project award
      var awardNode = $(objectDOM).children("award");

      if (this.get("award")) {
        // Remove all award elements
        $(awardNode).remove();

        // Create award elements and append to objectDOM
        if (Array.isArray(this.get("award"))) {
          _.each(this.get("award"), function(award) {
            $(objectDOM).append(award.updateDOM());
          });
        } else {
          $(objectDOM).append(this.get("award").updateDOM());
        }
      } else if (
        (!this.get("award") || !this.get("award").length) &&
        awardNode.length > 0
      ) {
        // Remove all award elements
        $(awardNode).remove();
      }

      // Remove empty (zero-length or whitespace-only) nodes
      $(objectDOM)
        .find("*")
        .filter(function() {
          return $.trim(this.innerHTML) === "";
        })
        .remove();

      return objectDOM;
    },

    trickleUpChange: function() {
      MetacatUI.rootDataPackage.packageModel.set("changed", true);
    },

    /**
     * Remove one award from the award model
     *
     * @param {number} - The index of the item to remove from the awards array
     */
    removeAward: function(index) {
      this.set("award", _.without(this.get("award"), this.get("award")[index]));
      this.trickleUpChange();
    },

    /**
     * Add one award to the award model
     *
     * @param {object} - The award that witll be added to the awards array
     */
    addAward: function(award) {
      this.set("award", [...this.get("award"), award]);
      this.trickleUpChange();
    }
  });

  return EMLProject;
});
