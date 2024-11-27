#!/bin/bash

set -euo pipefail

docker run -it --rm \
    -v "$(pwd)/frontend":/usr/src/app \
    -v "$(pwd)/build/frontend":/usr/src/app/build \
    -w /usr/src/app \
    node:23 \
    npm run build

aws --profile sendfiles s3 sync --delete build/frontend s3://securesend-site/
