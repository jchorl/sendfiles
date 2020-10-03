FROM node:14.12

WORKDIR /securesend
ADD . .
RUN yarn
RUN yarn build

FROM caddy:2.1.1

COPY --from=0 /securesend/build /usr/share/caddy
