#!/bin/bash

set -euo pipefail

docker run --rm \
    -v ${PWD}/backend/transfers:/code \
    -v ${HOME}/.cargo/registry:/root/.cargo/registry \
    -v ${HOME}/.cargo/git:/root/.cargo/git \
    softprops/lambda-rust

cp \
    backend/transfers/target/lambda/release/securesend.zip \
    build/transfers_lambda.zip
