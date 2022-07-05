define(["backbone"], function(Backbone){

    /**
     * @classdesc A CesiumGeohashes Model is a layer of Cesium polygon entities that can be used in
     * Cesium maps. See
     * @classcategory Models/Maps/Assets
     * @class CesiumGeohashes
     * @name CesiumGeohashes
     * @extends MapAsset
     * @since 2.X
     * @constructor
    */
    return MapAsset.extend(
    /** @lends CesiumGeohashes.prototype */ {

        /**
         * Default attributes for CesiumGeohashes models
         * @name CesiumGeohashes#defaults
         * @extends MapAsset#defaults
         * @type {Object}
         * */
        defaults: function(){
            return {
                geohashLevel: 2
            }
        }
    });
});