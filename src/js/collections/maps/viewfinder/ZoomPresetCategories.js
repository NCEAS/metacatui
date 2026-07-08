/**
 * @class ZoomPresetCategories
 * @classdesc A collection of ZoomPresetCategory models. This collection was
 * deprecated in favor of generalized viewfinder cards collected in
 * viewfinderCardCategories in 2.37.0.
 * @classcategory Deprecated
 * @augments Backbone.Collection
 * @since 2.35.0
 * @deprecated since 2.37.0
 */

// Backward-compatibility alias. Use ViewfinderCardCategories instead.
define(["collections/maps/viewfinder/ViewfinderCardCategories"], (
  ViewfinderCardCategories,
) => ViewfinderCardCategories);
