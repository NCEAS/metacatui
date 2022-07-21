define([
    "../../../../../../../../src/js/collections/ProjectList"
], function (ProjectList) {

    var should =  chai.should();
    var expect = chai.expect;

    describe("ProjectListTestSuite", function () {

        var collection;

        /* Setup */
        before(function () {
            // If needed
            collection = new ProjectList([
                    {
                        "id": "6f6e4191-7916-44e5-b7d2-571ba00f67ee",
                        "title": "Coupling model intercomparison with synthesized experimental data across time and space to constrain carbon dynamics and biogeochemical cycling in permafrost ecosystems"
                    },
                    {
                        "id": "5b5528e9-2f92-4728-91c0-255a9c4beded",
                        "title": "Soil Carbon Biogeochemistry"
                    }
                ]
                ,{parse: true, async: false});
        });

        /* Tear down */
        after(function () {
            // If needed

        });

        describe("The collection object", function () {
            it('should exist', function () {
                console.log(collection)
                expect(collection).to.exist;
                collection.should.exist;
                collection.length.should.equal(2)
                _.each(collection.models, function (model) {
                    expect(model).to.exist;
                    expect(model.id).to.exist;
                    expect(model.get("title")).to.exist;
                })

            });
        });
    });
})
;

