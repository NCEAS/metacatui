define(['showdown', 'citation'], function (showdown, citation) {

	return showdown.extension('showdown-citation', function() {

		const Cite = require('citation-js');

		var AllM = new Array();

		// var urlExpression = /[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi;
		// var urlRegex = new RegExp(expression);

		var extension1 = {
		    type: "lang",
			filter: function (text, converter, options) {
			    // use showdown's regexp engine to conditionally parse codeblocks
			    var left  = '\\^\\[',
					right = '\\]',
					flags = 'g',
					replacement = function (wholeMatch, match, left, right) {

						// TODO: remove leading `doi:`

						let citeInfo = new Cite(match);

						if(citeInfo.data.length == 0){

							console.log("no match found for " + match)

							return(wholeMatch);

						} else {

							//let citeID = citeInfo.data[0].id;

							let citeInline = citeInfo.format('citation', {});

							let citeBib = citeInfo.format('bibliography', {
								format: 'html',
								template: 'apa',
								lang: 'en-US'
							})

							// TODO: add <a> tags to url, other formatting
							AllM.push(citeBib);

							return("<a href=\"#bibliography\" class = \"inlineCitation\">" + citeInline + "</a>");
						}

					};

			    return showdown.helper.replaceRecursiveRegExp(text, replacement, left, right, flags);
			}
		}

		var extension2 = {
			type: "output",
			filter: function(text){

				return ( text + "<h2 id='bibliography'>Bibliography</h2>" + AllM.join(""));
			}
		}

		return [extension1, extension2];

	});

});
