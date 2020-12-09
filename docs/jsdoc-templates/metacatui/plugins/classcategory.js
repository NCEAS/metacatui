exports.defineTags = function(dictionary) {
  /* Define the @classcategory tag */
  dictionary.defineTag('classcategory', {
      canHaveType: false,
      canHaveName: false,
      isNamespace: false,
      mustHaveValue: true,
      mustNotHaveDescription: false,
      onTagged: function(doclet, tag){
        doclet.classcategory = tag.value;
      }
  });
};
