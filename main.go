package main

import (
	"fmt"
	_ "image/jpeg" // Register JPEG format
	_ "image/png"  // Register PNG format
	"log"
	"os"

	"github.com/willhick/ditherman/server"
)

func init() {
	// Log which formats are supported
	log.Println("Starting server with image format support:")
	formats := []string{"PNG", "JPEG"}
	for _, format := range formats {
		log.Printf("- %s format supported", format)
	}
}

func main() {
	// Create static directory if it doesn't exist
	if _, err := os.Stat("./static"); os.IsNotExist(err) {
		log.Println("Creating static directory...")
		if err := os.Mkdir("./static", 0755); err != nil {
			log.Fatalf("Failed to create static directory: %v", err)
		}
	}

	// Start the server
	port := "3000"
	app := server.NewApp()
	log.Printf("Server starting on http://localhost:%s", port)
	log.Fatal(app.Listen(fmt.Sprintf(":%s", port)))
}
