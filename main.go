package main

import (
	"image"
	"image/jpeg"
	"log"

	"github.com/willhick/ditherman/server"
)

// Register image formats
func init() {
	image.RegisterFormat("jpeg", "jpeg", jpeg.Decode, jpeg.DecodeConfig)
	image.RegisterFormat("jpg", "", jpeg.Decode, jpeg.DecodeConfig)
}

func main() {
	app := server.NewApp()
	log.Fatal(app.Listen(":3000"))
}
