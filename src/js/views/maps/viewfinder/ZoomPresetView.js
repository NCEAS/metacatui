/**
 * @class ZoomPresetView
 * @classdesc A view for displaying a single zoom preset in the viewfinder.
 * Deprecated in favor of generalized viewfinder cards in 2.37.0.
 * @classcategory Deprecated
 * @augments Backbone.View
 * @screenshot views/maps/viewfinder/ZoomPresetView.png
 * @since 2.29.0
 * @deprecated since 2.37.0
 */
// Backward-compatibility alias. Use ViewfinderCardView instead.
define(["views/maps/viewfinder/ViewfinderCardView"], (ViewfinderCardView) =>
  ViewfinderCardView);
