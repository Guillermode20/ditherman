package server

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"

	"github.com/willhick/ditherman/server/handlers"
)

func NewApp() *fiber.App {
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			log.Printf("Error: %v\n", err)
			return c.Status(500).JSON(fiber.Map{
				"error": err.Error(),
			})
		},
	})

	// Enable CORS with specific configuration
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,HEAD,PUT,DELETE,PATCH",
		AllowHeaders: "Origin, Content-Type, Accept",
	}))

	// Serve static files
	app.Static("/", "./static")

	// Register routes
	registerRoutes(app)

	return app
}

func registerRoutes(app *fiber.App) {
	app.Post("/dither", handlers.HandleDither)
}
