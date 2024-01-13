#!/bin/bash

set -eu

# https://stackoverflow.com/a/1885534
read -p "Have you rebuilt the binaries? " -n 1 -r
echo    # (optional) move to a new line
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    [[ "$0" = "$BASH_SOURCE" ]] && exit 1 || return 1 # handle exits from shell or function but don't exit interactive shell
fi

set -x

ln -s ../backend/target/aarch64-unknown-linux-gnu/release/coord build/bootstrap
zip -j -r build/deploy.zip build/bootstrap
aws --profile sendfiles --no-cli-pager lambda update-function-code --function-name coord_api --zip-file fileb://build/deploy.zip --publish
rm build/bootstrap build/deploy.zip

ln -s ../backend/target/aarch64-unknown-linux-gnu/release/transfers build/bootstrap
zip -j -r build/deploy.zip build/bootstrap
aws --profile sendfiles --no-cli-pager lambda update-function-code --function-name transfers_api --zip-file fileb://build/deploy.zip --publish
rm build/bootstrap build/deploy.zip
