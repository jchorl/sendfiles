#!/bin/bash

set -euo pipefail

docker run --rm \
    -v ${PWD}/backend/coord:/code \
    -v ${HOME}/.cargo/registry:/root/.cargo/registry \
    -v ${HOME}/.cargo/git:/root/.cargo/git \
    softprops/lambda-rust

cp \
    backend/coord/target/lambda/release/coord.zip \
    build/coord_lambda.zip
