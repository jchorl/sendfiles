#!/bin/bash

set -euo pipefail

docker run \
    -e BIN=securesend \
    -e PROFILE=dev \
    -v ${PWD}/backend/transfers:/code \
    -v ${HOME}/.cargo/registry:/cargo/registry \
    -v ${HOME}/.cargo/git:/cargo/git \
    softprops/lambda-rust

unzip -o \
    backend/transfers/target/lambda/debug/securesend.zip \
    -d build/lambda
