package main

import "testing"

func TestTrimVideoPacerQueuePreservesRecentIDR(t *testing.T) {
 queue := []videoFrame{
  {timestampUS: 1, idr: true},
  {timestampUS: 2},
  {timestampUS: 3},
  {timestampUS: 4},
  {timestampUS: 5, idr: true},
  {timestampUS: 6},
  {timestampUS: 7},
  {timestampUS: 8},
  {timestampUS: 9},
 }

 got, trimmed := trimVideoPacerQueue(queue, 5)
 if !trimmed {
  t.Fatal("expected overlong queue to be trimmed")
 }
 if len(got) != 5 {
  t.Fatalf("expected 5 frames, got %d", len(got))
 }
 if !got[0].idr || got[0].timestampUS != 5 {
  t.Fatalf("expected retained queue to start at newest IDR, got timestamp=%d idr=%v", got[0].timestampUS, got[0].idr)
 }
}

func TestTrimVideoPacerQueueWaitsForIDRWhenNoneInLiveWindow(t *testing.T) {
 queue := []videoFrame{
  {timestampUS: 1, idr: true},
  {timestampUS: 2},
  {timestampUS: 3},
  {timestampUS: 4},
  {timestampUS: 5},
  {timestampUS: 6},
 }

 got, trimmed := trimVideoPacerQueue(queue, 3)
 if !trimmed {
  t.Fatal("expected overlong queue to be trimmed")
 }
 if len(got) != 0 {
  t.Fatalf("expected no frame to be kept until next IDR, got %d", len(got))
 }
}

func TestTrimVideoPacerQueueLeavesHealthyQueueAlone(t *testing.T) {
 queue := []videoFrame{
  {timestampUS: 1, idr: true},
  {timestampUS: 2},
  {timestampUS: 3},
 }
 got, trimmed := trimVideoPacerQueue(queue, 3)
 if trimmed {
  t.Fatal("did not expect a queue at capacity to be trimmed")
 }
 if len(got) != len(queue) {
  t.Fatalf("expected %d frames, got %d", len(queue), len(got))
 }
}
