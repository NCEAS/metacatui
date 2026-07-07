/**
 * @class ZoomPresets
 * @classdesc A collection of ZoomPresetModel models. This collection was
 * deprecated in favor of generalized viewfinder cards in 0.0.0.
 * @classcategory Deprecated
 * @augments Backbone.Collection
 * @since 2.29.0
 * @deprecated since 0.0.0
 */

// Backward-compatibility alias. Use ViewfinderCards instead.
define(["collections/maps/viewfinder/ViewfinderCards"], (ViewfinderCards) =>
  ViewfinderCards);
