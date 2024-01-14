# sendfiles.dev

[sendfiles.dev](https://sendfiles.dev) allows for encrypted, browser-to-browser file transfer using [WebRTC](https://webrtc.org).


## Architecture

[sendfiles.dev](https://sendfiles.dev) has two components - a transfer metadata store and [WebRTC](https://webrtc.org) signalling/coordination. Each component has an [API Gateway](https://aws.amazon.com/api-gateway/), a [Lambda](https://aws.amazon.com/lambda/) function and a [DynamoDB](https://aws.amazon.com/dynamodb/) database.

Transfers:
  - `Transfers DynamoDB` - stores metadata (filename, size, keys) for transfers, but **not** the file contents
  - `Transfers Lambda` - simple API wrapper around `Transfers DynamoDB`
  - `Transfers API Gateway` - HTTP gateway sitting in front of `Transfers Lambda`

Coordination:
  - `Sessions DynamoDB` - stores API Gateway websocket IDs of file owners so receivers can request files and coordinate WebRTC
  - `Coord Lambda` - allows sender/receiver to communicate in order to set up [WebRTC](https://webrtc.org) connections
  - `Coord API Gateway` - Websocket gateway sitting in front of `Coord Lambda`, keeping websockets open

![architecture diagram](https://sendfiles.dev/architecture.png)


## Project Structure
```
backend/ - code for both Lambdas, written in Rust
frontend/ - webapp, written in React
scripts/ - misc helper scripts for build/deploy
terraform/ - config for all the infrastructure
```


## Deployment

The Lambdas, API Gateways, DynamoDBs, IAM permissions and frontend S3 bucket/CloudFront distribution are deployed with Terraform:

### Terraform

```shell
docker run -it --rm \
    -v "$(pwd)/terraform":/work/terraform \
    -w /work/terraform \
    -v "$HOME/.aws:/root/.aws" \
    -e AWS_PROFILE=sendfiles \
    -e AWS_DEFAULT_REGION=us-west-2 \
    --entrypoint sh \
    hashicorp/terraform:1.6
```

### Backend

```shell
docker run -it --rm \
    -e CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=/usr/bin/aarch64-linux-gnu-gcc \
    -e RUSTFLAGS="-C target-feature=+crt-static" \
    -v "$(pwd)/backend":/src \
    -w /src \
    rust:1.75 \
    bash

apt-get -qq update && apt-get -qq install -y gcc-aarch64-linux-gnu
rustup target add aarch64-unknown-linux-gnu
cargo build --target=aarch64-unknown-linux-gnu --release
```

```shell
./scripts/deploy-backend.sh
```

### Frontend

Frontend assets are deployed to an S3 bucket fronted by CloudFront:
```shell
./scripts/deploy-statics.sh
```


## Development

Running a Rust Lambda function locally is brutally difficult, so test in prod.

### Running Frontend
```shell
docker run -it --rm \
    -u "$(id -u):$(id -g)" \
    -v "$(pwd)/frontend":/usr/src/app:ro \
    -w /usr/src/app \
    -p 3000:3000 \
    node:21 \
    npm run start
```

### Prettier
```shell
docker run -it --rm \
    -u "$(id -u):$(id -g)" \
    -v "$(pwd)/frontend":/usr/src/app \
    -w /usr/src/app \
    node:21 \
    npx prettier --write src
```


## Website Design

Colors: https://coolors.co/e7e247-3d3b30-4d5061-5c80bc-e9edde

Favicon: https://favicon.io/favicon-generator/
  - Font: `Inconsolata`
  - Font Size: 90px
  - Font Colour: #E9EDDE
  - Background Colour: #4D5061

```shell
$ mv ~/Downloads/favicon_io.zip .
$ unzip favicon_io.zip
$ mv favicon.ico frontend/public/favicon.ico
$ mv android-chrome-192x192.png frontend/public/logo192.png
$ mv android-chrome-512x512.png frontend/public/logo512.png
```
