package main

import (
 "bufio"
 "bytes"
 "encoding/json"
 "errors"
 "fmt"
 "io"
 "log"
 "net"
 "net/http"
 "os"
 "strings"
 "sync/atomic"
 "time"

 "github.com/pion/webrtc/v4"
 pionmedia "github.com/pion/webrtc/v4/pkg/media"
 "gopkg.in/hraban/opus.v2"
)

type cfSession struct {
 SessionID string `json:"sessionId"`
 Description webrtc.SessionDescription `json:"description"`
}

type cfPublisher struct {
 client *http.Client
 base string
 key string
 session string
}

func (p *cfPublisher) call(path string, data any, output any) error {
 body, err := json.Marshal(data)
 if err != nil { return err }
 req, err := http.NewRequest(http.MethodPost, p.base + path, bytes.NewReader(body))
 if err != nil { return err }
 req.Header.Set("Content-Type", "application/json")
 req.Header.Set("X-Stream-Key", p.key)
 res, err := p.client.Do(req)
 if err != nil { return err }
 defer res.Body.Close()
 raw, err := io.ReadAll(io.LimitReader(res.Body, 65536))
 if err != nil { return err }
 if res.StatusCode < 200 || res.StatusCode >= 300 {
  return fmt.Errorf("signaling %s: HTTP %d: %s", path, res.StatusCode, strings.TrimSpace(string(raw)))
 }
 if output != nil { return json.Unmarshal(raw, output) }
 return nil
}

func newCFPublisher() (*cfPublisher, error) {
 base := strings.TrimRight(strings.TrimSpace(os.Getenv("SHIS_ACTIVITY_URL")), "/")
 if !strings.HasPrefix(base, "https://") && !strings.HasPrefix(base, "http://localhost:") {
  return nil, errors.New("SHIS_ACTIVITY_URL must be an HTTPS URL")
 }
 return &cfPublisher{client: &http.Client{Timeout: 12 * time.Second},
  base: base, key: env("STREAM_KEY")}, nil
}

func (p *cfPublisher) notify(path string) {
 if p.session != "" {
  if err := p.call(path, map[string]string{"sessionId":p.session}, nil); err != nil {
   log.Printf("Cloudflare %s: %v", path, err)
  }
 }
}

