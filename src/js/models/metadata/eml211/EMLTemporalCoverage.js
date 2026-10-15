define([
  "jquery",
  "underscore",
  "backbone",
  "models/DataONEObject",
  "common/EMLUtilities",
], ($, _, Backbone, DataONEObject, EMLUtilities) => {
  const MESSAGES = {
    BEGIN_DATE_TIME_AFTER_END:
      "The begin date and time must be before the end date and time.",
    BEGIN_TIME_AFTER_END: "The begin time must be before the end time.",
    INVALID_TIME_FORMAT:
      "Enter a time like 12:44:55 or 12:44:55.34. You can add Z for UTC or a time zone offset, such as +02:00 or -08:00.",
  };

  /**
   * @class EMLTemporalCoverage
   * @classcategory Models/Metadata/EML211
   * @extends Backbone.Model
   */
  const EMLTemporalCoverage = Backbone.Model.extend(
    /** @lends EMLTemporalCoverage.prototype */ {
      defaults: {
        objectXML: null,
        objectDOM: null,
        beginDate: null,
        beginTime: null,
        endDate: null,
        endTime: null,
      },

      initialize: function (attributes) {
        if (attributes && attributes.objectDOM)
          this.set(this.parse(attributes.objectDOM));

        this.on(
          "change:beginDate change:beginTime change:endDate change:endTime",
          this.trickleUpChange,
        );
      },

      /*
       * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased EML node names (valid in EML).
       * Used during parse() and serialize()
       */
      nodeNameMap: function () {
        return {
          begindate: "beginDate",
          calendardate: "calendarDate",
          enddate: "endDate",
          rangeofdates: "rangeOfDates",
          singledatetime: "singleDateTime",
          spatialraster: "spatialRaster",
          spatialvector: "spatialVector",
          storedprocedure: "storedProcedure",
          temporalcoverage: "temporalCoverage",
        };
      },

      parse: function (objectDOM) {
        if (!objectDOM) var objectDOM = this.get("objectDOM");

        var rangeOfDates = $(objectDOM).children("rangeofdates"),
          singleDateTime = $(objectDOM).children("singledatetime");

        // If the temporalCoverage element has both a rangeOfDates and a
        // singleDateTime (invalid EML), the rangeOfDates is preferred.
        if (rangeOfDates.length) {
          return this.parseRangeOfDates(rangeOfDates);
        } else if (singleDateTime.length) {
          return this.parseSingleDateTime(singleDateTime);
        }
      },

      parseRangeOfDates: function (rangeOfDates) {
        var beginDate = $(rangeOfDates).find("beginDate"),
          endDate = $(rangeOfDates).find("endDate"),
          properties = {};

        if (beginDate.length > 0) {
          if ($(beginDate).find("calendardate")) {
            properties.beginDate = $(beginDate)
              .find("calendardate")
              .first()
              .text();
          }

          if ($(beginDate).find("time").length > 0) {
            properties.beginTime = $(beginDate).find("time").first().text();
          }
        }

        if (endDate.length > 0) {
          if ($(endDate).find("calendardate").length > 0) {
            properties.endDate = $(endDate).find("calendardate").first().text();
          }

          if ($(endDate).find("time").length > 0) {
            properties.endTime = $(endDate).find("time").first().text();
          }
        }

        return properties;
      },

      parseSingleDateTime: function (singleDateTime) {
        var calendarDate = $(singleDateTime).find("calendardate"),
          time = $(singleDateTime).find("time");

        return {
          beginDate:
            calendarDate.length > 0 ? calendarDate.first().text() : null,
          beginTime: time.length > 0 ? time.first().text() : null,
        };
      },

      serialize: function () {
        var objectDOM = this.updateDOM(),
          xmlString = objectDOM.outerHTML;

        //Camel-case the XML
        xmlString = this.formatXML(xmlString);

        return xmlString;
      },

      /*
       * Makes a copy of the original XML DOM and updates it with the new values from the model.
       */
      updateDOM: function () {
        var objectDOM;

        if (this.get("objectDOM")) {
          objectDOM = this.get("objectDOM").cloneNode(true);
          //Empty the DOM
          $(objectDOM).empty();
        } else {
          objectDOM = $("<temporalcoverage></temporalcoverage>");
        }

        if (this.get("beginDate") && this.get("endDate")) {
          $(objectDOM).append(this.serializeRangeOfDates());
        } else if (!this.get("endDate")) {
          $(objectDOM).append(this.serializeSingleDateTime());
        } else if (this.get("singleDateTime")) {
          var singleDateTime = $(objectDOM).find("singledatetime");
          if (!singleDateTime.length) {
            singleDateTime = document.createElement("singledatetime");
            $(objectDOM).append(singleDateTime);
          }

          if (this.get("singleDateTime").calendarDate)
            $(singleDateTime).html(
              this.serializeSingleDateTime(
                this.get("singleDateTime").calendarDate,
              ),
            );
        }

        // Remove empty (zero-length or whitespace-only) nodes
        $(objectDOM)
          .find("*")
          .filter(function () {
            return $.trim(this.innerHTML) === "";
          })
          .remove();

        return objectDOM;
      },

      serializeRangeOfDates: function () {
        var objectDOM = $(document.createElement("rangeofdates")),
          beginDateEl = $(document.createElement("begindate")),
          endDateEl = $(document.createElement("enddate"));

        if (this.get("beginDate")) {
          $(beginDateEl).append(
            this.serializeCalendarDate(this.get("beginDate")),
          );

          if (this.get("beginTime")) {
            $(beginDateEl).append(this.serializeTime(this.get("beginTime")));
          }

          objectDOM.append(beginDateEl);
        }

        if (this.get("endDate")) {
          $(endDateEl).append(this.serializeCalendarDate(this.get("endDate")));

          if (this.get("endTime")) {
            $(endDateEl).append(this.serializeTime(this.get("endTime")));
          }
          objectDOM.append(endDateEl);
        }

        return objectDOM;
      },

      serializeSingleDateTime: function () {
        var objectDOM = $(document.createElement("singleDateTime"));

        if (this.get("beginDate")) {
          $(objectDOM).append(
            this.serializeCalendarDate(this.get("beginDate")),
          );

          if (this.get("beginTime")) {
            $(objectDOM).append(this.serializeTime(this.get("beginTime")));
          }
        }

        return objectDOM;
      },

      serializeCalendarDate: function (date) {
        return $(document.createElement("calendarDate")).html(date);
      },

      serializeTime: function (time) {
        // Save the trimmed time accepted by parseTime, without its whitespace.
        return $(document.createElement("time")).html(time.trim());
      },

      trickleUpChange() {
        const parentModel = this.get("parentModel");
        const dataPackage = MetacatUI.rootDataPackage;
        const packageMember = dataPackage?.getMember?.(
          parentModel?.get?.("id"),
        );
        if (
          _.contains(dataPackage?.models, parentModel) ||
          packageMember?.objectModel === parentModel
        ) {
          EMLUtilities.markRootDataPackageChanged();
        }
      },

      mergeIntoParent: function () {
        if (
          this.get("parentModel") &&
          this.get("parentModel").type == "EML" &&
          !_.contains(this.get("parentModel").get("temporalCoverage"), this)
        )
          this.get("parentModel").get("temporalCoverage").push(this);
      },

      formatXML: function (xmlString) {
        return DataONEObject.prototype.formatXML.call(this, xmlString);
      },

      // Checks the values of this model and determines whether they are valid according the the EML 2.1.1 schema.
      // Returns a hash of error messages
      validate: function () {
        var beginDate = this.get("beginDate"),
          beginTime = this.get("beginTime"),
          endDate = this.get("endDate"),
          endTime = this.get("endTime"),
          errors = {};

        // A valid temporal coverage at least needs a start date
        if (!beginDate) {
          errors.beginDate = "Provide a begin date.";
        }
        // endTime is set but endDate is not
        else if (
          endTime &&
          endTime.length > 0 &&
          (!endDate || endDate.length == 0)
        ) {
          errors.endDate = "Provide an end date.";
        }

        //Check the validity of the date format
        if (beginDate && !EMLUtilities.isDateFormatValid(beginDate)) {
          errors.beginDate =
            "The begin date must be formatted as YYYY-MM-DD or YYYY.";
        }

        //Check the validity of the date format
        if (endDate && !EMLUtilities.isDateFormatValid(endDate)) {
          errors.endDate =
            "The end date must be formatted as YYYY-MM-DD or YYYY.";
        }

        if (typeof endDate == "string" && endDate.length && beginDate <= 0) {
          errors.beginDate = "The begin date must be greater than zero.";
        }

        if (typeof endDate == "string" && endDate.length && endDate <= 0) {
          errors.endDate = "The end date must be greater than zero.";
        }

        //Check the validity of the begin time format
        if (beginTime) {
          var timeErrorMessage = this.validateTimeFormat(beginTime);

          if (typeof timeErrorMessage == "string")
            errors.beginTime = timeErrorMessage;
        }

        //Check the validity of the end time format
        if (endTime) {
          var timeErrorMessage = this.validateTimeFormat(endTime);

          if (typeof timeErrorMessage == "string")
            errors.endTime = timeErrorMessage;
        }

        if (Object.keys(errors).length) return errors;

        const begin = beginTime ? EMLUtilities.parseTime(beginTime) : null;
        const end = endTime ? EMLUtilities.parseTime(endTime) : null;

        // A UTC comparison needs full calendar dates and both time zone offsets.
        // Dates with only a year and missing offsets do not identify exact instants.
        const compareFullDateTimes =
          beginDate.length === 10 &&
          endDate?.length === 10 &&
          begin &&
          end &&
          begin.offset !== null &&
          end.offset !== null;
        // Include the days between the dates before comparing the clock times.
        // Offsets can reverse the order suggested by the calendar dates alone.
        const dateDifferenceSeconds = compareFullDateTimes
          ? (Date.parse(beginDate) - Date.parse(endDate)) / 1000
          : 0;

        if (!compareFullDateTimes && this.isGreaterDate(beginDate, endDate))
          errors.beginDate = "The begin date must be before the end date.";

        if (
          begin &&
          end &&
          (compareFullDateTimes || beginDate === endDate) &&
          this.isGreaterTime(begin, end, dateDifferenceSeconds)
        ) {
          errors.beginTime = compareFullDateTimes
            ? MESSAGES.BEGIN_DATE_TIME_AFTER_END
            : MESSAGES.BEGIN_TIME_AFTER_END;
        }

        if (Object.keys(errors).length) return errors;
      },

      /**
       * Check an EML time and return a message the editor can display.
       * @param {string} time Time text to check
       * @returns {boolean|string} True for a valid xs:time value, or an error
       * message
       */
      validateTimeFormat(time) {
        return EMLUtilities.parseTime(time)
          ? true
          : MESSAGES.INVALID_TIME_FORMAT;
      },

      /**
       * This function checks whether the begin date is greater than the end date.
       *
       * @param {string} beginDate the begin date string
       * @param {string} endDate the end date string
       * @return {boolean}
       */
      isGreaterDate: function (beginDate, endDate) {
        if (typeof beginDate == "undefined" || !beginDate) return false;

        if (typeof endDate == "undefined" || !endDate) return false;

        //Making sure that beginDate year is smaller than endDate year
        if (beginDate.length == 4 && endDate.length == 4) {
          if (beginDate > endDate) {
            return true;
          }
        }

        //Checking equality for either dateStrings that are greater than 4 characters
        else {
          const beginDateParts = beginDate.split("-");
          const endDateParts = endDate.split("-");

          if (beginDateParts.length == endDateParts.length) {
            if (beginDateParts[0] > endDateParts[0]) {
              return true;
            } else if (beginDateParts[0] == endDateParts[0]) {
              if (beginDateParts[1] > endDateParts[1]) {
                return true;
              } else if (beginDateParts[1] == endDateParts[1]) {
                if (beginDateParts[2] > endDateParts[2]) {
                  return true;
                }
              }
            }
          } else {
            if (beginDateParts[0] > endDateParts[0]) {
              return true;
            }
          }
        }
        return false;
      },

      /**
       * Check whether the begin time is later than the end time.
       * @param {object} begin Begin time returned by EMLUtilities.parseTime
       * @param {object} end End time returned by EMLUtilities.parseTime
       * @param {number} dateDifferenceSeconds Begin date minus end date, in
       * seconds. Use 0 when comparing clock times without a date difference
       * @returns {boolean} True if the begin time is later; equal times return
       * false
       */
      isGreaterTime(begin, end, dateDifferenceSeconds) {
        let beginSeconds = dateDifferenceSeconds + begin.seconds;
        let endSeconds = end.seconds;

        // Without both offsets, UTC order is unknown. Compare the written clock
        // times without assigning a time zone to either value.
        if (begin.offset !== null && end.offset !== null) {
          beginSeconds -= begin.offset;
          endSeconds -= end.offset;
        }
        // Adding fractions during date and offset arithmetic can round equal
        // instants differently. Compare whole seconds first, then fractional
        // digits; right-padding makes .1 and .10 compare as equal.
        return (
          beginSeconds > endSeconds ||
          (beginSeconds === endSeconds &&
            begin.fraction.padEnd(end.fraction.length, "0") >
              end.fraction.padEnd(begin.fraction.length, "0"))
        );
      },

      /**
       * Checks if this model has no values set on it
       * @return {boolean}
       */
      isEmpty: function () {
        return (
          !this.get("beginDate") &&
          !this.get("beginTime") &&
          !this.get("endDate") &&
          !this.get("endTime")
        );
      },

      /*
       * Climbs up the model heirarchy until it finds the EML model
       *
       * @return {EML211 or false} - Returns the EML 211 Model or false if not found
       */
      getParentEML: function () {
        return EMLUtilities.getParentEML(this);
      },
    },
  );

  return EMLTemporalCoverage;
});
