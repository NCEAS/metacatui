/*global define */
define(['jquery', 'underscore', 'backbone', 'gmaps'], 				
	function($, _, Backbone, gmaps) {
	'use strict';

	// Map Model
	// ------------------
	var Map = Backbone.Model.extend({
		// This model contains all of the map settings used for searching datasets
		defaults: function(){
			return {
				map: null,
				
				//The options for the map using the Google Maps API MapOptions syntax
				mapOptions: function(){
					if(gmaps)
						return {  
							zoom: 3,
							minZoom: 3,
						    center: new google.maps.LatLng(44, -103),
							disableDefaultUI: true,
						    zoomControl: true,
						    zoomControlOptions: {
							          style: google.maps.ZoomControlStyle.SMALL,
							          position: google.maps.ControlPosition.LEFT_BOTTOM
							        },
							panControl: false,
							scaleControl: false,
							streetViewControl: false,
							mapTypeControl: true,
							mapTypeControlOptions:{
									position: google.maps.ControlPosition.LEFT_BOTTOM
							},
						    mapTypeId: google.maps.MapTypeId.TERRAIN
						} 
					else
						return null;
				}
				
				//Set to true to draw markers where tile counts are equal to 1. If set to false, a tile with the count "1" will be drawn instead.
				drawMarkers: false,
				
				//If this theme doesn't have an image in this location, Google maps will use their default marker image
				markerImage: "./js/themes/" + theme + "/img/map-marker.png",
				
				maxZoom: function(){
					return {
						terrain   : 15,
						satellite : 19
					}
				},
				
				//Keep track of the geohash level used to draw tiles on this map
				tileGeohashLevel: 1,
				
				///****** MAP TILE OPTIONS **********//
				//The options for the tiles. Using Google Maps Web API
				tileOptions: function(){
					return {
				      strokeWeight: 0,
				      fillOpacity: 0.6
					}
				},		
				
				//The options for the tiles when they are hovered on. Using Google Maps Web API
				tileOnHover: function(){
					return {
						opacity: 0.8,
						strokeColor: "#FFFFFF",
						fillColor: "#FFFFFF",
						strokeWeight: 1
					}
				},			
				
				//The options for the tile text 
				tileLabelColorOnHover: '#333333',			
				tileLabelColor: '#FFFFFF',
				
				//The tile colors - there are 5 levels of color, with level1 representing tiles with a relatively LOW count of datasets and level5 representing tiles with the HIGHEST amount of datasets
				tileColors: function(){
					return {
						level1: "#24ADE3",
						level2: "#1E92CB",
						level3: "#186E91",
						level4: "#12536D",
						level5: "#092F3E"
					}
				}
			}
		},
		
		isMaxZoom: function(map){
			var zoom = map.getZoom(),
				type = map.getMapTypeId();
			
			if(zoom >= this.get("maxZoom")[type]) return true;
			else return false;
		},
		
		/**
		 * This function will return the appropriate geohash level to use for mapping geohash tiles on the map at the specified zoom level.
		 */ 
		determineGeohashLevel: function(zoom){
			var geohashLevel;
			
			switch(zoom){
				case 0: // The whole world zoom level
					geohashLevel = 2;
					break;
				case 1:
					geohashLevel = 2;
					break;
				case 2:
					geohashLevel = 2;
					break;
				case 3:
					geohashLevel = 2;
					break;
				case 4:
					geohashLevel = 2;
					break;
				case 5:
					geohashLevel = 3;
					break;
				case 6:
					geohashLevel = 3;
					break;
				case 7:
					geohashLevel = 4;
					break;
				case 8:
					geohashLevel = 4;
					break;
				case 9:
					geohashLevel = 4;
					break;
				case 10:
					geohashLevel = 5;
					break;
				case 11:
					geohashLevel = 5;
					break;
				case 12:
					geohashLevel = 6;
					break;
				case 13:
					geohashLevel = 6;
					break;
				case 14:
					geohashLevel = 7;
					break;
				case 15:
					geohashLevel = 7;
					break;
				case 16:
					geohashLevel = 8;
					break;
				case 17:
					geohashLevel = 9;
					break;
				case 18:
					geohashLevel = 9;
					break;
				case 19:
					geohashLevel = 9;
					break;
				case 20:
					geohashLevel = 9;
					break;
				default:  //Anything over (Gmaps goes up to 19)
					geohashLevel = 9;
			}
			
			return geohashLevel;
		},
		
		getSearchPrecision: function(zoom){
			if(zoom <= 5) return 2;
			else if(zoom <= 7) return 3;
			else if (zoom <= 11) return 4;
			else if (zoom <= 13) return 5;
			else if (zoom <= 15) return 6;
			else return 7;
		},
		
		clear: function() {
		    return this.set(_.clone(this.defaults()));
		  }
		
	});
	return Map;
});
