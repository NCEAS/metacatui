"""
This script generates release notes for MetacatUI based on the GitHub API.
Usage: python release_notes.py -m <milestone> -o <output_file>
Example: python make-release-notes.py -m 2.15.0 -o release_notes.md
Output: release notes in markdown format
The -o flag is optional. If not provided, the release notes will be printed to the console.
"""

import argparse
import sys
import os
import requests


def query_github(end_url):
    """Use the GitHub API and return info about MetacatUI, handle errors"""
    base_url = "https://api.github.com/repos/NCEAS/metacatui"
    headers = {"Accept": "application/vnd.github.v3+json"}
    url = f"{base_url}/{end_url}"
    response = requests.get(url, headers=headers)
    results = response.json()
    if "errors" in results:
        print(f"Error: {results['message']}")
        print(f"URL: {url}")
        print("Complete error response...")
        print(results)
        sys.exit(1)
    return results


# Parse command-line arguments:
parser = argparse.ArgumentParser(description="Generate release notes for MetacatUI")
parser.add_argument("-m", "--milestone", help="The milestone label", required=True)
parser.add_argument("-o", "--output", help="The output file", required=False)
args = parser.parse_args()

milestone_label = args.milestone
output_file = args.output

# Get the number for the milestone
milestones = query_github("milestones")
milestone = None
for m in milestones:
    if m["title"] == milestone_label:
        milestone = m["number"]
        break

if not milestone:
    print(f"Could not find milestone {milestone_label}")
    sys.exit(1)

print(f"Generating release notes for milestone {milestone_label}...")
print(f"Milestone number: {milestone}")

# Use the GitHub API to get the last release tag
last_release = query_github("releases/latest")
last_release = last_release["tag_name"]
print(f"Last release: {last_release}")

# API request to fetch issues for the milestone
issues = query_github(f"issues?milestone={milestone}&state=all")

print(f"Found {len(issues)} issues for milestone {milestone_label}...")

# Process issues and generate markdown output
template_data = {
    "new_features": "",
    "bug_fixes": "",
    "misc_improvements": "",
    "compare_url": f"https://github.com/NCEAS/metacatui/compare/{last_release}...{milestone_label}",
}

num_bugs = 0
num_features = 0
num_misc = 0

num_open = 0
num_closed = 0

# Categorize issues by label. Generate markdown list for each category.
for issue in issues:
    title = issue["title"]
    issue_num = issue["number"]
    issue_url = issue["html_url"]
    labels = [label["name"] for label in issue["labels"]]
    issue_string = f"- {title} [#{issue_num}]({issue_url})\n"

    state = issue["state"]
    if state == "open":
        num_open += 1
    else:
        num_closed += 1

    # sort according to label. "bug" = bug fix, "enhancement" = new feature, otherwise misc improvement
    if "bug" in labels:
        template_data["bug_fixes"] += issue_string
        num_bugs += 1
    elif "enhancement" in labels:
        template_data["new_features"] += issue_string
        num_features += 1
    else:
        template_data["misc_improvements"] += issue_string
        num_misc += 1

print(
    f"Found {num_bugs} bug fixes, {num_features} new features, and {num_misc} misc improvements"
)
print(f"{num_open} issues are still open, {num_closed} are closed")

template = f"""
# New features :tada:

## Feature 1

Description with screenshot

{template_data["new_features"]}

# Misc improvements

{template_data["misc_improvements"]}

# Bug fixes :hammer_and_wrench:

{template_data["bug_fixes"]}

# Developer notes

Important information that software developers who use MetacatUI for their repository UI should know

### New configuration options
- [configOption](https://nceas.github.io/metacatui/docs/AppConfig.html#configOption) - Description

### See the complete changelog: [{template_data["compare_url"]}]({template_data["compare_url"]})
"""


if output_file:
    with open(output_file, "w") as f:
        f.write(template)
    # Get the full path for printing
    output_file = os.path.abspath(output_file)
    print(f"Release notes written to {output_file}")
else:
    print("Release notes:\n\n")
    print(template)
