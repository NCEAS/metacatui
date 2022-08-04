define(["../../../../../../../../src/js/collections/SolrResults", "../../../../../../../../src/js/models/Search"], function(SolrResults, Search) {
    // Configure the Chai assertion library
    var should =  chai.should();
    var expect = chai.expect;

    describe("SolrResults Test Suite", function(){

        beforeEach(function(){
            
        })

        describe("Sending the default Data Catalog query", function(){
            
            it("should get the correct results", function(done){
                let solrResults = new SolrResults();
                let search = new Search();
                solrResults.setfields("id,seriesId,title,origin,pubDate,dateUploaded,abstract,resourceMap,beginDate,endDate,read_count_i,geohash_9,datasource,isPublic,documents,sem_annotation,northBoundCoord,southBoundCoord,eastBoundCoord,westBoundCoord,formatType,formatId");
                solrResults.setQuery(search.getQuery());
                solrResults.rows = 25;
                solrResults.start = 0;
                solrResults.toPage(0);

                solrResults.once("reset", function(){
                    solrResults.length.should.equal(25);   
                    solrResults.pluck("obsoletedBy").every(r => r === null).should.be.true;
                    solrResults.pluck("formatType").every(r => r === "METADATA").should.be.true;
                    solrResults.pluck("formatId").every(r => { 
                        let e = new RegExp(/dataone\.org\/(portals|collections)/, 'g');
                        return e.test(r);
                    }).should.be.false;
                    solrResults.pluck("archived").every(r => r === false).should.be.true;
                    
                    done();
                });
            });
        
        });

        describe("Adding filters", function(){

            it("should filter by id", function(done){
                let solrResults = new SolrResults();
                let search = new Search();
                solrResults.rows = 1;
                solrResults.start = 0;
                solrResults.setfields("identifier");
                search.set("id", ["urn:uuid:*"])
                //Force it to only use the 'identifier' field so we can verify the filter worked as intended
                search.fieldNameMap.id = ["identifier"]
                solrResults.setQuery(search.getQuery());

                solrResults.once("reset", function(){
                    solrResults.length.should.equal(1);   
                    solrResults.pluck("identifier").every(r => { 
                        let e = new RegExp(/^urn:uuid:/, 'g');
                        return e.test(r);
                    }).should.be.true;
                    done()
                });
                solrResults.once("error", function(){
                    done(new Error("Server error. "))
                });

                solrResults.toPage(0);
            });

            it("should filter by 'all'", function(done){
                let solrResults = new SolrResults();
                let search = new Search();
                solrResults.rows = 5;
                solrResults.start = 0;
                solrResults.setfields("text");
                search.set("all", ["ocean"])
                solrResults.setQuery(search.getQuery());

                solrResults.once("reset", function(){
                    solrResults.length.should.equal(5);
                    solrResults.pluck("text").every(r => { 
                        let e = new RegExp(/ocean|Ocean/, 'g');
                        return e.test(r);
                    }).should.be.true;
                    done()
                });
                solrResults.once("error", function(){
                    done(new Error("Server error. "))
                });

                solrResults.toPage(0);
            })

            it("should filter by data year", function(done){
                let solrResults=new SolrResults();
                let search=new Search();
                solrResults.rows = 5;
                solrResults.start = 0;
                solrResults.setfields("beginDate,endDate");
                search.set("dataYear", true)
                search.set("yearMin", 2018);
                search.set("yearMax", 2025);
                solrResults.setQuery(search.getQuery());

                solrResults.once("reset", function(){
                    console.log(solrResults)
                    solrResults.length.should.equal(5);
                    solrResults.pluck("beginDate").every(r => { 
                        console.log(r)
                        let d = new Date(r);
                        d = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCMilliseconds());
                        console.log(d)
                        return d > (new Date(Date.UTC(2017, 11, 31, 23, 59, 59)))
                    }).should.be.true;
                    solrResults.pluck("endDate").every(r => { 
                        let d = new Date(r);
                        d = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCMilliseconds());
                        return d < (new Date(Date.UTC(2026, 00, 01, 00, 00, 00)))
                    }).should.be.true;
                    done()
                });
                solrResults.once("error", function(){
                    done(new Error("Server error. "))
                });

                solrResults.toPage(0);
            })
        });

        describe("Special characters", function(){
            it("should escape special characters", function(done){
                let solrResults = new SolrResults();
                let search = new Search();
                search.set("all", ['+ - & || ! ( ) { } [ ] ^ " ~ * ? : /', '"', " "]);
                solrResults.rows = 0;
                solrResults.start = 0;
                solrResults.setfields("");
                solrResults.setQuery(search.getQuery());

                solrResults.once("reset", function(){
                    done()
                });
                solrResults.once("error", function(){
                    done(new Error("Special characters were not escaped properly. "))
                });

                solrResults.toPage(0);
            })
        })
        
    });
});