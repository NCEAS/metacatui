define(["../../../../../../../../src/js/models/metadata/eml211/EMLTemporalCoverage"],
    function(EMLTemporalCoverage) {

        // Configure the Chai assertion library
        var should =  chai.should();
        var expect = chai.expect;

        describe("EMLTemporalCoverage Test Suite", function (){
            describe("parsing", function() {
                it('should correctly parse a range of dates', function() {
                    var m = new EMLTemporalCoverage({
                        objectDOM: $('<temporalcoverage><rangeofdates><begindate><calendardate>2015</calendardate><time>2000</time></begindate><endDate><calendardate>2016</calendardate></endDate></rangeofdates></temporalcoverage>').get(0)
                    });

                    expect(m.get('beginDate')).to.equal('2015');
                    expect(m.get('beginTime')).to.equal('2000');
                    expect(m.get('endDate')).to.equal('2016');
                    should.not.exist(m.get('time'));
                });

                it('should correctly parse a single date time', function() {
                    var m = new EMLTemporalCoverage({
                        objectDOM: $('<temporalcoverage><singledatetime><calendarDate>2015</calendarDate></singledatetime></temporalcoverage>').get(0)
                    });

                    expect(m.get('beginDate')).to.equal('2015');
                });
            });

            describe("serializing", function() {
                it("should serialize a singleDateTime when endDate is not set on rangeOfDates", function() {
                    var m = new EMLTemporalCoverage({
                        objectDOM: $('<temporalcoverage><rangeofdates><begindate><calendardate>2015</calendardate></begindate></rangeofdates></temporalcoverage>').get(0)
                    });

                    expect(m.serialize()).to.equal('<temporalCoverage><singleDateTime><calendarDate>2015</calendarDate></singleDateTime></temporalCoverage>');
                });

                it("should not serialize beginTime if beginDate is null", function() {
                    var m = new EMLTemporalCoverage({});
                    m.set('beginTime', '12345', {silent: true});

                    expect(m.serialize()).to.equal('');
                });

                it ("should be invalid when all fields are null", function(){
                    expect(new EMLTemporalCoverage().isValid()).to.equal(false);
                });

                it ("should be invalid when the wrong set of fields are set", function() {
                    var m = new EMLTemporalCoverage({});
                    m.set('beginTime', '12345', {silent: true});
                    expect(m.isValid()).to.equal(false);

                    var m = new EMLTemporalCoverage({});
                    m.set('endTime', '12345', {silent: true});
                    expect(m.isValid()).to.equal(false);

                    var m = new EMLTemporalCoverage({});
                    m.set('endDate', '12345', {silent: true});
                    expect(m.isValid()).to.equal(false);
                });
            })
        });
    });
