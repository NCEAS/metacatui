# Test Generator Script

The `generate-tests.py` script helps create unit test starter files for MetacatUI. It generates test files with the basic structure and imports the necessary modules based on the file paths provided in the script.

## How to use

1. Update the `test_files` list in the `generate-tests.py` script with the relative paths of the files you want to create tests for (e.g., "collections/maps/Geohashes.js").

2. Run the script from the "test/scripts" directory:

```bash
cd test/scripts
python3 generate-tests.py
```

3. The script will create test files in the "test/js/specs/unit" directory with the appropriate folder structure. It will also print the paths of the created test files, which you'll need to add to the `test/config/tests.json` file.

4. Open the generated test files and add your test cases as needed.

## Notes

- The script assumes that the project repository is cloned to your local machine.
- It generates test files based on the relative paths provided in the `test_files` list.
- When a file name contains dashes, the corresponding module name will be in camel case (e.g., "Map-Search-Filters.js" -> "MapSearchFilters").