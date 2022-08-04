/**
 * Check that the fields and values match in the specified model
 * @param model
 * @param fields
 * @param values
 */
function checkFields(model, fields, values) {

    for (var i in fields) {
        console.log(model.get("title"))
        model.get(fields[i]).should.exist;
        model.get(fields[i]).should.equal(values[i]);
    }
}

define([
    "../../../../../../../../src/js/models/projects/Project",
], function (Project) {

    // Configure the Chai assertion library
    var should = chai.should();
    var expect = chai.expect;

    describe("ProjectTestSuite", function () {

        var model;
        var FIELDS = ["title", "id"];

        /* Setup */
        before(function () {

            // If needed
            model = new Project({
                "id": "5b5528e9-2f92-4728-91c0-255a9c4beded",
                "title": "Soil Carbon Biogeochemistry"
            });


        });

        /* Tear down */
        after(function () {
            // If needed

        });

        describe("The model object", function () {
            it('should exist', function () {
                expect(model).to.exist;
                model.should.exist;
            });

            it('should initialized attributes', function () {

                var values = ["Soil Carbon Biogeochemistry",
                    "5b5528e9-2f92-4728-91c0-255a9c4beded"]
                checkFields(model, FIELDS, values)

            });


            it('should have fetched attributes', function () {
                model = new Project({id: '6f6e4191-7916-44e5-b7d2-571ba00f67ee/'})

                if (model.urlBase){
                    model.fetch({
                        parse: true,
                        async: false,
                    })

                    var values = ["Coupling model intercomparison with synthesized experimental data across time and space to constrain carbon dynamics and biogeochemical cycling in permafrost ecosystems",
                        "6f6e4191-7916-44e5-b7d2-571ba00f67ee"]
                    checkFields(model, FIELDS, values)
                } else {
                    this._runnable.title += ` - Skipped with reason: No project api url set to test fetch.`
                    this.skip();
                }
            })


        });

    });
})
;

