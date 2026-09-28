package main

import (
	"log"
	"os"
)

func init() {
	domain := os.Getenv("RAILWAY_TCP_PROXY_DOMAIN")
	port := os.Getenv("RAILWAY_TCP_PROXY_PORT")
	if domain != "" && port != "" {
		log.Printf("SHIS public TCP endpoint: %s:%s", domain, port)
	}
}
