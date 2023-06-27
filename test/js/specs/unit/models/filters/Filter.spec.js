define(["../../../../../../../../src/js/models/filters/Filter"], function(Filter) {
    // Configure the Chai assertion library
    var should =  chai.should();
    var expect = chai.expect;
    let filter;

    describe("Filter Test Suite", function(){
        /* Set up */
        beforeEach(function(){
            filter = new Filter();
        })

        /* Tear down */
        afterEach(function() {
            filter = undefined;
        })

        describe("The Filter model", function(){
            it("should create a Filter model", function(){
                filter.should.be.instanceof(Filter)
            });
        });

        describe("Constructing queries", function(){

            it("should query for multiple terms", function(){
                filter.set({
                    "fields": ["origin"],
                    "values": ["Bart Simpson", "George"],
                    matchSubstring: false,
                    operator: "OR"
                });
                filter.getQuery().should.equal("origin:(\"Bart%20Simpson\"%20OR%20George)");
            })

            it("should query for multiple fields", function(){
                filter.set({
                    fields: ["keyword", "title", "abstract"],
                    values: ["ocean"],
                    matchSubstring: true,
                    operator: "AND"
                });
                filter.getQuery().should.equal("(keyword:*ocean*%20AND%20title:*ocean*%20AND%20abstract:*ocean*)");
            });

            it("should wrap phrases in quotes", function(){
                filter.set({
                    "fields": ["origin"],
                    "values": ["This is a phrase with spaces"],
                    matchSubstring: false
                });
                filter.getQuery().should.equal("origin:\"This%20is%20a%20phrase%20with%20spaces\"");
            })

            it("should wrap ids in quotes", function(){
                filter.set({
                    fields: ["id"],
                    values: ["urn:uuid:06e43be7-f3fb-43b9-b45c-0969880495fb"]
                });
                filter.getQuery().should.equal("id:\"urn%5C%3Auuid%5C%3A06e43be7%5C-f3fb%5C-43b9%5C-b45c%5C-0969880495fb\"")
                filter.set({
                    fields: ["abstract"],
                    values: ["urn:uuid:06e43be7-f3fb-43b9-b45c-0969880495fb"]
                });
                filter.getQuery().should.equal("abstract:\"urn%5C%3Auuid%5C%3A06e43be7%5C-f3fb%5C-43b9%5C-b45c%5C-0969880495fb\"")
            });

            it("should wrap group and person subjects in quotes", function(){
                filter.set({
                    fields: ["submitter"],
                    values: ["CN=knb-data-admins,DC=dataone,DC=org", "http://orcid.org/0000-0003-2192-431X"],
                    operator: "OR"
                });
                filter.getQuery().should.equal("submitter:(\"CN%3Dknb%5C-data%5C-admins%2CDC%3Ddataone%2CDC%3Dorg\"%20OR%20\"http%5C%3A%5C%2F%5C%2Forcid.org%5C%2F0000%5C-0003%5C-2192%5C-431X\")");
            });

            it("should escape special characters", function(){
                let actual = filter.escapeSpecialChar("+ - & || ! ( ) { } [ ] ^ \" ~ * ? : /");
                let expected = '\\+ \\-  \\|\\| \\! \\( \\) \\{ \\} \\[ \\] \\^ \\" \\~ * \\? \\: \\/'
                actual.should.equal(expected);
            });

            it("should encode queries", function(){
                filter.set({
                    fields: ["keyword"],
                    values: ["+ - & || ! ( ) { } [ ] ^ \" ~ * ? : /", "CN=knb-data-admins,DC=dataone,DC=org", "nothingtoencode", " "],
                    matchSubstring: false,
                    operator: "AND"
                });
                filter.getQuery().should.equal("keyword:(\"%5C%2B%20%5C-%20%20%5C%7C%5C%7C%20%5C!%20%5C(%20%5C)%20%5C%7B%20%5C%7D%20%5C%5B%20%5C%5D%20%5C%5E%20%5C%22%20%5C~%20*%20%5C%3F%20%5C%3A%20%5C%2F\"%20AND%20\"CN%3Dknb%5C-data%5C-admins%2CDC%3Ddataone%2CDC%3Dorg\"%20AND%20nothingtoencode%20AND%20)");
            });

        });

        describe("Parsing", function(){
            it("should parse filter xml")
        })

        describe("Serializing", function(){
            it("should update the XML DOM")
        })

        describe("Validating", function(){
            it("should be invalid if fields are not strings")

            it("should remove invalid values")

            it("should be invalid if there are no values")

            it("should only have an AND or OR operator")

            it("should have boolean exclude and matchSubstring")

            it("should reset attributes that should be strings")
        })

        describe("Utilities", function(){

            it("should recognize when the value has changed", function(){
                filter.hasChangedValues().should.be.false;
                filter.set("values", ["changed"]);
                filter.hasChangedValues().should.be.true;
            })

            it("should recognize date filters", function(){
                filter.isDateQuery("bad date 2016-03-22T23:00:00Z").should.be.false;
                filter.set("values", ["2016-03-22T23:00:00Z TO 2016-03-22T23:00:00Z"]);
                filter.isDateQuery().should.be.true;
            });

            it("should recognize id filters", function(){
                filter.set("fields", ["identifier"]);
                filter.isIdFilter().should.be.true;
                filter.set("fields", ["seriesId"]);
                filter.isIdFilter().should.be.true;
                filter.set("fields", ["other"]);
                filter.isIdFilter().should.be.false;

                filter.set("values", ["urn:uuid:e2b13725-76b1-496a-aa9a-c25aafe70c39"]);
                filter.isIdFilter().should.be.true;
                filter.set("values", ["doi:10.5072/FK2PZ5943J", "https://dx.doi.org/10.5072/FK2PZ5943J"]);
                filter.isIdFilter().should.be.true;
            })
        })
        
    });
});