/* global define */
define(['underscore', 'jquery', 'backbone',
    'models/metadata/eml211/EMLGeoCoverage',
    'text!templates/metadata/EMLGeoCoverage.html'],
    function (_, $, Backbone, EMLGeoCoverage, EMLGeoCoverageTemplate) {

        /* 
            The EMLGeoCoverage renders the content of an EMLGeoCoverage model
        */
        var EMLGeoCoverageView = Backbone.View.extend({

            type: "EMLGeoCoverageView",

            tagName: "div",

            className: "row-fluid eml-geocoverage",

            attributes: {
                "data-category": "geoCoverage"
            },

            editTemplate: _.template(EMLGeoCoverageTemplate),

            initialize: function (options) {
                if (!options)
                    var options = {};

                this.isNew = options.isNew || (options.model ? false : true);
                this.model = options.model || new EMLGeoCoverage();
                this.edit = options.edit || false;
            },

            events: {
                "change": "updateModel",
                "focusout .input-container": "validateRow",
                "keyup textarea.error": "updateError",
                "keyup .coord.error": "updateError",
                "mouseover .remove": "toggleRemoveClass",
                "mouseout  .remove": "toggleRemoveClass"
            },

            render: function (e) {
                //Save the view and model on the element
                this.$el.data({
                    model: this.model,
                    view: this
                });

                this.$el.html(this.editTemplate({
                    edit: this.edit,
                    model: this.model.toJSON()
                }));

                if (this.isNew) {
                    this.$el.addClass("new");
                }

                return this;
            },

            /* 
            * This is where we add validation error messages to the notification container
            */
            showValidationError: function (errorMsg) {
                this.$(".notification").text(errorMsg).addClass("error");
                this.$el.addClass("error");
            },

            /* 
            * This is where we remove old error messages from the error notification container
            */
            removeValidationError: function () {
                this.$("input.error, textarea.error").removeClass("error");
                this.$(".notification.error").text("");
                this.$el.removeClass("error");
            },

            /*
            * Updates the model. 
            * If this is called from the user switching between latitude and longitude boxes,
            * we check to see if the input was valid and display any errors if we need to.
            */
            updateModel: function (e) {
                if (!e) return false;

                e.preventDefault();

                //Get the attribute and value
                var element = $(e.target),
                    value = element.val(),
                    attribute = element.attr("data-attribute");

                //Get the attribute that was changed
                if (!attribute) return false;

                //Are the NW and SE points the same? i.e. is this a single point and not a box?
                var isSinglePoint = (this.model.get("north") != null && this.model.get("north") == this.model.get("south")) &&
                    (this.model.get("west") != null && this.model.get("west") == this.model.get("east")),
                    hasEmptyInputs = this.$("[data-attribute='north']").val() == "" ||
                        this.$("[data-attribute='south']").val() == "" ||
                        this.$("[data-attribute='west']").val() == "" ||
                        this.$("[data-attribute='east']").val() == "";

                //Update the model
                if (value == "")
                    this.model.set(attribute, null);
                else
                    this.model.set(attribute, value);

                //If the NW and SE points are the same point...
                if (isSinglePoint && hasEmptyInputs) {
                    /* If the user updates one of the empty number inputs, then we can assume they do not 
                    *   want a single point and are attempting to enter a second point. So we should empty the 
                    *   value from the model for the corresponding coordinate
                    *   For example, if the UI shows a lat,long pair of NW: [10] [30] SE: [ ] [ ] then the model
                    *     values would be N: 10, W: 30, S: 10, E: 30
                    *     if the user updates that to:   NW: [10] [30] SE: [5] [ ]
                    *     then we want to remove the "east" value of "30", so the model would be: N: 10, W: 30, S: 5, E: null
                    */
                    if (attribute == "north" && this.$("[data-attribute='west']").val() == "")
                        this.model.set("west", null);
                    else if (attribute == "south" && this.$("[data-attribute='east']").val() == "")
                        this.model.set("east", null);
                    else if (attribute == "east" && this.$("[data-attribute='south']").val() == "")
                        this.model.set("south", null);
                    else if (attribute == "west" && this.$("[data-attribute='north']").val() == "")
                        this.model.set("north", null);
                    /*
                     * If the user removes one of the latitude or longitude values, reset the opposite point
                     */
                    else if (((attribute == "north" && this.model.get("north") == null) ||
                        (attribute == "west" && this.model.get("west") == null)) &&
                        (this.$("[data-attribute='south']").val() == "" && this.$("[data-attribute='east']").val() == "")) {
                        this.model.set("south", null);
                        this.model.set("east", null);
                    }
                    else if (((attribute == "south" && this.model.get("south") == null) ||
                        (attribute == "east" && this.model.get("east") == null)) &&
                        (this.$("[data-attribute='north']").val() == "" && this.$("[data-attribute='west']").val() == "")) {
                        this.model.set("north", null);
                        this.model.set("west", null);
                    }
                    /* Otherwise, if the non-empty number inputs are updated, 
                     *  we simply update the corresponding value in the other point 
                     */
                    else if (attribute == "north" && this.model.get("north") != null)
                        this.model.set("south", value);
                    else if (attribute == "south" && this.model.get("south") != null)
                        this.model.set("north", value);
                    else if (attribute == "west" && this.model.get("west") != null)
                        this.model.set("east", value);
                    else if (attribute == "east" && this.model.get("east") != null)
                        this.model.set("west", value);
                }
                else {
                    //Find out if we are missing a complete NW or SE point
                    var isMissingNWPoint = (this.model.get("north") == null && this.model.get("west") == null),
                        isMissingSEPoint = (this.model.get("south") == null && this.model.get("east") == null);

                    // If there is a full NW point but no SE point, we can assume the user wants a single point and
                    //  so we will copy the NW values to the SE
                    if (this.model.get("north") != null && this.model.get("west") != null && isMissingSEPoint) {
                        this.model.set("south", this.model.get("north"));
                        this.model.set("east", this.model.get("west"));
                    }
                    // Same for when there is a SE point but no NW point
                    else if (this.model.get("south") != null && this.model.get("east") != null && isMissingNWPoint) {
                        this.model.set("north", this.model.get("south"));
                        this.model.set("west", this.model.get("east"));
                    }
                }

                // Find and display any errors that the user needs to know about
                var status = this.model.getCoordinateStatus();
                var errorMsg = this.model.generateStatusErrors(status);

                if (errorMsg) {
                    this.showValidationError(errorMsg);
                }
                else {
                    this.removeValidationError();
                }
                if (this.model.get("parentModel")) {
                    if (this.model.get("parentModel").type == "EML" && _.contains(MetacatUI.rootDataPackage.models, this.model.get("parentModel"))) {
                        MetacatUI.rootDataPackage.packageModel.set("changed", true);
                    }
                }
            },

            /*
            * Checks to see if any error messages need to be removed. If not, then it performs validation 
            * across the row and displays any errors. This id called when the user clicks out of an edit box 
            * on to the page.
            */
            showValidation: function (e, options) {

                var view = this;

                setTimeout(function () {

                    var geoCoverage = $(document.activeElement).parents(".eml-geocoverage");

                    if (geoCoverage.length && geoCoverage[0] == view.el)
                        return;

                    //If the model is valid, then remove error styling and exit
                    if (view.model.isValid()) {
                        view.$(".error").removeClass("error");
                        view.$el.removeClass("error");
                        view.$(".notification").empty();
                        return;
                    }

                    //Check if the model is valid
                    var north = view.$(".north").val(),
                        west = view.$(".west").val(),
                        south = view.$(".south").val(),
                        east = view.$(".east").val(),
                        description = view.$(".description").val(),
                        hasError = false;

                    //Find any incomplete coordinates
                    if (view.isNew && !north && !south && !east && !west && !description) {

                        //If the model is empty and the EML has a geoCoverage error, display that and exit
                        var emlModel = view.model.get("parentModel");
                        if (emlModel && emlModel.type == "EML" && $(".eml-geocoverage").index(view.el) == 0) {

                            var validationErrors = emlModel.validationError;
                            if (validationErrors && validationErrors.geoCoverage) {
                                view.$(".notification").text(validationErrors.geoCoverage).addClass("error");
                                view.$el.addClass("error");
                                return;
                            }
                        }

                        //Otherwise, there is no error
                        hasError = false;
                    }
                    else {
                        if (north && !west) {
                            view.$(".west").addClass("error");
                            hasError = true;
                        }
                        else if (west && !north) {
                            view.$(".north").addClass("error");
                            hasError = true;
                        }
                        else if (south && !east) {
                            view.$(".east").addClass("error");
                            hasError = true;
                        }
                        else if (east && !south) {
                            view.$(".south").addClass("error");
                            hasError = true;
                        }
                        else if (north && west) {
                            view.$(".north, .west").removeClass("error");
                        }
                        else if (south && east) {
                            view.$(".south, .east").removeClass("error");
                        }
                        else if (!north && !west && !south && !east) {
                            view.$(".north, .west").addClass("error");
                            hasError = true;
                        }

                        if (north) {
                            var northParsed = Number(north);

                            if (isNaN(northParsed) || northParsed < -90 | northParsed > 90) {
                                view.$(".north").addClass("error");
                                hasError = true;
                            }
                        }

                        if (east) {
                            var eastParsed = Number(east);

                            if (isNaN(eastParsed) || eastParsed < -180 | eastParsed > 180) {
                                view.$(".east").addClass("error");
                                hasError = true;
                            }
                        }

                        if (south) {
                            var southParsed = Number(south);

                            if (isNaN(southParsed) || southParsed < -90 | southParsed > 90) {
                                view.$(".south").addClass("error");
                                hasError = true;
                            }
                        }

                        if (west) {
                            var westParsed = Number(west);

                            if (isNaN(westParsed) || westParsed < -180 | westParsed > 180) {
                                view.$(".west").addClass("error");
                                hasError = true;
                            }
                        }

                        //Check if there isn't a geographic description
                        if (!description) {
                            view.$(".description").addClass("error");
                            hasError = true;
                        }
                        else {
                            view.$(".description").removeClass("error");
                        }
                    }

                    if (hasError) {
                        view.removeValidationError();
                        view.showValidationError(view.model.validationError);
                    }
                    else {
                        view.removeValidationError();
                    }
                }, 1);
            },


            /*
             * When the user is typing in an input with an error, check if they've fixed the error
             */
            updateError: function (e) {
                var input = $(e.target);

                if (input.val()) {
                    input.removeClass("error");

                    //If there are no more errors, remove the error class from the view
                    if (!this.$(".error").length) {
                        this.$(".notification.error").text("");
                        this.$el.removeClass("error");
                    }
                }
            },

            /*
             * Highlight what will be removed when the remove icon is hovered over
             */
            toggleRemoveClass: function () {
                this.$el.toggleClass("remove-preview");
            },

            /*
             * Unmarks this view as new
             */
            notNew: function () {
                this.$el.removeClass("new");
            }
        });

        return EMLGeoCoverageView;
    });