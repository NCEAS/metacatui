#!/bin/bash
# A script that installs MetacatUI

# EXPECTS THESE FOLLOWING ENV VARS TO BE PRE-SET
# REQUIRED:
# * tag - MetacatUI tag/version or branch name - e.g. 2.29.1
# * hostedRepoTheme - boolean
# * configFile
# * updateConfigPath
# * documentRootDir
#
# OPTIONAL:
# * themeLocation

# Remove the old backup and backup the currently deployed MetacatUI
echo -e "Backing up MetacatUI...."
sudo rm -rf ~/ui-bak;
sudo cp -rf /var/www/$documentRootDir ~/ui-bak;

# Get the latest MetacatUI release and unzip it
echo -e "Downloading MetacatUI $tag...."
curl -LO https://github.com/NCEAS/metacatui/archive/$tag.zip;
mv $tag.zip ~/;
unzip ~/$tag.zip -d ~/;

echo -e "Deploying MetacatUI $tag...."
# Configure MetacatUI
if $updateConfigPath ;
then
  # Update the config file path, for certain deployments (usually only production environment)
  oldPath="\/config\/config.js"
  sed "s/$oldPath/"${configFile//\//\\/}"/g" ~/metacatui-$tag/src/index.html > ~/metacatui-$tag/src/index.html.2;
  mv ~/metacatui-$tag/src/index.html.2 ~/metacatui-$tag/src/index.html;

  # If a hosted repo theme is specified, retrieve it
  if $hostedRepoTheme ;
  then
    # Clone the hosted-repositories repo
    git clone https://github.nceas.ucsb.edu/dataone/hosted-repositories.git;
    # Copy the theme directory to MetacatUI
    cp -rf hosted-repositories/$themeLocation ~/metacatui-$tag/src/js/themes/;
    #Remove the hosted-repositories git directory
    rm -rf hosted-repositories
  fi

else
  # Copy the config file to the MetacatUI config directory
  cp ../$configFile ~/metacatui-$tag/src/config/config.js;
fi

#Copy the MetacatUI src to the deployment location
sudo cp -rf ~/metacatui-$tag/src/* /var/www/$documentRootDir/;




####################################################################################################
## FOR REFERENCE ONLY:
##
#case $deployment in
#
#  knb)
#    configFile="/js/themes/knb/config.js"
#    updateConfigPath=true
#    documentRootDir="org.ecoinformatics.knb/metacatui"
#    echo -e "Upgrading KNB production"
#    ;;
#
#  arctic)
#    configFile="/catalog/js/themes/arctic/config.js"
#    updateConfigPath=true
#    documentRootDir="arcticdata.io/htdocs/catalog"
#    echo -e "Upgrading Arctic Data production"
#    ;;
#
#  dataone)
#    configFile="/js/themes/dataone/config.js"
#    updateConfigPath=true
#    documentRootDir="search.dataone.org"
#    echo -e "Upgrading DataONE production"
#    ;;
#
#  opc)
#    configFile="/js/themes/opc/config.js"
#    updateConfigPath=true
#    documentRootDir="opc.dataone.org"
#    hostedRepoTheme=true
#    themeLocation="src/opc/js/themes/opc"
#    echo -e "Upgrading OPC production"
#    ;;
#
#  cerp)
#    configFile="/js/themes/cerp/config.js"
#    updateConfigPath=true
#    documentRootDir="cerp-sfwmd.dataone.org"
#    hostedRepoTheme=true
#    themeLocation="src/cerp/js/themes/cerp"
#    echo -e "Upgrading CERP-SFWMD production"
#    ;;
#
#  drp)
#    configFile="/js/themes/drp/config.js"
#    updateConfigPath=true
#    documentRootDir="drp.dataone.org"
#    hostedRepoTheme=true
#    themeLocation="src/drp/js/themes/drp"
#    echo -e "Upgrading DRP production"
#    ;;
#
#  dev.nceas)
#    configFile="dev.nceas.js"
#    documentRootDir="edu.ucsb.nceas.dev"
#    echo -e "Upgrading dev.nceas"
#    ;;
#
#  test.arcticdata)
#    configFile="test.arcticdata.js"
#    documentRootDir="test.arcticdata.io"
#    echo -e "Upgrading test.arcticdata.io"
#    ;;
#
#  demo.arcticdata)
#    configFile="demo.arcticdata.js"
#    documentRootDir="demo.arcticdata.io"
#    echo -e "Upgrading demo.arcticdata.io"
#    ;;
#
#  demo.nceas)
#    configFile="dev.nceas.js"
#    documentRootDir="demo.nceas.ucsb.edu"
#    echo -e "Upgrading demo.nceas"
#    ;;
#
#  search-sandbox)
#    configFile="search-sandbox.js"
#    documentRootDir="search-sandbox.test.dataone.org"
#    echo -e "Upgrading search-sandbox.test.dataone.org"
#    ;;
#
#  search-stage)
#    configFile="search-stage.js"
#    documentRootDir="search-stage.test.dataone.org"
#    echo -e "Upgrading search-stage.test.dataone.org"
#    ;;
#
#  search.test)
#    configFile="search.test.js"
#    documentRootDir="search.test.dataone.org"
#    echo -e "Upgrading search.test.dataone.org"
#    ;;
#
#  search-demo)
#    configFile="search-demo.js"
#    documentRootDir="search-demo.dataone.org"
#    echo -e "Upgrading search-demo.dataone.org"
#    ;;
#
#  plus-preview-fancy-vulture)
#    configFile="dataone-plus-preview.js"
#    documentRootDir="fancy-vulture.nceas.ucsb.edu"
#    echo -e "Upgrading Fancy Vulture to DataONE Plus Preview Production"
#    ;;
#
#  *)
#    echo -e "Deployment unknown. Please upgrade MetacatUI manually."
#    exit
#    ;;
#esac
