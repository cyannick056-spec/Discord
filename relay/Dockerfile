FROM golang:1.26-bookworm AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends pkg-config libopus-dev libopusfile-dev libsoxr-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY . .

# SysDVR's encoder emits H.264 High Profile. The relay previously created a
# generic H.264 track, which could bind to a baseline WebRTC payload type even
# while forwarding High Profile bitstream. Pin the track to Pion's registered
# High Profile payload type so SDP and the actual stream agree.
RUN sed -i '/ClockRate: 90000,/a\		SDPFmtpLine: "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=64001f",' main.go

RUN go mod tidy && go build -trimpath -ldflags="-s -w" -o /out/shis-relay .

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libopus0 libopusfile0 libsoxr0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /out/shis-relay /usr/local/bin/shis-relay
EXPOSE 9000
CMD ["shis-relay"]
