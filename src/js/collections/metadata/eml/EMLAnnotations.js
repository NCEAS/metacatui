"use strict";

define(["underscore", "backbone", "models/metadata/eml211/EMLAnnotation"], (
  _,
  Backbone,
  EMLAnnotation,
) => {
  const SCHEMA_ORG_SAME_AS = "http://www.w3.org/2002/07/owl#sameAs";
  const PROV_WAS_DERIVED_FROM = "http://www.w3.org/ns/prov#wasDerivedFrom";
  /**
   * @class EMLAnnotations
   * @classdesc A collection of EMLAnnotations.
   * @classcategory Collections/Metadata/EML
   * @since 2.19.0
   * @augments Backbone.Collection
   */
  const EMLAnnotations = Backbone.Collection.extend(
    /** @lends EMLAnnotations.prototype */
    {
      /** @inheritdoc */
      model: EMLAnnotation,

      /**
       * Checks if this collection already has an annotation for the same
       * property URI.
       * @param {EMLAnnotation} annotation The EMLAnnotation to compare against
       * the annotations already in this collection.
       * @returns {boolean} Returns true is this collection already has an
       * annotation for this property.
       */
      hasDuplicateOf(annotation) {
        // If there is at least one model in this collection and there is a
        // propertyURI set on the given model,
        if (this.length && annotation.get("propertyURI")) {
          // Return whether or not there is a duplicate
          const properties = this.pluck("propertyURI");
          return properties.includes(annotation.get("propertyURI"));
        }
        // If this collection is empty or the propertyURI is falsey, return
        // false
        return false;
      },

      /**
       * Removes the EMLAnnotation from this collection that has the same
       * propertyURI as the given annotation. Then adds the given annotation to
       * the collection. If no duplicate is found, the given annotation is still
       * added to the collection.
       * @param {EMLAnnotation} annotation The EMLAnnotation to replace
       * duplicates with.
       */
      replaceDuplicateWith(annotation) {
        if (this.length && annotation.get("propertyURI")) {
          const duplicates = this.findWhere({
            propertyURI: annotation.get("propertyURI"),
          });
          this.remove(duplicates);
        }
        this.add(annotation);
      },

      /**
       * Find all annotations with the given propertyURI.
       * @param {string} propertyURI The propertyURI to search for.
       * @returns {EMLAnnotation[]} An array of EMLAnnotations with the given
       * propertyURI.
       * @since 0.0.0
       */
      findByProperty(propertyURI) {
        return this.where({ propertyURI });
      },

      /**
       * Adds canonical dataset annotations to this collection. A canonical
       * dataset is the one that is considered the authoritative version; the
       * current EML doc being essentially a duplicate version.
       * @param {string} sourceId The DOI or URL of the canonical dataset.
       * @returns {void}
       * @since 0.0.0
       */
      addCanonicalDatasetAnnotation(sourceId) {
        if (!sourceId) return null;
        // TODO: Check that sourceId is a valid DOI or URL

        // TODO: Check that there is not already a canonical dataset annotation
        // before adding a new one, since there should only be one.
        return this.add([
          {
            propertyLabel: "derivedFrom",
            propertyURI: PROV_WAS_DERIVED_FROM,
            valueLabel: sourceId,
            valueURI: sourceId,
          },
          {
            propertyLabel: "sameAs",
            propertyURI: SCHEMA_ORG_SAME_AS,
            valueLabel: sourceId,
            valueURI: sourceId,
          },
        ]);
      },

      /**
       * Find the annotations that make up the canonical dataset annotation. A
       * canonical dataset is identified by having both a "derivedFrom" and a
       * "sameAs" annotation with the same DOI or URL for the valueURI.
       * @returns {object} An object with the derivedFrom and sameAs
       * annotations.
       * @since 0.0.0
       */
      findCanonicalDatasetAnnotation() {
        // There must be at least one derivedFrom and one sameAs annotation
        // for this to have a canonical dataset annotation
        if (!this.length) return null;
        const derivedFrom = this.findByProperty(PROV_WAS_DERIVED_FROM);
        if (!derivedFrom?.length) return null;
        const sameAs = this.findByProperty(SCHEMA_ORG_SAME_AS);
        if (!sameAs?.length) return null;

        // Find all pairs that have matching valueURIs
        const pairs = [];
        derivedFrom.forEach((derived) => {
          sameAs.forEach((same) => {
            if (derived.get("valueURI") === same.get("valueURI")) {
              // TODO? Check that the URI is a valid DOI or URL
              pairs.push({ derived, same, uri: derived.get("valueURI") });
            }
          });
        });

        // If there are multiple pairs, we cannot determine which is the
        // canonical dataset.
        if (pairs.length > 1 || !pairs.length) return null;

        // There is only one pair, so return it
        return pairs[0];
      },

      /**
       * Updates the canonical dataset annotations to have the given ID. If
       * there is no canonical dataset annotation, one is added. If the ID is a
       * falsy value, the canonical dataset annotation is removed.
       * @param {string} newSourceId The DOI or URL of the canonical dataset.
       * @returns {object} An object with the derivedFrom and sameAs annotations
       * if the canonical dataset annotations were updated.
       * @since 0.0.0
       */
      updateCanonicalDataset(newSourceId) {
        if (!newSourceId) {
          this.removeCanonicalDatasetAnnotation();
          return null;
        }
        const canonical = this.findCanonicalDatasetAnnotation();
        if (!canonical) {
          return this.addCanonicalDatasetAnnotation(newSourceId);
        }

        const { derived, same, uri } = canonical;
        if (uri === newSourceId) return null;

        derived.set("valueURI", newSourceId);
        derived.set("valueLabel", newSourceId);
        same.set("valueURI", newSourceId);
        same.set("valueLabel", newSourceId);

        return [derived, same];
      },

      /**
       * Removes the canonical dataset annotations from this collection.
       * @returns {EMLAnnotation[]} The canonical dataset annotations that were
       * removed.
       * @since 0.0.0
       */
      removeCanonicalDatasetAnnotation() {
        const canonical = this.findCanonicalDatasetAnnotation();
        if (!canonical) return null;
        return this.remove([canonical.derived, canonical.same]);
      },

      /**
       * Returns the URI of the canonical dataset.
       * @returns {string} The URI of the canonical dataset.
       * @since 0.0.0
       */
      getCanonicalURI() {
        const canonical = this.findCanonicalDatasetAnnotation();
        return canonical?.uri;
      },
    },
  );

  return EMLAnnotations;
});
