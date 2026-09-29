FROM golang:1.26-bookworm AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-config libopus-dev libopusfile-dev libsoxr-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY . .
RUN go mod tidy && go build -trimpath -ldflags="-s -w" -o /out/shis-relay .

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libopus0 libopusfile0 libsoxr0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /out/shis-relay /usr/local/bin/shis-relay
EXPOSE 9000
CMD ["shis-relay"]
