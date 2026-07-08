/**
 * @class ZoomPresetCategory
 * @classdesc A category for organizing zoom presets in the viewfinder.
 * Deprecated in favor of generalized viewfinder cards in 2.37.0.
 * @classcategory Deprecated
 * @augments Backbone.Model
 * @since 2.35.0
 * @deprecated since 2.37.0
 */

// Backward-compatibility alias. Use ViewfinderCardCategory instead.
define(["models/maps/viewfinder/ViewfinderCardCategory"], (
  ViewfinderCardCategory,
) => ViewfinderCardCategory);
