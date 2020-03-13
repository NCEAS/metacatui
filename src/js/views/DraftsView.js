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
            value: value,
            fileName: (typeof value.title === "string") ?
              value.title.substr(0, 50).replace(/[^a-zA-Z0-9_]/, "_") : "draft"
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

          // Insert downloadables
          view.insertDownloadables();
          // Insert copiables
          view.insertCopiables();
        }).catch(function(err) {
          console.log(err);
          view.$el.html("<div>There was an error listing drafts.</div>");
        });

        return this;
      },

      // Attach a click handler for download buttons that triggers the draft
      // to be downloaded
      insertDownloadables: function() {
        var view = this;

        _.each(this.$el.find(".draft-download"), function(el) {
          var a = $(el).find("a.download");

          var text = $(el).find("textarea")[0].value;
          var fileName = a.data("filename") || "draft.xml";

          $(a).on("click", view.createDownloader(text, fileName));
        });
      },

      // Creates a function for use as an event handler in insertDownloadables
      // that creates a closure around the content (text) and filename and
      // causes the browser to download the draft when clicked
      createDownloader: function(text, fileName) {
        return function() {
          var blob = new Blob([text], { type: "application/xml" })
          var url = window.URL.createObjectURL(blob);

          var a = document.createElement("a");
          a.style = "display: none;";
          a.href = url;
          a.download = fileName;
          a.click();
          a.remove();
        }
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
              $(el).html('<i class="icon icon-copy"></i> Copy to Clipboard');
            }, 500)
          });
        });
      }
    })

    return view;

  });
