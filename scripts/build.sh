#!/bin/bash

set -euo pipefail

docker run \
    -e BIN=securesend \
    -e PROFILE=dev \
    -v ${PWD}/backend:/code \
    -v ${HOME}/.cargo/registry:/cargo/registry \
    -v ${HOME}/.cargo/git:/cargo/git \
    softprops/lambda-rust

unzip -o \
    backend/target/lambda/debug/securesend.zip \
    -d build/lambda
