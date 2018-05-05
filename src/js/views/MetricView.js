/*global define */
define(['jquery', 'underscore', 'backbone'],
    function($, _, Backbone) {
    'use strict';

    var MetricView = Backbone.View.extend({


        el: '#MetricView',

        events: {
            
        }

        initialize: function(options){
            if((typeof options == "undefined")) {
                var options = {};
            }
        },

        render: function(){
            console.log("hi");
		}
	});
	
	return MetricView;
});