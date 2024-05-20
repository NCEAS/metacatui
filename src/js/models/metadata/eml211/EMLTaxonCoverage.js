define(["jquery", "underscore", "backbone", "models/DataONEObject"], function (
  $,
  _,
  Backbone,
  DataONEObject,
) {
  /**
   * @name taxonomicClassification
   * @type {Object}
   * @property {string} taxonRankName - The name of the taxonomic rank, for
   * example, Domain, Kingdom, etc.
   * @property {string} taxonRankValue - The value for the given taxonomic rank,
   * for example, Animalia, Chordata, etc.
   * @property {string[]} commonName - Common name(s) for the taxon, for example
   * ["Animal"]
   * @property {Object[]} taxonId - A taxon identifier from a controlled
   * vocabulary, for example, ITIS, NCBI, etc.
   * @property {string} taxonId.provider - The provider of the taxon identifier,
   * given as a URI, for example http://www.itis.gov
   * @property {string} taxonId.value - The identifier from the provider, for
   * example, 180092
   * @property {Object[]} taxonomicClassification - A nested taxonomic
   * classification, since taxonomy is represented as a hierarchy in EML.
   */

  /**
   * @class EMLTaxonCoverage
   * @classdesc The EMLTaxonCoverage model represents the taxonomic coverage of
   * a dataset. It includes a general description of the taxonomic coverage, as
   * well as a list of taxonomic classifications.
   * @classcategory Models/Metadata/EML
   * @extends Backbone.Model
   * @constructor
   */
  var EMLTaxonCoverage = Backbone.Model.extend(
    /** @lends EMLTaxonCoverage.prototype */ {
      /**
       * Returns the default properties for this model. Defined here.
       * @type {Object}
       * @property {string} objectXML - The XML string for this model
       * @property {Element} objectDOM - The XML DOM for this model
       * @property {EML211} parentModel - The parent EML211 model
       * @property {taxonomicClassification[]} taxonomicClassification - An array
       * of taxonomic classifications, defining the taxonomic coverage of the
       * dataset
       * @property {string} generalTaxonomicCoverage - A general description of the
       * taxonomic coverage of the dataset
       */
      defaults: {
        objectXML: null,
        objectDOM: null,
        parentModel: null,
        taxonomicClassification: [],
        generalTaxonomicCoverage: null,
      },

      initialize: function (attributes) {
        if (attributes.objectDOM) this.set(this.parse(attributes.objectDOM));

        this.on("change:taxonomicClassification", this.trickleUpChange);
        this.on("change:taxonomicClassification", this.updateDOM);
      },

      /*
       * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased
       * EML node names (valid in EML). Used during parse() and serialize()
       */
      nodeNameMap: function () {
        return {
          generaltaxonomiccoverage: "generalTaxonomicCoverage",
          taxonomicclassification: "taxonomicClassification",
          taxonrankname: "taxonRankName",
          taxonrankvalue: "taxonRankValue",
          taxonomiccoverage: "taxonomicCoverage",
          taxonomicsystem: "taxonomicSystem",
          classificationsystem: "classificationSystem",
          classificationsystemcitation: "classificationSystemCitation",
          classificationsystemmodifications:
            "classificationSystemModifications",
          identificationreference: "identificationReference",
          identifiername: "identifierName",
          taxonomicprocedures: "taxonomicProcedures",
          taxonomiccompleteness: "taxonomicCompleteness",
          taxonid: "taxonId",
          commonname: "commonName",
        };
      },

      parse: function (objectDOM) {
        if (!objectDOM) var xml = this.get("objectDOM");

        var model = this,
          taxonomicClassifications = $(objectDOM).children(
            "taxonomicclassification",
          ),
          modelJSON = {
            taxonomicClassification: _.map(
              taxonomicClassifications,
              function (tc) {
                return model.parseTaxonomicClassification(tc);
              },
            ),
            generalTaxonomicCoverage: $(objectDOM)
              .children("generaltaxonomiccoverage")
              .first()
              .text(),
          };

        return modelJSON;
      },

      parseTaxonomicClassification: function (classification) {
        var id = $(classification).attr("id");
        var rankName = $(classification).children("taxonrankname");
        var rankValue = $(classification).children("taxonrankvalue");
        var commonName = $(classification).children("commonname");
        var taxonId = $(classification).children("taxonId");
        var taxonomicClassification = $(classification).children(
          "taxonomicclassification",
        );

        var model = this,
          modelJSON = {
            id: id,
            taxonRankName: $(rankName).text().trim(),
            taxonRankValue: $(rankValue).text().trim(),
            commonName: _.map(commonName, function (cn) {
              return $(cn).text().trim();
            }),
            taxonId: _.map(taxonId, function (tid) {
              return {
                provider: $(tid).attr("provider").trim(),
                value: $(tid).text().trim(),
              };
            }),
            taxonomicClassification: _.map(
              taxonomicClassification,
              function (tc) {
                return model.parseTaxonomicClassification(tc);
              },
            ),
          };

        if (
          Array.isArray(modelJSON.taxonomicClassification) &&
          !modelJSON.taxonomicClassification.length
        )
          modelJSON.taxonomicClassification = {};

        return modelJSON;
      },

      serialize: function () {
        var objectDOM = this.updateDOM(),
          xmlString = objectDOM.outerHTML;

        //Camel-case the XML
        xmlString = this.formatXML(xmlString);

        return xmlString;
      },

      /*
       * Makes a copy of the original XML DOM and updates it with the new values
       * from the model.
       */
      updateDOM: function () {
        var objectDOM = this.get("objectDOM")
          ? this.get("objectDOM").cloneNode(true)
          : document.createElement("taxonomiccoverage");

        $(objectDOM).empty();

        // generalTaxonomicCoverage
        var generalCoverage = this.get("generalTaxonomicCoverage");
        if (_.isString(generalCoverage) && generalCoverage.length > 0) {
          $(objectDOM).append(
            $(document.createElement("generaltaxonomiccoverage")).text(
              this.get("generalTaxonomicCoverage"),
            ),
          );
        }

        // taxonomicClassification(s)
        var classifications = this.get("taxonomicClassification");

        if (
          typeof classifications === "undefined" ||
          classifications.length === 0
        ) {
          return objectDOM;
        }

        for (var i = 0; i < classifications.length; i++) {
          $(objectDOM).append(
            this.createTaxonomicClassificationDOM(classifications[i]),
          );
        }

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
       * Create the DOM for a single EML taxonomicClassification.
       * This function is currently recursive!
       */
      createTaxonomicClassificationDOM: function (classification) {
        var id = classification.id,
          taxonRankName = classification.taxonRankName || "",
          taxonRankValue = classification.taxonRankValue || "",
          commonName = classification.commonName || "",
          taxonId = classification.taxonId,
          finishedEl;

        if (!taxonRankName || !taxonRankValue) return "";

        finishedEl = $(document.createElement("taxonomicclassification"));

        if (typeof id === "string" && id.length > 0) {
          $(finishedEl).attr("id", id);
        }

        if (taxonRankName && taxonRankName.length > 0) {
          $(finishedEl).append(
            $(document.createElement("taxonrankname")).text(taxonRankName),
          );
        }

        if (taxonRankValue && taxonRankValue.length > 0) {
          $(finishedEl).append(
            $(document.createElement("taxonrankvalue")).text(taxonRankValue),
          );
        }

        if (commonName && commonName.length > 0) {
          $(finishedEl).append(
            $(document.createElement("commonname")).text(commonName),
          );
        }

        if (taxonId) {
          if (!Array.isArray(taxonId)) taxonId = [taxonId];
          _.each(taxonId, function (el) {
            var taxonIdEl = $(document.createElement("taxonId")).text(el.value);

            if (el.provider) {
              $(taxonIdEl).attr("provider", el.provider);
            }

            $(finishedEl).append(taxonIdEl);
          });
        }

        if (classification.taxonomicClassification) {
          _.each(
            classification.taxonomicClassification,
            function (tc) {
              $(finishedEl).append(this.createTaxonomicClassificationDOM(tc));
            },
            this,
          );
        }

        return finishedEl;
      },

      /* Validate this model */
      validate: function () {
        var errors = {};

        if (
          !this.get("generalTaxonomicCoverage") &&
          MetacatUI.appModel.get("emlEditorRequiredFields")
            .generalTaxonomicCoverage
        )
          errors.generalTaxonomicCoverage =
            "Provide a description of the taxonomic coverage.";

        //If there are no taxonomic classifications and it is either required in
        // the AppModel OR a general coverage was given, then require it
        if (
          !this.get("taxonomicClassification").length &&
          (MetacatUI.appModel.get("emlEditorRequiredFields").taxonCoverage ||
            this.get("generalTaxonomicCoverage"))
        ) {
          errors.taxonomicClassification =
            "Provide at least one complete taxonomic classification.";
        } else {
          //Every taxonomic classification should be valid
          if (
            !_.every(
              this.get("taxonomicClassification"),
              this.isClassificationValid,
              this,
            )
          )
            errors.taxonomicClassification =
              "Every classification row should have a rank and value.";
        }

        // Check for and remove duplicate classifications
        this.removeDuplicateClassifications();

        if (Object.keys(errors).length) return errors;
      },

      isEmpty: function () {
        return (
          !this.get("generalTaxonomicCoverage") &&
          !this.get("taxonomicClassification").length
        );
      },

      isClassificationValid: function (taxonomicClassification) {
        if (!Object.keys(taxonomicClassification).length) return true;
        if (Array.isArray(taxonomicClassification)) {
          if (
            !taxonomicClassification[0].taxonRankName ||
            !taxonomicClassification[0].taxonRankValue
          ) {
            return false;
          }
        } else if (
          !taxonomicClassification.taxonRankName ||
          !taxonomicClassification.taxonRankValue
        ) {
          return false;
        }

        if (taxonomicClassification.taxonomicClassification)
          return this.isClassificationValid(
            taxonomicClassification.taxonomicClassification,
          );
        else return true;
      },

      /**
       * Check if two classifications are equal. Two classifications are equal if
       * they have the same rankName, rankValue, commonName, and taxonId, as well
       * as the same nested classifications. This function is recursive.
       * @param {taxonomicClassification} c1
       * @param {taxonomicClassification} c2
       * @returns {boolean} - True if the two classifications are equal
       * @since 2.24.0
       */
      classificationsAreEqual: function (c1, c2) {
        if (!c1 && !c2) return true;
        if (!c1 && c2) return false;
        if (c1 && !c2) return false;

        // stringify the two classifications for
        const stringKeys = ["taxonRankName", "taxonRankValue", "commonName"];

        // Recursively stringify the nested classifications for comparison
        stringifyClassification = function (c) {
          const stringified = {};
          for (let key of stringKeys) {
            if (c[key]) stringified[key] = c[key];
          }
          if (c.taxonId) stringified.taxonId = c.taxonId;
          if (c.taxonomicClassification) {
            stringified.taxonomicClassification = stringifyClassification(
              c.taxonomicClassification,
            );
          }
          const st = JSON.stringify(stringified);
          // convert all to uppercase for comparison
          return st.toUpperCase();
        };

        return stringifyClassification(c1) === stringifyClassification(c2);
      },

      /**
       * Returns true if the given classification is a duplicate of another
       * classification in this model. Duplicates are considered those that have
       * all values identical, including rankName, rankValue, commonName, and
       * taxonId. If there are any nested classifications, then they too must
       * be identical for the classification to be considered a duplicate, this
       * this function is recursive. Only checks one classification at a time.
       * @param {taxonomicClassification} classification
       * @param {number} indexToSkip - The index of the classification to skip
       * when checking for duplicates. This is useful when checking if a
       * classification is a duplicate of another classification in the same
       * model, but not itself.
       * @returns {boolean} - True if the given classification is a duplicate
       * @since 2.24.0
       */
      isDuplicate: function (classification, indexToSkip) {
        const classifications = this.get("taxonomicClassification");
        for (let i = 0; i < classifications.length; i++) {
          if (typeof indexToSkip === "number" && i === indexToSkip) continue;
          if (
            this.classificationsAreEqual(classifications[i], classification)
          ) {
            return true;
          }
        }
        return false;
      },

      /**
       * Remove any duplicated classifications from this model. See
       * {@link isDuplicate} for more information on what is considered a
       * duplicate. If any classifications are removed, then a
       * "duplicateClassificationsRemoved" event is triggered, passing the
       * removed classifications as an argument.
       * @fires duplicateClassificationsRemoved
       * @since 2.24.0
       */
      removeDuplicateClassifications: function () {
        const classifications = this.get("taxonomicClassification");
        const removed = [];
        for (let i = 0; i < classifications.length; i++) {
          const classification = classifications[i];
          if (this.isDuplicate(classification, i)) {
            classifications.splice(i, 1);
            this.set("taxonomicClassification", classifications);
            removed.push(classification);
            i--;
          }
        }
        if (removed.length) {
          this.trigger("duplicateClassificationsRemoved", removed);
        }
      },

      /*
       * Climbs up the model hierarchy until it finds the EML model
       *
       * @return {EML211 or false} - Returns the EML 211 Model or false if not
       * found
       */
      getParentEML: function () {
        var emlModel = this.get("parentModel"),
          tries = 0;

        while (emlModel.type !== "EML" && tries < 6) {
          emlModel = emlModel.get("parentModel");
          tries++;
        }

        if (emlModel && emlModel.type == "EML") return emlModel;
        else return false;
      },

      trickleUpChange: function () {
        MetacatUI.rootDataPackage.packageModel.set("changed", true);
      },

      formatXML: function (xmlString) {
        return DataONEObject.prototype.formatXML.call(this, xmlString);
      },
    },
  );

  return EMLTaxonCoverage;
});