func publishCloudflare(id uint64, conn net.Conn, reader *bufio.Reader) {
 publisher, err := newCFPublisher()
 if err != nil { log.Printf("[%d] Cloudflare setup: %v", id, err); return }
 _ = conn.SetDeadline(time.Time{})
 video, err := webrtc.NewTrackLocalStaticSample(webrtc.RTPCodecCapability{
  MimeType: webrtc.MimeTypeH264, ClockRate: 90000,
  SDPFmtpLine: "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=640c1f",
 }, "screen", "switch")
 if err != nil { log.Printf("[%d] video: %v", id, err); return }
 audio, err := webrtc.NewTrackLocalStaticSample(webrtc.RTPCodecCapability{
  MimeType: webrtc.MimeTypeOpus, ClockRate: 48000, Channels: 2,
 }, "game-audio", "switch")
 if err != nil { log.Printf("[%d] audio: %v", id, err); return }

 pc, err := webrtc.NewPeerConnection(webrtc.Configuration{
  ICEServers: []webrtc.ICEServer{{URLs: []string{"stun:stun.cloudflare.com:3478"}}},
 })
 if err != nil { log.Printf("[%d] peer connection: %v", id, err); return }
 defer pc.Close()
 for _, track := range []webrtc.TrackLocal{video, audio} {
  sender, addErr := pc.AddTrack(track)
  if addErr != nil { log.Printf("[%d] add track: %v", id, addErr); return }
  go func() {
   buf := make([]byte, 1500)
   for { if _, _, readErr := sender.Read(buf); readErr != nil { return } }
  }()
 }
 connected := make(chan struct{}, 1)
 pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
  log.Printf("[%d] Cloudflare peer: %s", id, state.String())
  if state == webrtc.PeerConnectionStateConnected {
   select { case connected <- struct{}{}: default: }
  }
 })
 offer, err := pc.CreateOffer(nil)
 if err != nil { log.Printf("[%d] offer: %v", id, err); return }
 gathered := webrtc.GatheringCompletePromise(pc)
 if err = pc.SetLocalDescription(offer); err != nil { log.Printf("[%d] local SDP: %v", id, err); return }
 select {
 case <-gathered:
 case <-time.After(12 * time.Second): log.Printf("[%d] ICE gathering timed out", id); return
 }

 var videoMid, audioMid string
 for _, transceiver := range pc.GetTransceivers() {
  if transceiver.Kind() == webrtc.RTPCodecTypeVideo { videoMid = transceiver.Mid() }
  if transceiver.Kind() == webrtc.RTPCodecTypeAudio { audioMid = transceiver.Mid() }
 }
 if videoMid == "" || audioMid == "" { log.Printf("[%d] missing media mids", id); return }

 var created cfSession
 if err = publisher.call("/api/cloudflare/publisher/session", map[string]any{}, &created); err != nil {
  log.Printf("[%d] create Cloudflare session: %v", id, err); return
 }
 publisher.session = created.SessionID
 defer publisher.notify("/api/cloudflare/publisher/end")
 var published cfSession
 if err = publisher.call("/api/cloudflare/publisher/publish", map[string]any{
  "sessionId": publisher.session, "videoMid": videoMid, "audioMid": audioMid,
  "description": pc.LocalDescription(),
 }, &published); err != nil { log.Printf("[%d] publish Cloudflare: %v", id, err); return }
 if err = pc.SetRemoteDescription(published.Description); err != nil {
  log.Printf("[%d] Cloudflare answer: %v", id, err); return
 }
 select {
 case <-connected:
 case <-time.After(15 * time.Second):
  log.Printf("[%d] Cloudflare connection timed out", id); return
 }
 if _, err = io.WriteString(conn, "OK\n"); err != nil { return }
 _ = conn.SetDeadline(time.Time{})
 log.Printf("[%d] publishing H264/Opus to Cloudflare SFU", id)

 done := make(chan struct{})
 defer close(done)
 go func() {
  ticker := time.NewTicker(3 * time.Second)
  defer ticker.Stop()
  for { select {
   case <-done: return
   case <-ticker.C: publisher.notify("/api/cloudflare/publisher/heartbeat")
  } }
 }()

 videoCh := make(chan videoFrame, videoQueueDepth)
 audioCh := make(chan audioFrame, audioQueueDepth)
 workerErr := make(chan error, 2)
 var waitForIDR atomic.Bool
 waitForIDR.Store(true)
 go runCFVideoPacer(id, video, videoCh, done, &waitForIDR, workerErr)
 go runCFAudioPacer(id, audio, audioCh, done, workerErr)

 var previousVideoTS uint64
 for {
  select { case werr := <-workerErr:
   log.Printf("[%d] Cloudflare media worker: %v", id, werr); return
  default: }
  if err := conn.SetReadDeadline(time.Now().Add(senderIdleTimeout)); err != nil { return }
  h, err := readFrameHeader(reader)
  if err != nil {
   var netErr net.Error
   if errors.As(err, &netErr) && netErr.Timeout() { log.Printf("[%d] sender idle; ending stream", id) }
   return
  }
  payload := make([]byte, h.PayloadLen)
  if _, err = io.ReadFull(reader, payload); err != nil { log.Printf("[%d] frame payload: %v", id, err); return }
  switch h.Kind {
  case kindVideo:
   var deltaUS uint64
   if previousVideoTS != 0 && h.TimestampUS > previousVideoTS { deltaUS = h.TimestampUS - previousVideoTS }
   previousVideoTS = h.TimestampUS
   isIDR := h.Flags&1 != 0
   if deltaUS > videoDiscontinuityUS { log.Printf("[%d] large video gap: %d us", id, deltaUS) }
   accessUnit, hasVCL := normalizeH264AccessUnit(payload, isIDR)
   if !hasVCL || (waitForIDR.Load() && !isIDR) { continue }
   frame := videoFrame{data: accessUnit, timestampUS: h.TimestampUS, idr: isIDR}
   select {
   case videoCh <- frame:
   default:
    waitForIDR.Store(true)
    drainVideoQueue(videoCh)
    if isIDR { select { case videoCh <- frame: default: } }
    log.Printf("[%d] Cloudflare video jitter queue overflow", id)
   }
  case kindAudio:
   mono, monoErr := stereoPCM16ToMono(payload)
   if monoErr != nil { log.Printf("[%d] audio: %v", id, monoErr); continue }
   select {
   case audioCh <- audioFrame{pcm: mono, timestampUS: h.TimestampUS}:
   default: log.Printf("[%d] Cloudflare audio queue overflow", id)
   }
  }
 }
}

