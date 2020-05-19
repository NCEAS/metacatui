isJsdocInstalled=$(command -v jsdoc)

if [ -z $isJsdocInstalled ]
    then
      echo "The Node.js package 'jsdoc' isn't installed. Attempting to install with 'npm install jsdoc'..."
      npm install jsdoc
fi

isJsdocInstalled=$(command -v jsdoc)

if [ -z $isJsdocInstalled ]
    then
      echo "-------------------------------"
      echo "METACATUI DOCS BUILD ERROR: Installation of jsdoc failed. Please install jsdoc and try to run this script again: https://www.npmjs.com/package/jsdoc"
      echo "-------------------------------"
      exit
fi

# Build the documentation
currentFullDir=$(pwd)
currentDirOnly=${PWD##*/}
expectedDir="datadepot"
docsDir="docs"

# If we are in the expected directory (the root directory of MetacatUI)
if [ "$currentDirOnly" = "$expectedDir" ]
    then
      echo "Building MetacatUI docs..."
      #Build the jsdocs
      jsdoc -r -d docs/docs/ -c docs/jsdoc-templates/metacatui/conf.js src/js/
    elif [ "$currentDirOnly" = "$docsDir" ]
      then
        cd ../
        newDir=${PWD##*/}
        if [ "$newDir" = "$expectedDir" ]
            then
              echo "Building MetacatUI docs..."
              #Build the jsdocs
              jsdoc -r -d docs/docs/ -c docs/jsdoc-templates/metacatui/conf.js src/js/
              cd $currentFullDir
            else
              echo "-------------------------------"
              echo "METACATUI DOCS BUILD ERROR: Please run this command from the root directory of the MetacatUI app (datadepot) or from the datadepot/docs directory."
              echo "-------------------------------"
              exit
        fi
    else
      echo "-------------------------------"
      echo "METACATUI DOCS BUILD ERROR: Please run this command from the root directory of the MetacatUI app (datadepot) or from the datadepot/docs directory."
      echo "-------------------------------"
      exit
fi

echo "SUCCESS! View the documentation home page in your web browser: docs/docs/index.html"
