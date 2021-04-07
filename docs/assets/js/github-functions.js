import { Octokit } from "https://cdn.skypack.dev/@octokit/rest";

const octokit = new Octokit({
  userAgent: "MetacatUI docs"
});
var markdownConverter = new showdown.Converter({ emoji: true });

export async function getLatestRelease(){
  var releaseTemplate =
  '<div class="git-release">\
    <h2 class="tag-name">MetacatUI v{{tag-name}}<span class="subtle">{{date}}</span></h2>\
    <a href="{{download-url}}" class="button"><img src="/assets/images/download.svg"/> Download</a>\
    <a href="{{github-url}}">View on GitHub</a>\
    <section class="release-notes">\
      {{release-notes}}\
    </section>\
  </div>';

  var tag = await octokit.rest.repos.getLatestRelease({
    owner: "NCEAS",
    repo: "metacatui"
  });

  let releaseHTML = "";

  let releaseNotes = markdownConverter.makeHtml(tag.data.body),
      date = new Date(tag.data.published_at);

  releaseHTML += releaseTemplate.replace(/{{release-notes}}/g, releaseNotes)
                                .replace(/{{tag-name}}/g, tag.data.tag_name)
                                .replace(/{{download-url}}/g, tag.data.zipball_url)
                                .replace(/{{github-url}}/g, tag.data.html_url)
                                .replace(/{{date}}/g, date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }));

  document.getElementById("releaseContainer").innerHTML = releaseHTML;
}

export async function getReleases(){

  var releaseListItemTemplate =
  '<div class="git-release-list-item">\
    <h2 class="tag-name">v{{tag-name}}<span class="subtle">{{date}}</span></h2>\
    <a href="{{github-url}}">View on GitHub</a> | \
    <a href="{{download-url}}">Download</a>\
  </div>';

  var { data: releases } = await octokit.rest.repos.listReleases({
    owner: "NCEAS",
    repo: "metacatui"
  });

  console.log(releases)

  var listHTML = "";

  for( let i=0; i<releases.length; i++){
    let release = releases[i];

    let date = new Date(release.published_at);

    listHTML += releaseListItemTemplate.replace(/{{tag-name}}/g, release.tag_name)
                                    .replace(/{{github-url}}/g, release.html_url)
                                    .replace(/{{download-url}}/g, release.zipball_url)
                                    .replace(/{{date}}/g, date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }));

  }

  document.getElementById("releaseListContainer").innerHTML = listHTML;

}
