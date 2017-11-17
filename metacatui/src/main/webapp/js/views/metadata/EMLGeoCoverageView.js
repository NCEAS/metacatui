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

            /**
            * This is where we add validation error messages to the notification container.
            *
            * @function showVaidationError
            * @param {string} errorMsg The error message that will be displayed to the user
            */
            showValidationError: function (errorMsg) {
                this.$(".notification").text(errorMsg).addClass("error");
                this.$el.addClass("error");
            },

            /**
            * This is where we remove old error messages from the error notification container
            * 
            * @function removeValidationError
            * @param status The status object holding the state of the coordinate boxes
            */
            removeValidationError: function (status) {
                this.$("input.error, textarea.error").removeClass("error");
                this.$(".notification.error").text("");
                this.$el.removeClass("error");
            },

            /**
            * If we have an invalid edit box, we display a red border around it. This function
            * iterates through the status object and modifies the css to display a red border.
            * We also want to remove the border when the value is correct.
            *
            * @function setErrorBorderState
            * @param status The current state of the coordinate boxes 
            */
            setErrorBorderState: function (status) {

                for (coordinate in status) {
                    if (status[coordinate].isSet && !status[coordinate].isValid) {
                        this.$("." + coordinate).addClass("error");
                    } else {
                        this.$("." + coordinate).removeClass("error");
                    }
                }
            },

            /**
            * We need to display errors based on rules that are more complex
            * than single coordinate input. For example, if the user sets
            * the north coordinate, we'll want to display an error if they
            * forgot to enter the west coordinate. This should only be used
            * when validating the entire row, because we want to give the user
            * a chance to fill out coordinate pairs before displaying errors about
            * missing coordinates.
            * 
            * @function getBorderStatus
            * @param status
            * @return needsErrorBorder A flag denoting which coordinate boxes need error borders
            */
            getBorderStatus: function (status) {

                var needsErrorBorder = {
                    'north': {
                        hasError: false
                    },
                    'east': {
                        hasError: false
                    },
                    'south': {
                        hasError: false
                    },
                    'west': {
                        hasError: false
                    }
                }

                if (status.north.isSet && !status.west.isSet) {
                    needsErrorBorder['west'].hasError = true;
                }

                if (status.west.isSet && !status.north.isSet) {
                    needsErrorBorder['north'].hasError = true;
                }

                if (status.south.isSet && !status.east.isSet) {
                    needsErrorBorder['east'].hasError = true;
                }

                if (status.east.isSet && !status.south.isSet) {
                    needsErrorBorder['south'].hasError = true;
                }

                if (!status.north.isSet && !status.west.isSet &&
                    !status.south.isSet && !status.east.isSet) {
                    needsErrorBorder['north'].hasError = true;
                    needsErrorBorder['west'].hasError = true;
                }

                if (status.north.isSet && !status.north.isValid) {
                    needsErrorBorder['north'].hasError = true;
                }

                if (status.east.isSet && !status.east.isValid) {
                    needsErrorBorder['east'].hasError = true;
                }

                if (status.south.isSet && !status.south.isValid) {
                    needsErrorBorder['south'].hasError = true;
                }

                if (status.west.isSet && !status.west.isValid) {
                    needsErrorBorder['west'].hasError = true;
                }

                return needsErrorBorder;
            },

            /**
             * Updates the model. 
             * If this is called from the user switching between latitude and longitude boxes,
             * we check to see if the input was valid and display any errors if we need to.
             * 
             * @function updateModel
             * @param e The event
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
                        (this.$("[data-attribute='south']").val() == "" &&
                            this.$("[data-attribute='east']").val() == "")) {
                        this.model.set("south", null);
                        this.model.set("east", null);
                    } else if (((attribute == "south" && this.model.get("south") == null) ||
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


                // Validate the coordinate boxes
                this.validateCoordinates(e);

                if (this.model.get("parentModel")) {
                    if (this.model.get("parentModel").type == "EML" && _.contains(MetacatUI.rootDataPackage.models, this.model.get("parentModel"))) {
                        MetacatUI.rootDataPackage.packageModel.set("changed", true);
                    }
                }
            },

            /**
            * When we validate across lat/long boxes, we still want to display any
            * errors that don't pertain to the lat/long (like a missing description).
            * We do the check here and get the error messages because they will
            * end up being wiped away when we generate the new error string in
            * this.model.generateStatusErrors().
            *
            * @function checkPreviousErrors
            * @param status The current state of the coordinate inputs
            * @return {string} The error message that will be displayed
            */
            checkPreviousErrors: function (status) {
                var errorMsg = "";

                var errors = {
                    'description': 0,
                    'pair': 0,
                    'missing': 0
                }

                if (this.$(".description").hasClass("error")) {
                    errors["description"] = true;
                    errorMsg = this.model.addSpace(this.model.getErrorMessage("description"));
                }

                /*
                * Some errors aren't programmatically linked to elements (we just add the error to
                * a string). In the case of the 'description' error, we were able to check if 'description'
                * had the error class defined. In the case of a missing lat/long we have to first grab the old
                * error message and check if there was an error. IF there was, we need check if it is 
                * still valid. If it's not, we'll discard it.
                */
                oldError = this.$(".notification").text();

                if (oldError.search(this.model.getErrorMessage("needPair")) != -1) {
                    if (!this.model.checkForPairs(status)) {
                        errors["pair"] = true;
                        errorMsg += this.model.addSpace(this.model.getErrorMessage("needPair"));
                    }
                }

                if (oldError.search(this.model.getErrorMessage("missing")) != -1) {
                    if (this.model.checkForMissing(status)) {
                        errors["missing"] = true;
                        errorMsg += this.model.addSpace(this.model.getErrorMessage("missing"));
                    }
                }

                return errors;
            },

            /** 
             * We perform validation two ways:
             *   1. By validating the entire row
             *   2. By validating only the coordinates
             *
             *  This function handles the validation, addition, and removal of any errors
             *  associated with invalid latitude and longitude values (#2).
             *
             * @function validateCoordinates
            */
            validateCoordinates: function () {
                var status = this.model.getCoordinateStatus();
                var errorMsg = ""

                // We want to check for any errors not associated with individual coordinates and display them.
                // Handle that here
                var previousErrors = this.checkPreviousErrors(status);
                if (previousErrors["description"]) {
                    errorMsg += this.model.addSpace(this.model.getErrorMessage("description"));
                }
                if (previousErrors["pair"]) {
                    errorMsg += this.model.addSpace(this.model.getErrorMessage("needPair"));
                }
                if (previousErrors["missing"]) {
                    errorMsg += this.model.addSpace(this.model.getErrorMessage("missing"));
                }

                errorMsg = this.model.addSpace(errorMsg);

                // Get all of the errors regarding coordinate values
                errorMsg += this.model.generateStatusErrors(status);

                if (errorMsg) {
                    this.showValidationError(errorMsg);
                } else {
                    this.removeValidationError(status);
                }
                this.setErrorBorderState(status);
            },

            /**
             * Checks to see if any error messages need to be removed. If not, then it performs validation 
             * across the row and displays any errors. This id called when the user clicks out of an edit box 
             * on to the page.
             * 
             * @function validateRow
             * @param e The event
             * @param options
             */
            validateRow: function (e, options) {

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

                    /*
                    * Get the state (whether the coordinate has a value and validity status) of the coordinates.
                    * There is a process that checks the validity of the coordinates without the description
                    * field (see validateCoordinates), so we'll splice that flow and append a check for the 
                    * description at the end.
                    */
                    var status = view.model.getCoordinateStatus();
                    description = view.$(".description").val(),
                        hasError = false;

                    /*
                    * Check the case that none of the fields have been filled out, but there exists a 
                    * geoCoverage error. In this case, we'll display the error and then stop further
                    * validation.
                    */
                    if (view.isNew && !status.north.isSet && !status.south.isSet &&
                        !status.east.isSet && !status.west.isSet && !description) {

                        // Check for the empty model and for any geoCoverage errors
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
                        hasError = view.addErrorClasses(status, view, hasError);
                    }

                    if (hasError) {
                        view.showValidationError(view.model.validationError);
                        view.model.validate();
                    }
                    else {
                        view.removeValidationError();
                    }
                    //view.setErrorBorderState(status);
                }, 1);
            },

            /**
            * Run though a check of different conditions that may happen. For example,
            * this is where we check if a latitude was set, but not the longitude. For
            * any errors that are set in this section, we handle the cases where they need
            * to be removed. In the previous case we'll want to make the longitude box have
            * a red border
            *
            * @function addErrorClasses
            * @param status The status object holding the state of each coordinate box
            * @param view this
            * @param {bool} hasError The error flag. set to true when there is invalid input
            * @return {bool} hasError The error flag
            */
            addErrorClasses: function (status, view, hasError) {
                borderStatus = this.getBorderStatus(status);

                for (coordinate in borderStatus) {
                    if (borderStatus[coordinate].hasError) {
                        view.$("." + coordinate).addClass("error");
                        hasError = true;
                    }
                    else {
                        view.$("." + coordinate).removeClass("error");
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
                return hasError;
            },

            /**
             * When the user is typing in an input with an error, check if they've fixed the error
             * and remove any error messages. This includes turning the red border off.
             * 
             * @function updateError
             * @param e The event
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

            /**
             * Highlight what will be removed when the remove icon is hovered over
             * 
             * @function toggleRemoveClass
             */
            toggleRemoveClass: function () {
                this.$el.toggleClass("remove-preview");
            },

            /**
             * Unmarks this view as new
             * 
             * @function notNew
             */
            notNew: function () {
                this.$el.removeClass("new");
            }
        });

        return EMLGeoCoverageView;
    });