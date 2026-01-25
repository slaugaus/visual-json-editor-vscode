#!/bin/bash

# "npm" wrapper for bun for "vsce"
# https://github.com/microsoft/vscode-vsce/issues/1108#issuecomment-3340257562

# If arg 1 is "list", list installed packages
if [ "$1" == "list" ]; then
    pwd
    exit 0
fi

# Fallback
bun $@