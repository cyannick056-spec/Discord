package main

import (
	"bufio"
	"crypto/subtle"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"strings"
	"sync/atomic"
	"time"

	msdk "github.com/livekit/media-sdk"
	"github.com/livekit/protocol/logger"
	livekit "github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"
	lkmedia "github.com/livekit/server-sdk-go/v2/pkg/media"
	"github.com/pion/webrtc/v4"
	pionmedia "github.com/pion/webrtc/v4/pkg/media"
)

const (
	wireMagic       = "SHFR"
	kindVideo  byte = 1
	kindAudio  byte = 2
	maxPayload      = 0x60000
)

type frameHeader struct {
	Kind        byte
	Flags       byte
	TimestampUS uint64
	PayloadLen  uint32
}

var connectionID atomic.Uint64

func env(name string) string {
	v := strings.TrimSpace(os.Getenv(name))
	if v == "" {
		log.Fatalf("%s is required", name)
	}
	return v
}

func normalizeStream(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		value = strings.TrimSpace(os.Getenv("DEFAULT_STREAM"))
	}
	if value == "" {
		value = "cris"
	}
	var b strings.Builder
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			b.WriteRune(r)
		} else {
			b.WriteByte('-')
		}
		if b.Len() >= 48 {
			break
		}
	}
	if b.Len() == 0 {
		return "cris"
	}
	return b.String()
}

func secureEqual(a, b string) bool {
	if len(a) == 0 || len(a) != len(b) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

func main() {
	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = strings.TrimSpace(os.Getenv("RELAY_PORT"))
	}
	if port == "" {
		port = "9000"
	}

	ln, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatal(err)
	}
	defer ln.Close()
	log.Printf("SHIS native relay listening on :%s", port)

	for {
		conn, err := ln.Accept()
		if err != nil {
			log.Printf("accept: %v", err)
			continue
		}
		go handleConnection(conn)
	}
}

func handleConnection(conn net.Conn) {
	id := connectionID.Add(1)
	peer := conn.RemoteAddr().String()
	defer conn.Close()
	log.Printf("[%d] sender connected from %s", id, peer)

	_ = conn.SetDeadline(time.Now().Add(15 * time.Second))
	reader := bufio.NewReaderSize(conn, 512*1024)
	line, err := reader.ReadString('\n')
	if err != nil {
		log.Printf("[%d] auth read: %v", id, err)
		return
	}
	parts := strings.Fields(strings.TrimSpace(line))
	if len(parts) != 3 || parts[0] != "SHIS/1" {
		_, _ = io.WriteString(conn, "ERR protocol\n")
		return
	}
	stream := normalizeStream(parts[1])
	if !secureEqual(parts[2], env("STREAM_KEY")) {
		_, _ = io.WriteString(conn, "ERR auth\n")
		log.Printf("[%d] rejected bad stream key", id)
		return
	}

	roomName := "shis-" + stream
	identity := fmt.Sprintf("native-switch-%d-%d", time.Now().Unix(), id)
	room, err := lksdk.ConnectToRoom(
		env("LIVEKIT_URL"),
		lksdk.ConnectInfo{
			APIKey:              env("LIVEKIT_API_KEY"),
			APISecret:           env("LIVEKIT_API_SECRET"),
			RoomName:            roomName,
			ParticipantIdentity: identity,
			ParticipantName:     "Switch de Cris",
		},
		lksdk.NewRoomCallback(),
		lksdk.WithAutoSubscribe(false),
	)
	if err != nil {
		_, _ = io.WriteString(conn, "ERR livekit\n")
		log.Printf("[%d] livekit connect: %v", id, err)
		return
	}
	defer room.Disconnect()

	videoTrack, err := lksdk.NewLocalSampleTrack(webrtc.RTPCodecCapability{
		MimeType:    webrtc.MimeTypeH264,
		ClockRate:   90000,
		SDPFmtpLine: "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=64001f",
	})
	if err != nil {
		log.Printf("[%d] video track: %v", id, err)
		return
	}
	defer videoTrack.Close()

	if _, err = room.LocalParticipant.PublishTrack(videoTrack, &lksdk.TrackPublicationOptions{
		Name:        "screen",
		Source:      livekit.TrackSource_SCREEN_SHARE,
		VideoWidth:  1280,
		VideoHeight: 720,
	}); err != nil {
		log.Printf("[%d] publish video: %v", id, err)
		return
	}

	// SysDVR produces 48 kHz stereo PCM16. The Go SDK currently behaves best
	// with mono PCM input, so the relay downmixes stereo to mono before Opus encoding.
	audioTrack, err := lkmedia.NewPCMLocalTrack(48000, 1, logger.GetLogger())
	if err != nil {
		log.Printf("[%d] audio track: %v", id, err)
		return
	}
	defer func() {
		audioTrack.ClearQueue()
		_ = audioTrack.Close()
	}()
	if _, err = room.LocalParticipant.PublishTrack(audioTrack, &lksdk.TrackPublicationOptions{
		Name:   "game-audio",
		Source: livekit.TrackSource_MICROPHONE,
	}); err != nil {
		log.Printf("[%d] publish audio: %v", id, err)
		return
	}

	if _, err = io.WriteString(conn, "OK\n"); err != nil {
		return
	}
	_ = conn.SetDeadline(time.Time{})
	log.Printf("[%d] publishing to %s", id, roomName)

	var firstVideoTS uint64
	var previousVideoTS uint64
	var videoPackets uint64
	for {
		h, err := readFrameHeader(reader)
		if err != nil {
			if !errors.Is(err, io.EOF) {
				log.Printf("[%d] frame header: %v", id, err)
			}
			return
		}
		payload := make([]byte, h.PayloadLen)
		if _, err = io.ReadFull(reader, payload); err != nil {
			log.Printf("[%d] frame payload: %v", id, err)
			return
		}

		switch h.Kind {
		case kindVideo:
			if firstVideoTS == 0 {
				firstVideoTS = h.TimestampUS
			}

			duration := 33333 * time.Microsecond
			var deltaUS uint64
			if previousVideoTS != 0 && h.TimestampUS > previousVideoTS {
				deltaUS = h.TimestampUS - previousVideoTS
				d := time.Duration(deltaUS) * time.Microsecond
				if d >= 5*time.Millisecond && d <= 250*time.Millisecond {
					duration = d
				}
			}
			previousVideoTS = h.TimestampUS

			// Preserve SysDVR's capture clock in the outgoing 90 kHz RTP timeline.
			// This avoids accumulating timing drift from estimating every H.264 NAL
			// as an independent fixed-duration sample.
			rtpTimestamp := uint32(90000)
			if h.TimestampUS >= firstVideoTS {
				rtpTimestamp += uint32(((h.TimestampUS - firstVideoTS) * 90) / 1000)
			}

			videoPackets++
			if videoPackets <= 8 || videoPackets%300 == 0 {
				log.Printf("[%d] video #%d ts_us=%d delta_us=%d rtp_ts=%d bytes=%d idr=%t nal=%d", id, videoPackets, h.TimestampUS, deltaUS, rtpTimestamp, len(payload), h.Flags&1 != 0, firstH264NALType(payload))
			}

			if err := videoTrack.WriteSample(pionmedia.Sample{
				Data:            payload,
				Duration:        duration,
				PacketTimestamp: rtpTimestamp,
			}, nil); err != nil {
				log.Printf("[%d] video write: %v", id, err)
				return
			}
		case kindAudio:
			mono, err := stereoPCM16ToMono(payload)
			if err != nil {
				log.Printf("[%d] bad PCM packet: %v", id, err)
				continue
			}
			if err := audioTrack.WriteSample(msdk.PCM16Sample(mono)); err != nil {
				log.Printf("[%d] audio write: %v", id, err)
				return
			}
		default:
			log.Printf("[%d] unknown frame kind %d", id, h.Kind)
		}
	}
}

