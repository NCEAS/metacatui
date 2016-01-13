#!/bin/bash

if [ -f index-msg.html ]
    then
        mv index.html index.bak
        mv index-msg.html index.html
        echo "Under maintenance message is ON"
    else
        echo "Under maintenance message is OFF"
        mv index.html index-msg.html
        mv index.bak index.html
fi