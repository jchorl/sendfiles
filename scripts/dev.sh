#!/bin/bash

set -euo pipefail

docker run \
    --rm \
    -v ${PWD}/build/lambda:/var/task:ro,delegated \
    -e DOCKER_LAMBDA_STAY_OPEN=1 \
    -e DOCKER_LAMBDA_WATCH=1 \
    --env-file .aws_creds \
    -p 9001:9001 \
    lambci/lambda:provided
