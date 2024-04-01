/* global define */
define(["jquery", "underscore", "backbone", "models/DataONEObject"], function (
  $,
  _,
  Backbone,
  DataONEObject
) {
  /**
   * @class EMLGeoCoverage
   * @classdesc A description of geographic coverage of a dataset, per the EML
   * 2.1.1 metadata standard
   * @classcategory Models/Metadata/EML211
   * @extends Backbone.Model
   * @constructor
   */
  var EMLGeoCoverage = Backbone.Model.extend(
    /** @lends EMLGeoCoverage.prototype */ {
      defaults: {
        objectXML: null,
        objectDOM: null,
        parentModel: null,
        description: null,
        east: null,
        north: null,
        south: null,
        west: null,
      },

      initialize: function (attributes) {
        if (attributes && attributes.objectDOM)
          this.set(this.parse(attributes.objectDOM));

        //specific attributes to listen to
        this.on(
          "change:description " +
            "change:east " +
            "change:west " +
            "change:south " +
            "change:north",
          this.trickleUpChange
        );
      },

      /*
       * Maps the lower-case EML node names (valid in HTML DOM) to the
       * camel-cased EML node names (valid in EML). Used during parse() and
       * serialize()
       */
      nodeNameMap: function () {
        return {
          altitudemaximum: "altitudeMaximum",
          altitudeminimum: "altitudeMinimum",
          altitudeunits: "altitudeUnits",
          boundingaltitudes: "boundingAltitudes",
          boundingcoordinates: "boundingCoordinates",
          eastboundingcoordinate: "eastBoundingCoordinate",
          geographiccoverage: "geographicCoverage",
          geographicdescription: "geographicDescription",
          northboundingcoordinate: "northBoundingCoordinate",
          southboundingcoordinate: "southBoundingCoordinate",
          westboundingcoordinate: "westBoundingCoordinate",
        };
      },

      /**
       * The map of error keys to human-readable error messages to use for
       * validation issues.
       * @type {Object}
       * @property {string} default - When the error is not in this list
       * @property {string} north - When the Northwest latitude is not in the
       * valid range
       * @property {string} east - When the Southeast longitude is not in the
       * valid range
       * @property {string} south - When the Southeast latitude is not in the
       * valid range
       * @property {string} west - When the Northwest longitude is not in the
       * valid range
       * @property {string} missing - When a long or lat coordinate is missing
       * @property {string} description - When a description is missing
       * @property {string} needPair - When there are no coordinate pairs
       * @property {string} northSouthReversed - When the North latitude is less
       * than the South latitude
       * @property {string} crossesAntiMeridian - When the bounding box crosses
       * the anti-meridian
       * @since 2.27.0
       */
      errorMessages: {
        "default": "Please correct the geographic coverage.",
        "north": "Northwest latitude out of range, must be >-90 and <90. Please correct the latitude.",
        "east": "Southeast longitude out of range (-180 to 180). Please adjust the longitude.",
        "south": "Southeast latitude out of range, must be >-90 and <90. Please correct the latitude.",
        "west": "Northwest longitude out of range (-180 to 180). Check and correct the longitude.",
        "missing": "Latitude and longitude are required for each coordinate. Please complete all fields.",
        "description": "Missing location description. Please add a brief description.",
        "needPair": "Location requires at least one coordinate pair. Please add coordinates.",
        "northSouthReversed": "North latitude should be greater than South. Please swap the values.",
        "crossesAntiMeridian": "Bounding box crosses the anti-meridian. Please use multiple boxes that meet at the anti-meridian instead.",
      },

      /**
       * Parses the objectDOM to populate this model with data.
       * @param {Element} objectDOM - The EML object element
       * @returns {Object} The EMLGeoCoverage data
       *
       * @example - Example input XML
       * <geographicCoverage scope="document">
       *   <geographicDescription>Rhine-Main-Observatory</geographicDescription>
       *   <boundingCoordinates>
       *     <westBoundingCoordinate>9.0005</westBoundingCoordinate>
       *     <eastBoundingCoordinate>9.0005</eastBoundingCoordinate>
       *     <northBoundingCoordinate>50.1600</northBoundingCoordinate>
       *     <southBoundingCoordinate>50.1600</southBoundingCoordinate>
       *   </boundingCoordinates>
       * </geographicCoverage>
       */
      parse: function (objectDOM) {
        var modelJSON = {};

        if (!objectDOM) {
          if (this.get("objectDOM")) var objectDOM = this.get("objectDOM");
          else return {};
        }

        //Create a jQuery object of the DOM
        var $objectDOM = $(objectDOM);

        //Get the geographic description
        modelJSON.description = $objectDOM
          .children("geographicdescription")
          .text();

        //Get the bounding coordinates
        var boundingCoordinates = $objectDOM.children("boundingcoordinates");
        if (boundingCoordinates) {
          modelJSON.east = boundingCoordinates
            .children("eastboundingcoordinate")
            .text()
            .replace("+", "");
          modelJSON.north = boundingCoordinates
            .children("northboundingcoordinate")
            .text()
            .replace("+", "");
          modelJSON.south = boundingCoordinates
            .children("southboundingcoordinate")
            .text()
            .replace("+", "");
          modelJSON.west = boundingCoordinates
            .children("westboundingcoordinate")
            .text()
            .replace("+", "");
        }

        return modelJSON;
      },

      /**
       * Converts this EMLGeoCoverage to XML
       * @returns {string} The XML string
       */
      serialize: function () {
        const objectDOM = this.updateDOM();
        let xmlString = objectDOM?.outerHTML;
        if (!xmlString) xmlString = objectDOM?.[0]?.outerHTML;

        //Camel-case the XML
        xmlString = this.formatXML(xmlString);

        return xmlString;
      },

      /*
       * Makes a copy of the original XML DOM and updates it with the new values
       * from the model.
       */
      updateDOM: function () {
        var objectDOM;

        if (!this.isValid()) {
          return "";
        }

        if (this.get("objectDOM")) {
          objectDOM = $(this.get("objectDOM").cloneNode(true));
        } else {
          objectDOM = $(document.createElement("geographiccoverage"));
        }

        //If only one point is given, make sure both points are the same
        if (
          this.get("north") &&
          this.get("west") &&
          !this.get("south") &&
          !this.get("east")
        ) {
          this.set("south", this.get("north"));
          this.set("east", this.get("west"));
        } else if (
          this.get("south") &&
          this.get("east") &&
          !this.get("north") &&
          !this.get("west")
        ) {
          this.set("north", this.get("south"));
          this.set("west", this.get("east"));
        }

        // Description
        if (!objectDOM.children("geographicdescription").length)
          objectDOM.append(
            $(document.createElement("geographicdescription")).text(
              this.get("description")
            )
          );
        else
          objectDOM
            .children("geographicdescription")
            .text(this.get("description"));

        // Create the bounding coordinates element
        var boundingCoordinates = objectDOM.find("boundingcoordinates");
        if (!boundingCoordinates.length) {
          boundingCoordinates = document.createElement("boundingcoordinates");
          objectDOM.append(boundingCoordinates);
        }

        //Empty out the coordinates first
        $(boundingCoordinates).empty();

        //Add the four coordinate values
        $(boundingCoordinates).append(
          $(document.createElement("westboundingcoordinate")).text(
            this.get("west")
          ),
          $(document.createElement("eastboundingcoordinate")).text(
            this.get("east")
          ),
          $(document.createElement("northboundingcoordinate")).text(
            this.get("north")
          ),
          $(document.createElement("southboundingcoordinate")).text(
            this.get("south")
          )
        );

        return objectDOM;
      },

      /**
       * Sometimes we'll need to add a space between error messages, but only if
       * an error has already been triggered. Use addSpace to accomplish this.
       *
       * @param {string} msg The string that will be appended
       * @param {bool} front A flag that when set will append the whitespace to
       * the front of 'msg'
       * @return {string} The string that was passed in, 'msg', with whitespace
       * appended
       */
      addSpace: function (msg, front) {
        if (typeof front === "undefined") {
          front = false;
        }
        if (msg) {
          if (front) {
            return " " + msg;
          }
          return (msg += " ");
        }
        return msg;
      },

      /**
       * Because the same error messages are used in a couple of different
       * places, we centralize the strings and access here.
       *
       * @param {string} area Specifies the area that the error message belongs
       * to. Browse through the switch statement to find the one you need.
       * @return {string} The error message
       */
      getErrorMessage: function (area) {
        return this.errorMessages[area] || this.errorMessages.default;
      },

      /**
       * Generates an object that describes the current state of each latitude
       * and longitude box. The status includes whether there is a value and if
       * the value is valid.
       *
       * @return {array} An array containing the current state of each
       * coordinate box, including: value (the value of the coordinate converted
       * to a number), isSet (whether the coordinate has a value), and isValid
       * (whether the value is in the correct range)
       */
      getCoordinateStatus: function () {
        var north = this.get("north"),
          east = this.get("east"),
          south = this.get("south"),
          west = this.get("west");

        const isDefined = (value) =>
          typeof value !== "undefined" && value != null && value !== "";

        return {
          north: {
            value: Number(north),
            isSet: isDefined(north),
            isValid: this.validateCoordinate(north, -90, 90),
          },
          east: {
            value: Number(east),
            isSet: isDefined(east),
            isValid: this.validateCoordinate(east, -180, 180),
          },
          south: {
            value: Number(south),
            isSet: isDefined(south),
            isValid: this.validateCoordinate(south, -90, 90),
          },
          west: {
            value: Number(west),
            isSet: isDefined(west),
            isValid: this.validateCoordinate(west, -180, 180),
          },
        };
      },

      /**
       * Checks the status object for conditions that warrant an error message
       * to the user. This is called during the validation processes (validate()
       * and updateModel()) after the status object has been created by
       * getCoordinateStatus().
       *
       * @param status The status object, holding the state of the coordinates
       * @return {string} Any errors that need to be displayed to the user
       */
      generateStatusErrors: function (status) {
        var errorMsg = "";

        // Northwest Latitude
        if (status.north.isSet && !status.north.isValid) {
          errorMsg = this.addSpace(errorMsg);
          errorMsg += this.getErrorMessage("north");
        }
        // Northwest Longitude
        if (status.west.isSet && !status.west.isValid) {
          errorMsg = this.addSpace(errorMsg);
          errorMsg += this.getErrorMessage("west");
        }
        // Southeast Latitude
        if (status.south.isSet && !status.south.isValid) {
          errorMsg = this.addSpace(errorMsg);
          errorMsg += this.getErrorMessage("south");
        }
        // Southeast Longitude
        if (status.east.isSet && !status.east.isValid) {
          errorMsg = this.addSpace(errorMsg);
          errorMsg += this.getErrorMessage("east");
        }
        return errorMsg;
      },

      /**
       * This grabs the various location elements and validates the user input.
       * In the case of an error, we append an error string (errMsg) so that we
       * display all of the messages at the same time. This validates the entire
       * location row by adding extra checks for a description and for
       * coordinate pairs
       *
       * @return {string} The error messages that the user will see
       */
      validate: function () {
        var errors = {};

        if (!this.get("description")) {
          errors.description = this.getErrorMessage("description");
        }

        var pointStatuses = this.getCoordinateStatus();

        if (
          !pointStatuses.north.isSet &&
          !pointStatuses.south.isSet &&
          !pointStatuses.east.isSet &&
          !pointStatuses.west.isSet
        ) {
          errors.north = this.getErrorMessage("needPair");
          errors.west = "";
        }

        //Check that all the values are correct
        if (pointStatuses.north.isSet && !pointStatuses.north.isValid)
          errors.north = this.getErrorMessage("north");
        if (pointStatuses.south.isSet && !pointStatuses.south.isValid)
          errors.south = this.getErrorMessage("south");
        if (pointStatuses.east.isSet && !pointStatuses.east.isValid)
          errors.east = this.getErrorMessage("east");
        if (pointStatuses.west.isSet && !pointStatuses.west.isValid)
          errors.west = this.getErrorMessage("west");

        if (pointStatuses.north.isSet && !pointStatuses.west.isSet)
          errors.west = this.getErrorMessage("missing");
        else if (!pointStatuses.north.isSet && pointStatuses.west.isSet)
          errors.north = this.getErrorMessage("missing");
        else if (pointStatuses.south.isSet && !pointStatuses.east.isSet)
          errors.east = this.getErrorMessage("missing");
        else if (!pointStatuses.south.isSet && pointStatuses.east.isSet)
          errors.south = this.getErrorMessage("missing");

        // Verify latitudes: north should be > south.
        if (
          pointStatuses.north.isSet &&
          pointStatuses.south.isSet &&
          pointStatuses.north.isValid &&
          pointStatuses.south.isValid
        ) {
          if (pointStatuses.north.value < pointStatuses.south.value) {
            const msg = this.getErrorMessage("northSouthReversed");
            errors.north = msg;
            errors.south = msg;
          }
        }

        // For longitudes, don't allow bounding boxes that attempt to traverse
        // the anti-meridian
        if (
          pointStatuses.east.isSet &&
          pointStatuses.west.isSet &&
          pointStatuses.east.isValid &&
          pointStatuses.west.isValid
        ) {
          if (pointStatuses.east.value < pointStatuses.west.value) {
            const msg = this.getErrorMessage("crossesAntiMeridian");
            errors.east = msg;
            errors.west = msg;
          }
        }

        if (Object.keys(errors).length) return errors;
        else return false;
      },

      /**
       * Checks for any coordinates with missing counterparts.
       *
       * @param status The status of the coordinates
       * @return {bool} True if there are missing coordinates, false otherwise
       */
      hasMissingPoint: function (status) {
        if (
          (status.north.isSet && !status.west.isSet) ||
          (!status.north.isSet && status.west.isSet)
        ) {
          return true;
        } else if (
          (status.south.isSet && !status.east.isSet) ||
          (!status.south.isSet && status.east.isSet)
        ) {
          return true;
        }

        return false;
      },

      /**
       * Checks that there are either two or four coordinate values. If there
       * aren't, it means that the user still needs to enter coordinates.
       *
       * @param status The current state of the coordinates
       * @return {bool} True if there are pairs, false otherwise
       */
      checkForPairs: function (status) {
        var isSet = _.filter(status, function (coord) {
          return coord.isSet == true;
        });

        if (isSet.length == 0) {
          return false;
        }
        return true;
      },

      /**
       * Validate a coordinate String by making sure it can be coerced into a
       * number and is within the given bounds. Note: Min and max are inclusive
       *
       * @param value {string} The value of the edit area that will be validated
       * @param min The minimum value that 'value' can be
       * @param max The maximum value that 'value' can be
       * @return {bool} True if the validation passed, otherwise false
       */
      validateCoordinate: function (value, min, max) {
        if (
          typeof value === "undefined" ||
          value === null ||
          (value === "" && isNaN(value))
        ) {
          return false;
        }

        var parsed = Number(value);

        if (isNaN(parsed)) {
          return false;
        }

        if (parsed < min || parsed > max) {
          return false;
        }

        return true;
      },

      /**
       * Climbs up the model hierarchy until it finds the EML model
       *
       * @return {EML211|false} - Returns the EML 211 Model or false if not
       * found
       */
      getParentEML: function () {
        var emlModel = this.get("parentModel"),
          tries = 0;

        while (emlModel.type !== "EML" && tries < 6) {
          emlModel = emlModel.get("parentModel");
          tries++;
        }

        if (emlModel && emlModel.type == "EML") return emlModel;
        else return false;
      },

      /**
       * Apply the change event on the parent EML model
       */
      trickleUpChange: function () {
        const parentModel = this.get("parentModel");
        if (!parentModel) return;
        parentModel.trigger("change");
        parentModel.trigger("change:geoCoverage");
      },

      /**
       * See DataONEObject.formatXML()
       */
      formatXML: function (xmlString) {
        return DataONEObject.prototype.formatXML.call(this, xmlString);
      },
    }
  );

  return EMLGeoCoverage;
});
