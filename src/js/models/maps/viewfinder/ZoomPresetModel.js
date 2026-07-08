/**
 * @class ZoomPresetModel
 * @classdesc A model for representing a single zoom preset in the viewfinder.
 * Deprecated in favor of generalized viewfinder cards in 2.37.0.
 * @classcategory Deprecated
 * @since 2.29.0
 * @deprecated since 2.37.0
 */

// Backward-compatibility alias. Use ViewfinderCardModel instead.
define(["models/maps/viewfinder/ViewfinderCardModel"], (ViewfinderCardModel) =>
  ViewfinderCardModel);
