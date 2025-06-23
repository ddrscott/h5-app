# Docker Deployment Guide

This guide explains how to deploy Heart of Five as a single Docker container with both the Colyseus game server and the static client.

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

The game will be available at `http://localhost:2567`

### Using Docker Directly

```bash
# Build the image
docker build -t heartfive .

# Run the container
docker run -d \
  -p 2567:2567 \
  -e NODE_ENV=production \
  -e WEB_URL=https://yourdomain.com \
  --name heartfive \
  heartfive

# View logs
docker logs -f heartfive

# Stop and remove
docker stop heartfive
docker rm heartfive
```

## Environment Variables

The following environment variables can be set:

- `PORT` - Server port (default: 2567)
- `NODE_ENV` - Environment mode (default: production)
- `WEB_URL` - The public URL where your game is hosted (default: http://localhost:2567)
  - **Important**: Set this to your actual domain in production (e.g., `https://yourgame.com`)
  - Used for generating invite links and redirect URLs

## Production Deployment

### Using a Cloud Provider

1. Build and push to a container registry:
```bash
# Example with Docker Hub
docker build -t yourusername/heartfive .
docker push yourusername/heartfive
```

2. Deploy to your cloud provider:
- **AWS ECS**: Use the pushed image in your task definition
- **Google Cloud Run**: Deploy directly from the container registry
- **Azure Container Instances**: Create a container instance with the image
- **DigitalOcean App Platform**: Use the Docker container option

### Reverse Proxy Configuration

If running behind a reverse proxy (nginx, Apache, etc.), ensure WebSocket support is enabled:

```nginx
# Example nginx configuration
location / {
    proxy_pass http://localhost:2567;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Health Check

The server exposes the following endpoints:
- `/` - Client application
- `/hello_world` - Simple health check endpoint
- `/monitor` - Colyseus monitor (protect in production!)

## Troubleshooting

1. **WebSocket connection fails**: Ensure your firewall/security groups allow WebSocket connections on port 2567
2. **Client can't connect**: Check that the client is using the correct server URL (it auto-detects in production)
3. **High memory usage**: Consider setting Node.js memory limits: `docker run -e NODE_OPTIONS="--max-old-space-size=1024" ...`

## Building for Different Architectures

```bash
# Build for ARM64 (e.g., Apple Silicon, AWS Graviton)
docker buildx build --platform linux/arm64 -t heartfive:arm64 .

# Build for multiple platforms
docker buildx build --platform linux/amd64,linux/arm64 -t heartfive:multi .
```