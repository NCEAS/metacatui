define(["jquery",
        "backbone",
        "nGeohash",
        "models/maps/CesiumGeohashes"],
  function($, Backbone, geohash, CesiumGeohashes){

    return Backbone.View.extend({

        cesiumViewer: null,
        
        render: function(){



        },
        
        drawGeohashes: function(){
            let polygon,
                viewer = this.cesiumViewer;

            bboxes(-90,-180,90,180,2).forEach( (hash) => {
          
              let bbox = geohash.decode_bbox(hash),
                  count = parseInt(Math.random()*100),
                  alpha = count/100+0.3;
          
              polygon = viewer.entities.add({
                polygon : {
                  hierarchy : Cesium.Cartesian3.fromDegreesArray([ 
                    bbox[1], bbox[0],
                      bbox[3], bbox[0],  
                      bbox[3], bbox[2],
                      bbox[1], bbox[2] ]),
                  height : 1000,
                  material : Cesium.Color.fromHsl(Math.floor(Math.random() * 360)/360, 0.5, 0.6, 0.5),
                  outline : true,
                  outlineColor : Cesium.Color.WHITE
                }
              });
          
              let label = viewer.entities.add({
                position : Cesium.Cartesian3.fromDegrees((bbox[3]+bbox[1])/2, (bbox[2]+bbox[0])/2),
                label : {
                    text : hash,
                    font : '14pt monospace',
                    style: Cesium.LabelStyle.FILL,
                    outlineWidth : 0,
                    scaleByDistance : new Cesium.NearFarScalar(1.5e2, 5.0, 8.0e6, 0.7)
                }
              });
          
            });
        }
          

    });

});