# SecureSend

## Dev
### Running Everything
```shell
docker run -it --rm \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$(pwd)":"$(pwd)":ro \
    -w "$(pwd)" \
    docker/compose:1.27.4 \
    up
```

### Running Frontend
```shell
docker run -it --rm \
    -v "$(pwd)/frontend":/securesend:ro \
    -w /securesend \
    -p 3000:3000 \
    node:14.12 \
    yarn start
```

### Prettier
```shell
docker run -it --rm \
    -v "$(pwd)/frontend":/securesend \
    -w /securesend \
    -u 1000:1000 \
    node:14.12 \
    npx prettier --write src
```
