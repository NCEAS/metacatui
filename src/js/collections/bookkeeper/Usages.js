"use strict";

define(["jquery", "underscore", "backbone", "models/bookkeeper/Usage", "models/bookkeeper/Quota"],
  function($, _, Backbone, Usage, Quota) {

  /**
   * @class Usages
   * @classdesc A Usages collection is a collection of Usage Models which track
   * objects that use a portion of a Quota. Each Quota is associated with one or more
   * Usage models, so this collection keeps all those associated Usages together in one collection.
   * This collection also stores a reference to the Quota model associated with these Usages.
   */
  var Usages = Backbone.Collection.extend(
    /** @lends Usages.prototype */ {

    /**
    * The class/model that is contained in this collection.
    * @type {Backbone.Model}
    */
    model: Usage,

    /**
    * A reference to a Quota model that this collection of Usages is associated with.
    * @type {Quota}
    */
    quota: null

  });

  return Usages;
});