func firstH264NALType(data []byte) int {
	for i := 0; i+3 < len(data); i++ {
		if data[i] != 0 || data[i+1] != 0 {
			continue
		}
		if data[i+2] == 1 && i+3 < len(data) {
			return int(data[i+3] & 0x1f)
		}
		if data[i+2] == 0 && i+4 < len(data) && data[i+3] == 1 {
			return int(data[i+4] & 0x1f)
		}
	}
	if len(data) != 0 {
		return int(data[0] & 0x1f)
	}
	return -1
}

func readFrameHeader(r io.Reader) (frameHeader, error) {
	var raw [20]byte
	if _, err := io.ReadFull(r, raw[:]); err != nil {
		return frameHeader{}, err
	}
	if string(raw[0:4]) != wireMagic {
		return frameHeader{}, fmt.Errorf("bad frame magic %q", string(raw[0:4]))
	}
	h := frameHeader{
		Kind:        raw[4],
		Flags:       raw[5],
		TimestampUS: binary.LittleEndian.Uint64(raw[8:16]),
		PayloadLen:  binary.LittleEndian.Uint32(raw[16:20]),
	}
	if h.PayloadLen == 0 || h.PayloadLen > maxPayload {
		return frameHeader{}, fmt.Errorf("invalid payload size %d", h.PayloadLen)
	}
	return h, nil
}

func stereoPCM16ToMono(data []byte) ([]int16, error) {
	if len(data)%4 != 0 {
		return nil, fmt.Errorf("stereo PCM16 payload length %d is not divisible by 4", len(data))
	}
	out := make([]int16, len(data)/4)
	for i := range out {
		off := i * 4
		left := int16(binary.LittleEndian.Uint16(data[off : off+2]))
		right := int16(binary.LittleEndian.Uint16(data[off+2 : off+4]))
		out[i] = int16((int32(left) + int32(right)) / 2)
	}
	return out, nil
}
