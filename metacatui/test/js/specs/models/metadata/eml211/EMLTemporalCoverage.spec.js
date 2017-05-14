"use strict";

define(["chai", "chai-jquery", "chai-backbone",
    "../../../../../../src/main/webapp/js/models/metadata/eml211/EMLTemporalCoverage"],
    function(chai, chaiJquery, chaiBackbone, EMLTemporalCoverage) {

        // Configure the Chai assertion library
        var should =  chai.should();
        var expect = chai.expect;

        // Pull in Jquery and Backbone-specific assertion libraries
        chai.use(chaiJquery); // exported from chai-jquery.js
        chai.use(chaiBackbone); // exported from chai-backbone.js

        describe("EMLTemporalCoverage Test Suite", function (){
            describe("parsing", function() {
                it('should correctly parse a range of dates', function() {
                    var m = new EMLTemporalCoverage({
                        objectDOM: $('<temporalcoverage><rangeofdates><begindate><calendardate>2015</calendardate><time>2000</time></begindate><endDate><calendardate>2016</calendardate></endDate></rangeofdates></temporalcoverage>').get(0)
                    });

                    expect(m.get('rangeOfDates').beginDate.calendarDate).to.equal('2015');
                    expect(m.get('rangeOfDates').beginDate.time).to.equal('2000');
                    expect(m.get('rangeOfDates').endDate.calendarDate).to.equal('2016');
                    should.not.exist(m.get('rangeOfDates').endDate.time);
                });

                it('should correctly parse a single date time', function() {
                    var m = new EMLTemporalCoverage({
                        objectDOM: $('<temporalcoverage><singledatetime><calendarDate>2015</calendarDate></singledatetime></temporalcoverage>').get(0)
                    });

                    expect(m.get('singleDateTime').calendarDate).to.equal('2015');
                });
            });

            describe("serializing", function() {
                it("should correctly serialize a range of dates", function() {

                });

                it ("should corectly serialize a single date time", function() {

                });
            })
        });
    });
