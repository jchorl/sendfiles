# SecureSend

## Dev
```shell
docker run -it --rm \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$(pwd)":"$(pwd)":ro \
    -w "$(pwd)" \
    docker/compose:1.27.4 \
    up
```
