#!/bin/bash

set -euo pipefail

docker run -it --rm \
    -v "$(pwd)/frontend":/securesend:ro \
    -v "$(pwd)/build/frontend":/securesend/build \
    -w /securesend \
    node:14.12 \
    yarn build

docker run -it --rm \
    -v "$(pwd)/build/frontend":/contents \
    -w /contents \
    --env-file .aws_creds \
    amazon/aws-cli \
    s3 sync --delete . s3://securesend-site/
