package main

import (
	"bufio"
	"crypto/subtle"
	"encoding/binary"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"strings"
	"sync/atomic"
	"time"
)

const (
	wireMagic       = "SHFR"
	kindVideo  byte = 1
	kindAudio  byte = 2
	maxPayload      = 0x60000

	videoFPS             = 30
	videoJitterFrames    = 6
	videoQueueDepth      = 180
	audioQueueDepth      = 384
	videoDiscontinuityUS = 500000
	senderIdleTimeout     = 10 * time.Second
)

const videoFrameDuration = time.Second / videoFPS
const videoBufferDelay = videoFrameDuration * videoJitterFrames

var webRTCSPS = []byte{
	0x00, 0x00, 0x00, 0x01,
	0x67, 0x64, 0x0c, 0x1f,
	0xac, 0x2b, 0x40, 0x28, 0x02, 0xdd, 0x35, 0x01,
	0x0d, 0x01, 0xe0, 0x80,
}

var webRTCPPS = []byte{
	0x00, 0x00, 0x00, 0x01,
	0x68, 0xee, 0x3c, 0xb0,
}

type frameHeader struct {
	Kind        byte
	Flags       byte
	TimestampUS uint64
	PayloadLen  uint32
}

type videoFrame struct {
	data        []byte
	timestampUS uint64
	idr         bool
}

type audioFrame struct {
	pcm         []int16
	timestampUS uint64
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
	log.Printf("SHIS Cloudflare relay listening on :%s", port)

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

	log.Printf("[%d] authenticated stream %s; using Cloudflare SFU", id, stream)
	publishCloudflare(id, conn, reader)
}

func reportWorkerErr(ch chan<- error, err error) {
	select {
	case ch <- err:
	default:
	}
}

func drainVideoQueue(ch <-chan videoFrame) {
	for {
		select {
		case <-ch:
		default:
			return
		}
	}
}

func normalizeH264AccessUnit(data []byte, isIDR bool) ([]byte, bool) {
	out := append([]byte(nil), data...)
	hasSPS := false
	hasPPS := false
	hasVCL := false

	for i := 0; i+3 < len(out); i++ {
		if out[i] != 0 || out[i+1] != 0 {
			continue
		}

		nalPos := -1
		if out[i+2] == 1 {
			nalPos = i + 3
		} else if i+4 < len(out) && out[i+2] == 0 && out[i+3] == 1 {
			nalPos = i + 4
		}
		if nalPos < 0 || nalPos >= len(out) {
			continue
		}

		nalType := out[nalPos] & 0x1f
		switch nalType {
		case 1, 5:
			hasVCL = true
		case 7:
			hasSPS = true
			if nalPos+3 < len(out) && out[nalPos] == 0x67 && out[nalPos+1] == 0x64 && out[nalPos+2] == 0x0c && out[nalPos+3] == 0x20 {
				out[nalPos+3] = 0x1f
			}
		case 8:
			hasPPS = true
		}
		i = nalPos
	}

	if !hasVCL {
		return nil, false
	}

	if isIDR && !(hasSPS && hasPPS) {
		withParams := make([]byte, 0, len(webRTCSPS)+len(webRTCPPS)+len(out))
		withParams = append(withParams, webRTCSPS...)
		withParams = append(withParams, webRTCPPS...)
		withParams = append(withParams, out...)
		out = withParams
	}

	return out, true
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
