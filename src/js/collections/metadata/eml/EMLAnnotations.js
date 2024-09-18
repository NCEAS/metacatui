"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "models/metadata/eml211/EMLAnnotation",
], function ($, _, Backbone, EMLAnnotation) {
  /**
   * @class EMLAnnotations
   * @classdesc A collection of EMLAnnotations.
   * @classcategory Collections/Metadata/EML
   * @since 2.19.0
   * @extends Backbone.Collection
   */
  var EMLAnnotations = Backbone.Collection.extend(
    /** @lends EMLAnnotations.prototype */
    {
      /**
       * The reference to the model class that this collection is made of.
       * @type EMLAnnotation
       * @since 2.19.0
       */
      model: EMLAnnotation,

      /**
       * Checks if this collection already has an annotation for the same property URI.
       * @param {EMLAnnotation} annotation The EMLAnnotation to compare against the annotations already in this collection.
       * @returns {Boolean} Returns true is this collection already has an annotation for this property.
       * @since 2.19.0
       */
      hasDuplicateOf: function (annotation) {
        try {
          //If there is at least one model in this collection and there is a propertyURI set on the given model,
          if (this.length && annotation.get("propertyURI")) {
            //Return whether or not there is a duplicate
            let properties = this.pluck("propertyURI");
            return properties.includes(annotation.get("propertyURI"));
          }
          //If this collection is empty or the propertyURI is falsey, return false
          else {
            return false;
          }
        } catch (e) {
          console.error("Could not check for a duplicate annotation: ", e);
          return false;
        }
      },

      /**
       * Removes the EMLAnnotation from this collection that has the same propertyURI as the given annotation.
       * Then adds the given annotation to the collection. If no duplicate is found, the given annotation is still added
       * to the collection.
       * @param {EMLAnnotation} annotation
       * @since 2.19.0
       */
      replaceDuplicateWith: function (annotation) {
        try {
          if (this.length && annotation.get("propertyURI")) {
            let duplicates = this.findWhere({
              propertyURI: annotation.get("propertyURI"),
            });
            this.remove(duplicates);
          }

          this.add(annotation);
        } catch (e) {
          console.error(
            "Could not replace the EMLAnnotation in the collection: ",
            e,
          );
        }
      },
    },
  );

  return EMLAnnotations;
});
