define(["../../../../../../../../src/js/models/Search"], function(Search) {
    // Configure the Chai assertion library
    var should =  chai.should();
    var expect = chai.expect;
    let search;

    describe("Search Test Suite", function(){
        /* Set up */
        beforeEach(function(){
        })

        /* Tear down */
        after(function() {
            search = undefined;
        });

        describe("The Search model", function(){
            it("should be created", function(){
                search = new Search();
                search.should.be.instanceof(Search);
            })
        })

        describe("Constructing search queries", function(){

            //The default DataCatalogView search
            describe("The default Data Catalog query", function(){

                let query = "";

                before(function(){
                    search = new Search();
                    query = search.getQuery();
                });

                it("should get metadata only", function(){
                    expect( query.indexOf("formatType:METADATA") ).to.be.at.least(0, "metadata filter is not in the query string ");
                })

                it("should exclude portals and collections", function(){
                    expect( query.indexOf(" -formatId:*dataone.org%5C%2Fcollections* ")).to.be.at.least(0, `collections filter is not in the query: (${query})`)
                    expect( query.indexOf(" -formatId:*dataone.org%5C%2Fportals* ")).to.be.at.least(0, `portals filter is not in the query: (${query})`)
                })

                it("should exclude obsoleted metadata", function(){
                    expect( query.indexOf("-obsoletedBy:*")).to.be.at.least(0, "obsoletedBy is not in the query")
                })

            })

            describe("Adding filters", function(){
                beforeEach(function(){
                    search = new Search();
                })

                it("should add an All filter", function(){
                    let filter = {
                        value: "ocean"
                    };
                    
                    //Add the filter
                    let filters = search.get("all");
                    filters.push(filter);    
                    search.set("all", filters);
                    let all = search.get("all");
                    
                    all.should.have.lengthOf(1);
                    all.should.deep.include({
                        value: "ocean"
                    });

                    let query = search.getQuery();
                    query.indexOf("AND ocean").should.be.at.least(0, `filter is not in the query string: (${query})`);

                });

                it("should add two All filters", function(){
                    //Add the filter
                    let filters = search.get("all");
                    filters.push({ value: "ocean" });
                    filters.push({ value: "shark" });
                    search.set("all", filters);
                    let all = search.get("all");

                    all.should.have.lengthOf(2);
                    all.should.have.deep.members([{ value: "ocean" }, { value: "shark" }]);

                    let query = search.getQuery();
                    query.indexOf("AND ocean AND shark").should.be.at.least(0, `filter is not in the query string: (${query})`);

                })

                it("should add a creator filter", function(){
                    let filter = {
                        value: "Homer Simpson",
                        filterLabel: "Homer",
                        label: "H",
                        description: "This is a person named Homer"
                    };
                    
                    //Add the creator filter
                    let filters = search.get("creator");
                    filters.push(filter);    
                    search.set("creator", filters);
                    let creators = search.get("creator");
                    
                    creators.should.have.lengthOf(1);
                    creators.should.deep.include({
                        value: "Homer Simpson",
                        filterLabel: "Homer",
                        label: "H",
                        description: "This is a person named Homer"
                    });

                    let query = search.getQuery();
                    query.indexOf(search.fieldNameMap.creator + ":%22Homer%20Simpson%22").should.be.at.least(0);
                });

                it("should add a location filter", function(){
                    let filter = {
                        value: "A place",
                    };
                    
                    //Add the filter
                    let filters = search.get("spatial");
                    filters.push(filter);    
                    search.set("spatial", filters);
                    let spatial = search.get("spatial");
                    
                    spatial.should.have.lengthOf(1);
                    spatial.should.deep.include({
                        value: "A place"
                    });

                    let query = search.getQuery();
                    query.indexOf(search.fieldNameMap.spatial + ":%22A%20place%22").should.be.at.least(0, `filter is not in the query string: (${query})`);
                });

                it("should add a begin and end date filter", function(){
                    search.set("yearMin", 1800);
                    search.set("yearMax", 2015);
                    search.set("dataYear", true);
                    search.set("pubYear", false);

                    let query = search.getQuery();
                    query.indexOf("beginDate:[1800-01-01T00:00:00Z TO *]" +
                                  " AND endDate:[* TO 2015-12-31T00:00:00Z]").should.be.at.least(0, `filter is not in the query string: (${query})`);
                });

                it("should add an access filter", function(){
                    search.set("isPrivate", true);

                    let query = search.getQuery();
                    query.indexOf("-isPublic:true AND").should.be.at.least(0, `filter is not in the query string: (${query})`);
                });

                it("escape special characters", function(){
                    search.set("all", ["+ - & || ! ( ) { } [ ] ^ \" ~ * ? : /"]);

                    let query = search.getQuery();
                    console.log(query)
                    let expectedQuery = "%5C%22%5C%2B%20%5C-%20%20%5C%7C%5C%7C%20!%20%5C(%20%5C)%20%5C%7B%20%5C%7D%20%5C%5B%20%5C%5D%20%5C%5E%20%5C%22%20%5C~%20*%20%5C%3F%20%5C%3A%20%5C%2F%5C%22"
                    query.indexOf(expectedQuery).should.be.at.least(0, `filter is not in the query string: (${query})`);
                });


            });
        })

        
    });
});