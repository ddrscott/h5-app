# Unified Deployment: Colyseus + Static Client

This setup allows Colyseus to serve both the game server (WebSocket) and the client (HTTP) from the same port.

## How it Works

1. **HTTP Requests** → Serve the React client from `/client/dist`
2. **WebSocket Connections** → Handle game connections
3. **Same Origin** → No CORS issues, simplified deployment

## Building for Production

```bash
# From the root directory
npm run build
```

This will:
1. Build the React client to `client/dist`
2. Build the TypeScript server to `build/`

## Running in Production

```bash
npm start
```

The server will:
- Serve the client at `http://localhost:2567`
- Accept WebSocket connections at `ws://localhost:2567`
- Automatically use SSL/WSS when deployed with HTTPS

## Benefits

1. **Single Deployment**: One server, one port, one process
2. **No CORS**: Client and server are same-origin
3. **Automatic WSS**: When served over HTTPS, WebSocket automatically uses WSS
4. **Simplified Infrastructure**: No need for separate static hosting

## Environment Variables

```bash
# Port (default: 2567)
PORT=3000

# Node environment
NODE_ENV=production
```

## Deployment Examples

### Railway/Render/Heroku
```bash
# These platforms automatically:
# 1. Run npm install
# 2. Run npm run build
# 3. Run npm start
# 4. Provide SSL/HTTPS
```

### Docker
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
EXPOSE 2567
CMD ["npm", "start"]
```

### PM2
```bash
pm2 start npm --name "heartfive" -- start
```

## Client Behavior

The client automatically determines the WebSocket URL:
- **Development**: `ws://localhost:2567`
- **Production**: Uses the same host as the page
- **HTTPS**: Automatically uses `wss://`

## Nginx Proxy (Optional)

If you want to run behind Nginx:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Upgrade WebSocket connections
    location / {
        proxy_pass http://localhost:2567;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Testing Locally

```bash
# Build everything
npm run build

# Start production server
npm start

# Visit http://localhost:2567
```

The game will be fully playable with both HTTP and WebSocket handled by the same server!