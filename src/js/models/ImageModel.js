/* global define */
define(['jquery', 'underscore', 'backbone'],
    function($, _, Backbone) {

	var ImageModel = Backbone.Model.extend({

		defaults: {
      id: null,
      attribution: null,
      license: null,
      caption: null,
			type: null,
			imageURL: null
		},

		initialize: function(options){

		},

    url: function(){
			return MetacatUI.appModel.get("objectServiceUrl") + encodeURIComponent(this.get("id"));
		},

    fetch: function(){
      var model = this;
      var requestSettings = {
        url: this.url(),
        error: function(){
          model.trigger('error');
        }
      }

      //Add the authorization header and other AJAX settings
      requestSettings = _.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings());
      return Backbone.Model.prototype.fetch.call(this, requestSettings);
    }
	});

	return ImageModel;
});
