import os
import re

# Update these paths to those that you would like to create test files for.
test_files = [
    "collections/maps/Geohashes.js",
    "models/connectors/Filters-Map.js",
    "models/connectors/Filters-Search.js",
    "models/connectors/Map-Search-Filters.js",
    "models/connectors/Map-Search.js",
    "models/filters/SpatialFilter.js",
    "models/maps/Geohash.js",
    "models/maps/assets/CesiumGeohash.js",
]

test_template = """
define([
  "{import_path}",
], function ({module_name}) {{
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("{module_name} Test Suite", function () {{
    /* Set up */
    beforeEach(function () {{}});

    /* Tear down */
    afterEach(function () {{}});

    describe("Initialization", function () {{
      it("should create a {module_name} instance", function () {{
        new {module_name}().should.be.instanceof({module_name});
      }});
    }});
  }});
}});
"""

def camel_case(name):
    return "".join(word.capitalize() for word in name.split("-"))

script_dir = os.path.dirname(os.path.realpath(__file__))
project_root = os.path.join(script_dir, '..', '..')

created_paths = []

for test_file in test_files:
    test_path = os.path.join(project_root, 'test', 'js', 'specs', 'unit', test_file.replace(".js", ".spec.js"))
    dir_path = os.path.dirname(test_path)

    if not os.path.exists(dir_path):
        os.makedirs(dir_path)

    module_path = os.path.join("src", "js", test_file)
    module_name = camel_case(test_file.split("/")[-1].replace(".js", ""))

    relative_module_path = "../../../../../../../../" + module_path
    relative_module_path = re.sub(r"\.js$", "", relative_module_path)

    with open(test_path, "w") as f:
        content = test_template.format(
            import_path=relative_module_path, module_name=module_name
        )
        f.write(content.strip())

    created_paths.append(f'./{os.path.relpath(test_path, project_root)}')

print("Unit test starter files created.")
print("\nRemember to add these paths to the `test/config/tests.json` file! 🚀🎉")
for path in created_paths:
    path = re.sub(r"^\./test", ".", path)
    print(f'"{path}",')
