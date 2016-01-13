#!/bin/bash

dir=$1
echo -e "Directory: $dir \n..\n.."

if [ -f $dir/index-msg.html ]
    then
        mv $dir/index.html $dir/index.bak
        mv $dir/index-msg.html $dir/index.html
        echo "Under maintenance message is ON"
elif [ -f $dir/index.bak ]
    then
        echo "Under maintenance message is OFF"
        mv $dir/index.html $dir/index-msg.html
        mv $dir/index.bak $dir/index.html
else
    echo "ERROR: File not found at $dir. Please check that you passed the directory path to the index.html file. Example: 'bash toggle-index.sh /var/www/www.site.com'"
fi