func runCFVideoPacer(id uint64, track *webrtc.TrackLocalStaticSample, in <-chan videoFrame,
 done <-chan struct{}, waitForIDR *atomic.Bool, errs chan<- error) {
 ticker := time.NewTicker(videoFrameDuration)
 defer ticker.Stop()
 queue := make([]videoFrame, 0, 24)
 started := false
 for {
  select {
  case <-done: return
  case frame := <-in: queue = append(queue, frame)
  case <-ticker.C:
   if !started {
    if len(queue) < videoJitterFrames { continue }
    started = true
   }
   if waitForIDR.Load() {
    idx := -1
    for i := range queue { if queue[i].idr { idx = i; break } }
    if idx < 0 { queue = queue[:0]; continue }
    queue = queue[idx:]
   }
   if len(queue) == 0 { continue }
   frame := queue[0]
   queue = queue[1:]
   if waitForIDR.Load() && !frame.idr { continue }
   if frame.idr { waitForIDR.Store(false) }
   if err := track.WriteSample(pionmedia.Sample{Data:frame.data, Duration:videoFrameDuration}); err != nil {
    reportWorkerErr(errs, fmt.Errorf("Cloudflare video: %w", err)); return
   }
  }
 }
}

func runCFAudioPacer(id uint64, track *webrtc.TrackLocalStaticSample, in <-chan audioFrame,
 done <-chan struct{}, errs chan<- error) {
 encoder, err := opus.NewEncoder(48000, 1, opus.AppAudio)
 if err != nil { reportWorkerErr(errs, err); return }
 if err = encoder.SetBitrate(64000); err != nil { reportWorkerErr(errs, err); return }
 var samples []int16
 var baseWall time.Time
 var sent time.Duration
 for {
  select {
  case <-done: return
  case frame := <-in:
   if baseWall.IsZero() { baseWall = time.Now().Add(videoBufferDelay) }
   samples = append(samples, frame.pcm...)
   for len(samples) >= 960 {
    out := make([]byte, 4000)
    n, encodeErr := encoder.Encode(samples[:960], out)
    if encodeErr != nil { reportWorkerErr(errs, fmt.Errorf("Cloudflare audio encode: %w", encodeErr)); return }
    samples = samples[960:]
    target := baseWall.Add(sent)
    sent += 20 * time.Millisecond
    if delay := time.Until(target); delay > 0 {
     timer := time.NewTimer(delay)
     select {
     case <-done: if !timer.Stop() { <-timer.C }; return
     case <-timer.C:
     }
    }
    if err := track.WriteSample(pionmedia.Sample{Data:out[:n], Duration:20*time.Millisecond}); err != nil {
     reportWorkerErr(errs, fmt.Errorf("Cloudflare audio: %w", err)); return
    }
   }
  }
 }
}

