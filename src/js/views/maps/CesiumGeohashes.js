define(["backbone",
        "cesium",
        "nGeohash",
        "models/maps/assets/CesiumGeohash"],
  function(Backbone, Cesium, geohash, CesiumGeohash){

    return Backbone.View.extend({

        cesiumViewer: null,

        /**
         * A reference to the CesiumGeohash MapAsset model that is rendered in this view
         * @type CesiumGeohash
         */
        cesiumGeohash: null,
        
        render: function(){

            //If there is no CesiumGeohash model, exit without rendering
            if(!this.cesiumGeohash){
                return;
            }

           this.entities = this.cesiumGeohash.get("cesiumModel").entities;

            if(this.cesiumGeohash.get('status') == "ready"){
               this.drawGeohashes();
            }

            //When the status changes, re-render this view
            this.listenTo(this.cesiumGeohash, "change:status", this.drawGeohashes);

            this.listenToMovement();

        },

        /**
         * Listens to Cesium Camera movement so the geohash level can change when the camera zooms in
         */
        listenToMovement: function(){
            //Listen to camera movement to change the geohash level
            let view = this;
            this.cesiumViewer.scene.camera.moveEnd.addEventListener(function () {
                //Get the position of the Cesium camera
                let c = Cesium.Cartographic.fromCartesian(new Cesium.Cartesian3(view.cesiumViewer.scene.camera.position.x, view.cesiumViewer.scene.camera.position.y, view.cesiumViewer.scene.camera.position.z))
                //Set the geohash level based on the camera position height
                view.cesiumGeohash.setGeohashLevel(c.height);
            });
        },
        
        drawGeohashes: function(){

            let polygon,
                entities = this.entities,
                dataSource = this.dataSource,
                viewer = this.cesiumViewer,
                hue = this.cesiumGeohash.get("hue");

            //If there is no CesiumGeohash model, exit without rendering
            if(!this.cesiumGeohash){
                return;
            }        

            //Remove all the Entities from the Cesium layer
            entities.removeAll();

            let counts = this.cesiumGeohash.get("geohashCounts");

            for(let i=0; i < counts.length; i+=2){
          
              let hash = counts[i],
                  bbox = geohash.decode_bbox(hash),
                  count = counts[i+1],
                  alpha = count/this.cesiumGeohash.get("totalCount") + 0.5;
          
              let polygon = entities.add({
                  polygon : {
                  hierarchy : Cesium.Cartesian3.fromDegreesArray([ 
                          bbox[1], bbox[0],
                          bbox[3], bbox[0],  
                          bbox[3], bbox[2],
                          bbox[1], bbox[2] ]),
                  height : 1000,
                  material : Cesium.Color.fromHsl(hue/360, 0.5, 0.6, alpha),
                  outline : true,
                  outlineColor : Cesium.Color.WHITE
                },
                show: true
              });
          
              let label = entities.add({
                position : Cesium.Cartesian3.fromDegrees((bbox[3]+bbox[1])/2, (bbox[2]+bbox[0])/2),
                label : {
                    text : count.toString(),
                    font : '14pt monospace',
                    style: Cesium.LabelStyle.FILL,
                    outlineWidth : 0,
                    scaleByDistance : new Cesium.NearFarScalar(1.5e2, 5.0, 8.0e6, 0.7)
                },
                show: true
              });
          
            }

            viewer.dataSourceDisplay.dataSources.add(this.cesiumGeohash.get("cesiumModel"))

        }
          

    });

});