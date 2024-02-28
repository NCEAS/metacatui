"use strict";

define(["models/maps/GeoPoint",], function (GeoPoint) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("GeoPoint Test Suite", function () {
    /* Set up */
    beforeEach(function () { });

    /* Tear down */
    afterEach(function () { });

    describe("Initialization", function () {
      it("should create a GeoPoint instance", function () {
        new GeoPoint().should.be.instanceof(GeoPoint);
      });
    });

    describe("Validation", function () {
      it("should validate a valid GeoPoint", function () {
        var point = new GeoPoint({
          latitude: 0,
          longitude: 0,
          height: 0
        });
        point.isValid().should.be.true;
      });

      it("should invalidate a GeoPoint with an invalid latitude", function () {
        var point = new GeoPoint({
          latitude: 100,
          longitude: 0,
          height: 0
        });
        point.isValid().should.be.false;
      });

      it("includes a latitude-specific validation error", function () {
        var point = new GeoPoint({
          latitude: 100,
          longitude: 0,
          height: 0
        });

        point.isValid();

        expect(point.validationError).to.deep.equal({
          latitude: 'Invalid latitude. Must be between -90 and 90.'
        });
      });

      it("should invalidate a GeoPoint with an invalid longitude", function () {
        var point = new GeoPoint({
          latitude: 0,
          longitude: 200,
          height: 0
        });
        point.isValid().should.be.false;
      });

      it("includes a longitude-specific validation error", function () {
        var point = new GeoPoint({
          latitude: 0,
          longitude: 200,
          height: 0
        });

        point.isValid();

        expect(point.validationError).to.deep.equal({
          longitude: 'Invalid longitude. Must be between -180 and 180.'
        });
      });

      it("should invalidate a GeoPoint with an invalid height", function () {
        var point = new GeoPoint({
          latitude: 0,
          longitude: 0,
          height: "foo"
        });
        point.isValid().should.be.false;
      });

      it("includes a height-specific validation error", function () {
        var point = new GeoPoint({
          latitude: 0,
          longitude: 0,
          height: "foo"
        });

        point.isValid();

        expect(point.validationError).to.deep.equal({
          height: 'Invalid height. Must be a number.'
        });
      });
    });

    describe('Instantiation', () => {
      describe('from a good string', () => {
        it('uses the user\'s search query when zooming', () => {
          const geoPoint = GeoPoint.fromString('13,37');

          expect(geoPoint.attributes.latitude).to.equal(13);
          expect(geoPoint.attributes.longitude).to.equal(37);
        });

        it('accepts two space-separated numbers', () => {
          const geoPoint = GeoPoint.fromString('13 37');

          expect(geoPoint.attributes.latitude).to.equal(13);
          expect(geoPoint.attributes.longitude).to.equal(37);
        });

        it('accepts input with \'-\' signs', () => {
          const geoPoint = GeoPoint.fromString('13,-37');

          expect(geoPoint.attributes.latitude).to.equal(13);
          expect(geoPoint.attributes.longitude).to.equal(-37);
        });

        it('accepts input of with \'+\' signs', () => {
          const geoPoint = GeoPoint.fromString('13,+37');

          expect(geoPoint.attributes.latitude).to.equal(13);
          expect(geoPoint.attributes.longitude).to.equal(37);
        });

        it('accepts input with a trailing comma', () => {
          const geoPoint = GeoPoint.fromString('13,37,');

          expect(geoPoint.attributes.latitude).to.equal(13);
          expect(geoPoint.attributes.longitude).to.equal(37);
        });
      });

      describe('from a bad string', () => {
        it('shows an error when only a single number is entered', () => {
          expect(() => {
            GeoPoint.fromString('13');
          }).to.throw(Error, /Try entering a search query with two numerical values/);
        });

        it('shows an error when non-numeric characters are entered', () => {
          expect(() => {
            GeoPoint.fromString('13,37a');
          }).to.throw(Error, /Try entering a search query with two numerical values/);
        });
      });
    });

    describe("Detecting latitude, longitude in string", () => {
      it('accepts empty string', () => {
        expect(GeoPoint.couldBeLatLong('')).to.be.true;
      });

      it('accepts white space in a string', () => {
        expect(GeoPoint.couldBeLatLong('  1  ')).to.be.true;
      });

      it('accepts input with a single number', () => {
        expect(GeoPoint.couldBeLatLong('13')).to.be.true;
      });

      it('accepts input with floating point numbers', () => {
        expect(GeoPoint.couldBeLatLong('13.0001, .0002')).to.be.true;
      });

      it('accepts input with a trailing comma', () => {
        expect(GeoPoint.couldBeLatLong('13,')).to.be.true;
      });

      it('accepts input with a \'-\' or \'+\'', () => {
        expect(GeoPoint.couldBeLatLong('-13 +37')).to.be.true;
      });

      it('does not accept input with alpha characters', () => {
        expect(GeoPoint.couldBeLatLong('13,37a')).to.be.false;
      });

      it('does not accept input with symbols', () => {
        expect(GeoPoint.couldBeLatLong('13,37/')).to.be.false;
      });
    });
  });
});