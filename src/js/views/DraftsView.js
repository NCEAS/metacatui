define(["jquery", "underscore", "backbone", "localforage", "clipboard", "text!templates/draftsTemplate.html"],
  function($, _, Backbone, LocalForage, Clipboard, draftsTemplate){
    var view = Backbone.View.extend({
      type: "DraftsView",
      el: "#Content",
      className: "div",
      template: _.template(draftsTemplate),

      initialize: function() {
        return this;
      },

      render: function() {
        var view = this;
        var drafts = [];

        LocalForage.iterate(function(value, key, iterationNumber) {
          // Extract each draft
          drafts.push({
            key: key,
            value: value
          });
        }).then(function(){
          // Sort by datetime
          drafts = _.sortBy(drafts, function(draft) {
            return draft.value.datetime.toString();
          }).reverse();
        }).then(function() {
          // Render
          view.$el.html(
            view.template({
              drafts: drafts
            })
          );

          // Insert copiables
          view.insertCopiables();
        }).catch(function(err) {
          console.log(err);
          view.$el.html("<div>There was an error listing drafts.</div>");
        });

        return this;
      },

      insertCopiables: function() {
        var copiables = $(".copy-to-clipboard");

        _.each(copiables, function(copiable, i) {
          var clipboard = new Clipboard(copiable,
            {
              text: function(trigger) {
                return $("#draft-" + i).text()
              }
            });

          clipboard.on("success", function(e) {
            var el = $(e.trigger);

            $(el).html( $(document.createElement("span")).addClass("icon icon-ok success") );

            // Use setTimeout instead of jQuery's built-in Events system because
            // it didn't look flexible enough to allow me update innerHTML in
            // a chain
            setTimeout(function() {
              $(el).html('<i class="icon icon-copy"></i> Copy Draft to Clipboard');
            }, 500)
          });
        });
      }
    })

    return view;

  });
