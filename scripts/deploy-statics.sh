#!/bin/bash

set -euo pipefail

docker run -it --rm \
    -v "$(pwd)/frontend":/usr/src/app \
    -v "$(pwd)/build/frontend":/usr/src/app/build \
    -w /usr/src/app \
    node:21 \
    npm run build

docker run -it --rm \
    -v "$(pwd)/build/frontend":/contents \
    -w /contents \
    -v "$HOME/.aws:/root/.aws" \
    -e AWS_PROFILE=sendfiles \
    amazon/aws-cli \
    s3 sync --delete . s3://securesend-site/
