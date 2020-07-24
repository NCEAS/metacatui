define(["underscore",
        "jquery",
        "backbone",
        "woofmark",
        "views/ImageUploaderView",
        "views/MarkdownView",
        "views/TableEditorView",
        "text!templates/markdownEditor.html"],
function(_, $, Backbone, Woofmark, ImageUploader, MarkdownView, TableEditor, Template){

  /**
  * @class MarkdownEditorView
  * @classdesc A view of an HTML textarea with markdown editor UI and preview tab
  * @extends Backbone.View
  * @constructor
  */
  var MarkdownEditorView = Backbone.View.extend(
    /** @lends MarkdownEditorView.prototype */{

    /**
    * The type of View this is
    * @type {string}
    * @readonly
    */
    type: "MarkdownEditor",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: "markdown-editor",

    /**
    * References to templates for this view. HTML files are converted to
    * Underscore.js templates
    * @type {Underscore.Template}
    */
    template: _.template(Template),

    /**
    * Markdown to insert into the textarea when the view is first rendered
    * @type {string}
    */
    markdown: "",

    /**
    * The placeholder text to display in the textarea when it's empty
    * @type {string}
    */
    markdownPlaceholder: "",

    /**
    * The placeholder text to display in the preview area when there's no
    * markdown
    * @type {string}
    */
    previewPlaceholder: "",

    /**
    * Indicates whether or not to render a table of contents for the markdown
    * preview. If set to true, a table of contents will be shown in the preview
    * if there two or more top-level headers are rendered from the markdown.
    * @type {boolean}
    */
    showTOC: false,

    /**
    * A jQuery selector for the HTML textarea element that will contain the
    * markdown text.
    * @type {string}
    */
    textarea: ".markdown-textarea",

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
      "click #markdown-preview-link"   :    "previewMarkdown",
      "focusout .markdown-textarea"    :    "updateMarkdown"
    },

    /**
    * Initialize is executed when a new markdownEditor is created.
    * @param {Object} options - A literal object with options to pass to the view
    */
    initialize: function(options){
      if(typeof options !== "undefined"){
          this.markdown            =  options.markdown            || "";
          this.markdownPlaceholder =  options.markdownPlaceholder || "";
          this.previewPlaceholder  =  options.previewPlaceholder  || "";
          this.showTOC             =  options.showTOC             || false;
      }
    },

    /**
     * render - Renders the markdownEditor - add UI for adding and editing
     * markdown to a textarea
     */
    render: function(){

      try {

        // Save the view
        var view = this;

        // Insert the template into the view
        this.$el.html(this.template({
          markdown: this.markdown || "",
          markdownPlaceholder: this.markdownPlaceholder || "",
          previewPlaceholder: this.previewPlaceholder || "",
          cid: this.cid
        })).data("view", this);
        // The textarea element that the markdown editor buttons & functions will edit
        var textarea = this.$(this.textarea)[0];
        if(!textarea){
          console.log("error: the markdown editor view was not rendered because no textarea element was found.");
          return
        }

        // Set woofmark options. See https://github.com/bevacqua/woofmark
        var woofmarkOptions =
          {
              fencing: true,
              html: false,
              wysiwyg: false,
              defaultMode: "markdown",
              render: {
                // Hide buttons that switch between markdown, WYSIWYG, & HTML for now
                modes: function (button, id) {
                  button.remove();
                }
              }
          };

        // Set options for all the buttons that will be shown in the toolbar.
        // Buttons will be shown in the order they are listed.
        // Defaults from Woofmark will be used unless they are replaced here,
        // see: https://github.com/bevacqua/woofmark/blob/master/src/strings.js.
        // They key is the ID for the button.
        //    remove: if set to true, the button will be removed (use this to hide default woofmark buttons)
        //    icon: the name of the font awesome icon to show in the button. If no button or svg is set, the ID/key will be displayed instead.
        //    svg: svg code to show in the button. If no button or svg is set, the ID/key will be displayed instead.
        //    title: The title to show on hover
        //    function: The function to call when the button is pressed. It will be passed chunks, cmd, e (see Woofmark docs), plus the ID/key. Called with view as the this (context).
        //    shortcut: The keyboard shortcut to use for the button. This will only work if there is also a custom function set.
        //    insertDividerAfter: If set to true, a visual divider will be placed after this button.
        var buttonOptions = {
          // Default woofmark buttons to remove
          attachment: {
            remove: true
          },
          heading: {
            remove: true
          },
          hr: {
            remove: true
          },
          // Remove the default image uploader button so we can add our own that
          // uploads the image as a dataone object.
          image: {
            remove: true
          },
          // Default woofmark buttons to keep, with custom properties, + custom buttons
          bold: {
            icon: "bold"
          },
          italic: {
            icon: "italic",
          },
          strike: {
            title: "Strikethrough",
            icon: "strikethrough",
            shortcut: "Ctrl+X",
            function: view.strikethrough,
            insertDividerAfter: true
          },
          h1: {
            svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 2.9V0h7.8v2.9l-2 .5v7h7.7v-7l-2-.5V0h7.7v2.9l-2 .5v17.2l2 .5V24h-7.8v-2.9l2-.5V14H5.9v6.6l2 .5V24H0v-2.9l2-.5V3.4z"/><path fill-rule="nonzero" d="M24 16.4v-1.9h-1.4V5.8h-4.1v1.8H20v7h-1.4v1.8z"/></svg>`,
            title: "Top-level heading",
            function: view.addHeader
          },
          h2: {
            svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="nonzero" d="M23.2 17.3l.1-3.1h-2v1.3H18c.1-.7.8-1.5 2-2.2L22 12a4 4 0 001-1l.3-1.5c0-.9-.3-1.6-1-2.1-.6-.5-1.5-.8-2.6-.8-1.3 0-2.2.3-2.9 1-.6.6-1 1.5-1 2.8l2.2.1c0-.8.2-1.3.4-1.7.3-.3.6-.5 1.1-.5.4 0 .7.1.9.3.2.2.3.5.3.8 0 .4-.1.7-.4 1-.2.4-.6.7-1.1 1a17 17 0 00-2.1 1.9c-.5.5-.8 1-1 1.6-.3.6-.4 1.4-.4 2.3h7.6z"/><path d="M.5 4.6V2.3h6.3v2.3L5.2 5v5.6h6.2V5l-1.6-.4V2.3H16v2.3l-1.6.4v14l1.6.4v2.3H9.8v-2.3l1.6-.4v-5.3H5.2V19l1.6.4v2.3H.5v-2.3l1.6-.4V5z"/></svg>`,
            title: "Second-level heading",
            function: view.addHeader
          },
          h3: {
            svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill-rule="nonzero" d="M18.1 17.3c.7 0 1.4-.1 2-.4.6-.2 1-.6 1.4-1 .3-.6.5-1.1.5-1.7 0-1.2-.7-2-2-2.5 1-.5 1.6-1.2 1.6-2.2 0-.9-.4-1.6-1-2-.6-.6-1.5-.8-2.6-.8-1 0-1.9.3-2.5.8a3 3 0 00-1 2.2l2.1.1c0-.9.4-1.3 1.3-1.3.3 0 .6 0 .9.3.2.2.3.4.3.8s-.2.7-.5.9a3 3 0 01-1.5.3v1.9h.6c.5 0 1 0 1.2.3.3.3.5.7.5 1 0 .5-.2.8-.4 1.1-.3.3-.7.5-1.1.5-1 0-1.5-.6-1.5-1.8l-2.2.1c.1 2.3 1.4 3.4 4 3.4z"/><path d="M2 6.6V4.8h4.7v1.8l-1.2.3V11H10V6.9l-1.2-.3V4.8h4.6v1.8l-1.2.3V17l1.2.3v1.8H8.9v-1.8l1.2-.3v-3.9H5.5v4l1.2.2v1.8H2v-1.8l1.2-.3V7z"/></svg>`,
            title: "Tertiary heading",
            function: view.addHeader,
            insertDividerAfter: true
          },
          divider: {
            svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="22" height="3" x="1" y="10.58" fill-rule="evenodd"/></svg>`,
            function: view.addDivider,
            title: "Top-level heading",
            shortcut: "Ctrl+Enter"
          },
          ol: {
            title: "Ordered list",
            icon: "list-ol",
          },
          ul: {
            title: "Un-ordered list",
            icon: "list-ul",
            insertDividerAfter: true
          },
          quote: {
            icon: "quote-left",
          },
          code: {
            icon: "code",
            insertDividerAfter: true
          },
          link: {
            icon: "link"
          },
          d1Image: {
            icon: "picture",
            function: view.addMdImage,
            title: 'Image',
            // use Ctrl+G to overwrite the built-in woofmark image function
            shortcut: "Ctrl+G"
          },
          table: {
            icon: "table",
            function: view.addTable,
            shortcut: "Ctrl+T",
            insertDividerAfter: true
          }
        }

        var buttonKeys = Object.keys(buttonOptions);

        // PRE-RENDER WOOFMARK
        // Set titles on buttons before the Woofmark text editor is rendered.
        // This way we can use Woofmark's build in functionality to convert "Ctrl"
        // to "Cmd" symbol if user is on mac.
        _.each(buttonKeys, function(key, i) {
          var options = buttonOptions[key],
              title = options.title || key.charAt(0).toUpperCase() + key.slice(1),
              presetShortcut = Woofmark.strings.titles[key] ? Woofmark.strings.titles[key].match(/Ctrl\+.*$/)[0] : "",
              shortcut = options.shortcut || presetShortcut;
          if(title){
            Woofmark.strings.titles[key] = [title, shortcut].join(" ")
          }
          // So that we can identify buttons that we want to manipulate after
          // they are rendered, use the key as the button text for now.
          Woofmark.strings.buttons[key] = key;
        }, this);

        // RENDER WOOFMARK
        // Initialize the woofmark markdown editor
        this.markdownEditor = Woofmark(textarea, woofmarkOptions);

        // POST-RENDER WOOFMARK
        // After the markdown editor is initialized..

        // Add custom functions
        _.each(buttonKeys, function(key, i) {
          var options = buttonOptions[key];
          if(options.function){
            // addCommandButton uses cmd, not ctrl
            var shortcut = ""
            if(options.shortcut){
              shortcut = options.shortcut.replace("Ctrl", "cmd");
            }
            view.markdownEditor.addCommandButton(key, shortcut, function(e, mode, chunks){
              options.function.call(view, e, mode, chunks, key)
            })
          }
        });

        // Modify the button order & appearance
        var buttonContainer = $(view.markdownEditor.textarea).parent().find(".wk-commands");
        var buttons = buttonContainer.find(".wk-command");
        _.each(buttonKeys, function(key, i) {
          // Re-order buttons based on the order in buttonOptions, and remove
          // any that are marked for removal
          var options = buttonOptions[key];
          var buttonEl = buttonContainer.find(".wk-command").filter(function (){
              return this.innerHTML == key;
          });
          if(options.remove !== true){
            // Add tooltip
            buttonEl.tooltip({
      				placement: "top",
      				delay: 500,
              trigger: "hover"
      			});
            // Add font awesome icon or SVG
            if(options.icon){
              buttonEl.html("<i class='icon-" +options.icon + "'></i>");
            } else if (options.svg){
              buttonEl.html(options.svg);
              buttonEl.find("svg").height("13px").width("auto");
            }
            buttonContainer.append(buttonEl);
            if(options.insertDividerAfter === true ){
              buttonContainer.append("<div class='wk-commands-divider'></div>")
            }
          } else {
            buttonEl.remove();
          }
        });

      } catch (e) {
        console.log(e);
        console.log("Failed to render the markdown editor UI, error message: " + e );
      }

    },

    /**
     * addHeader - description
     *
     * @param  {event}  e      is the original event object
     * @param  {string} mode   can be markdown, html, or wysiwyg
     * @param  {object} chunks is a chunks object, describing the current state of the editor, see https://github.com/bevacqua/woofmark#chunks
     * @param  {string} id     the ID of the function, set as they key in buttonOptions in the render function
     */
    addHeader: function(e, mode, chunks, id){

      // Get the header level from the ID
      var levelToCreate = parseInt(id.replace( /^\D+/g, ''));

      chunks.selection = chunks.selection
        .replace(/\s+/g, ' ')
        .replace(/(^\s+|\s+$)/g, '');

      if (!chunks.selection) {
        chunks.startTag = new Array(levelToCreate + 1).join('#') + ' ';
        chunks.selection = Woofmark.strings.placeholders.heading;
        chunks.endTag = '';
        chunks.skip({ before: 1, after: 1 });
        return;
      }

      chunks.findTags(/#+[ ]*/, /[ ]*#+/);

      if (/#+/.test(chunks.startTag)) {
        level = RegExp.lastMatch.length;
      }

      chunks.startTag = chunks.endTag = '';
      chunks.findTags(null, /\s?(-+|=+)/);

      if (/=+/.test(chunks.endTag)) {
        level = 1;
      }

      if (/-+/.test(chunks.endTag)) {
        level = 2;
      }

      chunks.startTag = chunks.endTag = '';
      chunks.skip({ before: 1, after: 1 });

      if (levelToCreate > 0) {
        chunks.startTag = new Array(levelToCreate + 1).join('#') + ' ';
      }

    },

    /**
     * addDivider - Add or remove a divider
     *
     * @param  {event} e      is the original event object
     * @param  {string} mode   can be markdown, html, or wysiwyg
     * @param  {object} chunks is a chunks object, describing the current state of the editor, see https://github.com/bevacqua/woofmark#chunks
     */
    addDivider: function(e, mode, chunks){

      // If the selection includes a divider, remove it
      var markdown = chunks.before + chunks.selection + chunks.after;
      var startSel = chunks.before.length;
      var endSel = startSel + chunks.selection.length + 1;
      var dividerRE = /(\r\n|\r|\n){2}-{3,}/gm;
      var dividerDeleted = false;
      while((match = dividerRE.exec(markdown)) !== null) {
        // +1 so that we don't delete the divider if selection is at the newlines before a divider
        var startDivider = match.index + 2;
        // +1 so that if the selection is at the end of a divider, it will still be deleted
        var endDivider = match.index + match[0].length + 1;
        if((endSel > startDivider && endSel <= endDivider) || (startSel < endDivider && startSel >= startDivider)){
          tableString = match[0];
          chunks.before = markdown.slice(0,startDivider-2) + "\n";
          chunks.selection = "";
          chunks.after = markdown.slice(endDivider);
          dividerDeleted = true;
          break;
        }
      }
      // If the divider was not deleted (therefore not detected), then add one
      if(!dividerDeleted){
        var dividerToAdd = "\n\n--------------------\n";
        if(/(\r\n|\r|\n){1}$/.test(chunks.before)){
          dividerToAdd = "\n--------------------\n";
        }
        chunks.before = chunks.before + dividerToAdd
      }
    },

    /**
     * addTable - Creates the UI for editing and adding tables to the textarea.
     * Detects whether the selection contained any part of a markdown table,
     * then opens a woofmark dialog box and inserts a table editor view. If a
     * table was selected, the table information is imported into the table
     * editor where the user can edit it. If no table was selected, then it
     * creates an empty table where the user can add data.
     *
     * @param  {event} e      is the original event object
     * @param  {string} mode   can be markdown, html, or wysiwyg
     * @param  {object} chunks is a chunks object, describing the current state of the editor, see https://github.com/bevacqua/woofmark#chunks
     */
    addTable: function(e, mode, chunks){

      // Use a modified version of the link dialog
      this.markdownEditor.showLinkDialog();

      // Select the image upload dialog elements so that we can customize it
      var dialog = $(".wk-prompt"),
          dialogContent = dialog.find(".wk-prompt-input-container"),
          dialogTitle = dialog.find(".wk-prompt-title"),
          dialogDescription = dialog.find(".wk-prompt-description"),
          dialogOkBtn = dialog.find(".wk-prompt-ok");

      // Detect whether the selection includes a markdown table.
      // If it does, ensure the complete table is selected, and save the
      // markdown table string segment to be parsed.
      var markdown = chunks.before + chunks.selection + chunks.after;
      var startSel = chunks.before.length;
      var endSel = startSel + chunks.selection.length + 1;
      var tableRE = /((\|[^|\r\n]*)+\|(\r?\n|\r)?)+((?:\s*\|\s*:?\s*[-=]+\s*:?\s*)+\|)(\n\s*(?:\|[^\n]+\|\r?\n?)*)?$/gm;
      // The regular expression used by showdown to detect tables:
      // var tableRE = /^ {0,3}\|?.+\|.+\n {0,3}\|?[ \t]*:?[ \t]*(?:[-=]){2,}[ \t]*:?[ \t]*\|[ \t]*:?[ \t]*(?:[-=]){2,}[\s\S]+?(?:\n\n|¨0)/gm;
      var tables = markdown.match(tableRE);
      var tableString = "";
      while((match = tableRE.exec(markdown)) !== null) {
        var startTab = match.index;
        var endTab = match.index + match[0].length;
        if((endSel > startTab && endSel <= endTab) || (startSel < endTab && startSel >= startTab)){
          tableString = match[0];
          chunks.before = markdown.slice(0,startTab);
          chunks.selection = markdown.slice(startTab, endTab);
          chunks.after = markdown.slice(endTab);
          // Just use the first table match in which there is also at least partial selection
          break;
        }
      }

      // Clone the chunks object at this point in case the textarea loses focus
      // and the selection changes before the "ok" buttons is pressed
      const chunksClone = JSON.parse(JSON.stringify(chunks));

      // Add a table editor view.
      // Pass the parsesd markdown table, if there is one
      var tableEditor = new TableEditor({
        markdown: tableString
      });
      // Render the table editor
      tableEditor.render();
      // Add the rendered table editor to the dialog, update the dialog.
      dialogContent.html(tableEditor.el);
      dialogDescription.remove();
      dialogTitle.text("Insert Table");

      // Listen for when the OK button is clicked. Attach listener to the dialog
      // so that it's destroyed when the dialog is destroyed. It won't be called
      // if the user presses cancel.
      var view = this;
      dialogOkBtn.off('click');
      dialogOkBtn.on('click', function insertText(event) {
        var tableMarkdown = tableEditor.getMarkdown();
        view.markdownEditor.runCommand( function(chunks, mode){
          chunks.before = chunksClone.before;
          chunks.after = chunksClone.after;
          chunks.selection = tableMarkdown;
        });
      });


    },

    /**
     * addMdImage - The function that gets called when a user clicks the custom
     * add image button added to the markdown editor. It uses the UI created by
     * the ImageUploaderView to allow a user to select & upload an image to the
     * repository, and uses Woofmark's built-in add image functionality to
     * insert the correct markdown into the textarea. This function must be
     * called such that "this" is the markdownEditor view.
     */
    addMdImage: function() {

      try {
        var view = this;

        // Show woofmark's default image upload dialog, inserted at the end of body
        view.markdownEditor.showImageDialog();

        // Select the image upload dialog elements so that we can customize it
        var imageDialog = $(".wk-prompt"),
            imageDialogInput = imageDialog.find(".wk-prompt-input"),
            imageDialogDescription = imageDialog.find(".wk-prompt-description"),
            imageDialogOkBtn = imageDialog.find(".wk-prompt-ok"),
            // Save the inner HTML of the button for when we replace it
            // temporarily during image upload
            imageDialogOkBtnTxt = imageDialogOkBtn.html();

        // Create an ImageUploaderView and insert into this view.
        mdImageUploader = new ImageUploader({
          uploadInstructions: "Drag & drop an image here or click to upload",
          imageTagName:       "img",
          height:             "175",
          width:              "300",
          // TODO: shrink very large images ?
          // maxHeight: 10000,
          // maxWidth: 10000;
        });

        // Show when image is uploading; temporarily disable the OK button
        view.stopListening(mdImageUploader, "addedfile");
        view.listenTo(mdImageUploader, "addedfile", function(){
          // Disable the button during upload;
          imageDialogOkBtn.prop('disabled', true);
          imageDialogOkBtn.css({"opacity":"0.5", "cursor":"not-allowed"});
          imageDialogOkBtn.html(
            "<i class='icon-spinner icon-spin icon-large loading icon'></i> "+
            "Uploading..."
          );
        });

        // Update the image input URL when the image is successfully uploaded
        view.stopListening(mdImageUploader, "successSaving");
        view.listenTo(mdImageUploader, "successSaving", function(dataONEObject){

          //Execute the DataONEObject function that performs various functions after
          // a successful save
          dataONEObject.onSuccessfulSave();

          // Re-enable the button
          imageDialogOkBtn.prop('disabled', false);
          imageDialogOkBtn.html(imageDialogOkBtnTxt);
          imageDialogOkBtn.css({"opacity":"1", "cursor":"pointer"});

          // Get the uploaded image's url.
          //var url = dataONEObject.url();
          var url = "";

          if( MetacatUI.appModel.get("isCN") ){
            var sourceRepo;

            //Use the object service URL from the origin MN/datasource
            if( dataONEObject.get("datasource") ){
              sourceRepo = MetacatUI.nodeModel.getMember(dataONEObject.get("datasource"));
            }
              //Use the object service URL from the alt repo
            if( !sourceRepo ){
              sourceRepo = MetacatUI.appModel.getActiveAltRepo();
            }

            if( sourceRepo ){
              url = sourceRepo.objectServiceUrl;
            }
          }

          //If this MetacatUI deployment is pointing to a MN, use the meta service URL from the AppModel
          if( !url ){
            url = MetacatUI.appModel.get("objectServiceUrl") || MetacatUI.appModel.get("resolveServiceUrl");
          }

          url = url + dataONEObject.get("id");

          // Create title out of file name without extension.
          var title = dataONEObject.get("fileName");
          if(title && title.lastIndexOf(".") > 0) {
            title = title.substring(0, title.lastIndexOf("."));
          }

          // Add the url + title to the input
          imageDialogInput.val(url + ' "' + title + '"' );
        });

        // Clear the input when the image is removed
        view.stopListening(mdImageUploader, "removedfile");
        view.listenTo(mdImageUploader, "removedfile", function(){
          imageDialogInput.val("");
        });

        // Render the image uploader and insert it just after the upload
        // instructions in the image upload dialog box.
        mdImageUploader.render();
        // The instructions for uploading in image that displays in the prompt/dialog
        imageDialogDescription.text("Upload an image or enter an image URL")
        $(mdImageUploader.el).insertAfter(imageDialogDescription);
      } catch (e) {
        console.log("Failed to load the UI for adding markdown images. Error: " + e);
      }

    },

    /**
     * strikethrough - Add or remove the markdown syntax for strike through to
     * the textarea. If there is text selected, then strike through formatting
     * will be added or removed from that selection. If no selection,
     * some placeholder text will be added surrounded by the strikethrough
     * delimiters.
     *
     * @param  {event} e      is the original event object
     * @param  {string} mode   can be markdown, html, or wysiwyg
     * @param  {object} chunks is a chunks object, describing the current state of the editor, see https://github.com/bevacqua/woofmark#chunks
     */
    strikethrough: function(e, mode, chunks){
      try {
        var markup = "~~";
        // exactly two tiles
        var tildes = '\\~{2}';
        // 2 tildes at the start of a string
        var rleading = /^(\~{2})/;
        // 2 tildes at the end of a string
        var rtrailing = /(\~{2}$)/;
        // 0-1 spaces at the end of a string
        var rtrailingspace = /(\s?)$/;
        // 2+ line breaks
        var rnewlines = /\n{2,}/g;
        // the text to add when no text is selected
        var placeholder = "strikethrough text";

        // Remove leading & trailing white space from selection
        // (but do not remove from the user's text)
        chunks.trim();
        // Replace 2+ consecutive line breaks with 1 linebreak, otherwise
        // strikethrough syntax is incorrect and won't render HTML as expected
        chunks.selection = chunks.selection.replace(rnewlines, '\n');

        // See if the text before or after already contains ~~ at the start/end
        var leadTildes = rtrailing.exec(chunks.before);
        var trailTildes = rleading.exec(chunks.after);
        // See if the selected text already contains ~~ at start or end
        var selectLeadTildes = rleading.exec(chunks.selection);
        var selectTrailTildes = rtrailing.exec(chunks.selection);

        // If the selection is already surrounded by ~~, remove them
        if(leadTildes && trailTildes){
          chunks.before = chunks.before.replace(rtrailing, "");
          chunks.after = chunks.after.replace(rleading, "");
        // If the selection starts & ends with ~~, remove them
        } else if (selectLeadTildes && selectTrailTildes) {
          chunks.selection = chunks.selection.replace(rleading, "");
          chunks.selection = chunks.selection.replace(rtrailing, "");
        // Otherwise, add a set of ~~
        } else {
          chunks.before = chunks.before + markup;
          chunks.after = markup + chunks.after;
          // Add the placeholder text if there was no selection
          if (chunks.selection.length <= 0){
            chunks.selection = placeholder
          }
        }
      } catch (e) {
        console.log("Failed to add or remove strikethrough formatting from markdown. Error: " + e );
      }
    },

    /**
     * updateMarkdown - Update the markdown attribute in this view using the
     * value of the markdown textarea
     */
    updateMarkdown: function(){
      try {
        this.markdown = this.$(this.textarea).val();
      } catch (e) {
        console.log("Failed to the view's markdown attribute, error: " + e);
      }
    },

    /**
     * previewMarkdown - render the markdown preview.
     */
    previewMarkdown: function(){

      try{

        var markdownPreview = new MarkdownView({
            markdown: this.markdown || this.previewPlaceholder,
            showTOC: this.showTOC || false
        });

        // Render the preview
        markdownPreview.render();
        // Add the rendered markdown to the preview tab
        this.$("#markdown-preview-"+this.cid).html(markdownPreview.el);
      }

      catch(e){
        console.log("Failed to preview markdown content. Error message: " + e);
      }

    },

  });

  return MarkdownEditorView;

});
