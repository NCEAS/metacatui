"use strict";

define(["underscore", "backbone", "models/metadata/eml211/EMLAnnotation"], (
  _,
  Backbone,
  EMLAnnotation,
) => {
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
    },
  );

  return EMLAnnotations;
});
