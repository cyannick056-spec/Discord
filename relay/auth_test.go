package main

import (
 "os"
 "testing"
)

func TestRelayPublisherUsesDedicatedKey(t *testing.T) {
 oldActivity := os.Getenv("SHIS_ACTIVITY_URL")
 oldRelay := os.Getenv("RELAY_PUBLISH_KEY")
 oldStream := os.Getenv("STREAM_KEY")
 t.Cleanup(func() {
  _ = os.Setenv("SHIS_ACTIVITY_URL", oldActivity)
  _ = os.Setenv("RELAY_PUBLISH_KEY", oldRelay)
  _ = os.Setenv("STREAM_KEY", oldStream)
 })
 _ = os.Setenv("SHIS_ACTIVITY_URL", "https://example.test")
 _ = os.Setenv("STREAM_KEY", "switch-key")
 _ = os.Setenv("RELAY_PUBLISH_KEY", "internal-relay-key")
 p, err := newCFPublisher()
 if err != nil { t.Fatal(err) }
 if p.key != "internal-relay-key" { t.Fatalf("got %q", p.key) }
}
