// Package main is the entry point of arc-agent.
//
// This is a placeholder bootstrapped in INFRA-001. The HTTP server, auth
// middleware and Docker integration land in AGENT-001 onwards.
package main

import "fmt"

const Version = "0.0.0"

func main() {
	fmt.Printf("arc-agent %s\n", Version)
}
