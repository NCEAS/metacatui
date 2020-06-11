# Define colors to use when echoing messages
NC='\033[0m'
GRAY='\033[0;37m'
RED='\033[0;31m'
PURPLE='\033[0;32m'

# Check if jsdoc is installed. If not, try installing it via npm
isJsdocInstalled=$(command -v jsdoc)
if [ -z $isJsdocInstalled ]
    then
      echo -e "${GRAY}The Node.js package 'jsdoc' isn't installed. Attempting to install with 'npm install jsdoc'..."
      npm install jsdoc
fi

# Check if the installation succeeded. If not, display an error and exit
isJsdocInstalled=$(command -v jsdoc)
if [ -z $isJsdocInstalled ]
    then
      echo "${RED}-------------------------------"
      echo "METACATUI DOCS BUILD ERROR: Installation of jsdoc failed. Please install jsdoc and try to run this script again: https://www.npmjs.com/package/jsdoc"
      echo "-------------------------------${NC}"
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
      echo -e "${GRAY}Building MetacatUI docs...${NC}"
      #Build the jsdocs
      jsdoc -r -d docs/docs/ -c docs/jsdoc-templates/metacatui/conf.js src/
    elif [ "$currentDirOnly" = "$docsDir" ]
      then
        cd ../
        newDir=${PWD##*/}
        if [ "$newDir" = "$expectedDir" ]
            then
              echo -e "${GRAY}Building MetacatUI docs...${NC}"
              #Build the jsdocs
              jsdoc -r -d docs/docs/ -c docs/jsdoc-templates/metacatui/conf.js src/
              cd $currentFullDir
            else
              echo -e "${RED}-------------------------------"
              echo -e "METACATUI DOCS BUILD ERROR: Please run this command from the root directory of the MetacatUI app (datadepot) or from the datadepot/docs directory."
              echo -e "-------------------------------${NC}"
              exit
        fi
    else
      echo -e "${RED}-------------------------------"
      echo -e "METACATUI DOCS BUILD ERROR: Please run this command from the root directory of the MetacatUI app (datadepot) or from the datadepot/docs directory."
      echo -e "-------------------------------${NC}"
      exit
fi

echo -e "${PURPLE}SUCCESS! View the documentation home page in your web browser: docs/docs/index.html${NC}"
