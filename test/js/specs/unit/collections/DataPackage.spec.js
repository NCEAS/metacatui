define(["../../../../../../../../src/js/collections/DataPackage"], function(DataPackage) {
    const chai = require('chai');
    const expect = chai.expect;

    describe("DataPackage Test Suite", function() {
        let basePath;
        let dataPackage;

        beforeEach(function() {
            basePath = '/path/to/base';
            dataPackage = new DataPackage();
        });

        afterEach(function() {
            basePath = undefined;
            dataPackage = undefined;
        });

        describe("Resolving relative paths", function() {
            it("should resolve a relative path with '..', '.', and '~'", function() {
                const relativePath = '~/q/../w.csv';
                const result = dataPackage.getAbsolutePath(basePath, relativePath);
                expect(result).to.equal('/path/to/base/q/w.csv');
            });

            it("should handle empty relative path", function() {
                const relativePath = '';
                const result = dataPackage.getAbsolutePath(basePath, relativePath);
                expect(result).to.equal('/path/to/base');
            });

            it("should handle relative path with '~' (ignoring '~')", function() {
                const relativePath = '~/q/w.csv';
                const result = dataPackage.getAbsolutePath(basePath, relativePath);
                expect(result).to.equal('/path/to/base/q/w.csv');
            });

            it("should handle relative path with multiple consecutive '/'", function() {
                const relativePath = 'folder1///folder2/file.txt';
                const result = dataPackage.getAbsolutePath(basePath, relativePath);
                expect(result).to.equal('/path/to/base/folder1/folder2/file.txt');
            });
        });
    });
});
