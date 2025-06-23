# Static Hosting Deployment Guide

The Heart of Five client can be deployed to any static hosting service. The built files are in the `dist` directory after running `npm run build`.

## Prerequisites

1. Build the client:
   ```bash
   cd client
   npm install
   npm run build
   ```

2. Configure the WebSocket server URL in `.env.production`:
   ```
   VITE_SERVER_URL=wss://your-game-server.com
   ```

## Deployment Options

### 1. Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --dir=dist --prod
```

Or drag and drop the `dist` folder to [Netlify Drop](https://app.netlify.com/drop).

### 2. Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod dist
```

### 3. GitHub Pages

1. Add to `vite.config.ts`:
   ```typescript
   base: '/your-repo-name/'
   ```

2. Deploy:
   ```bash
   npm run build
   npx gh-pages -d dist
   ```

### 4. AWS S3 + CloudFront

```bash
# Upload to S3
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### 5. Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/heartfive;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Important Notes

1. **WebSocket Server**: The game requires a running Colyseus server. The client connects via WebSocket to the URL specified in `VITE_SERVER_URL`.

2. **CORS**: Ensure your game server allows connections from your client's domain:
   ```typescript
   // In your Colyseus server
   const server = new Server({
     cors: {
       origin: ["https://your-client-domain.com"]
     }
   });
   ```

3. **HTTPS**: For production, use `wss://` (secure WebSocket) instead of `ws://`.

4. **Environment Variables**: Set `VITE_SERVER_URL` before building, or update it in the built files.

## Build Output

The `dist` directory contains:
- `index.html` - Entry point
- `assets/` - JavaScript, CSS, and other assets
- All files are optimized and minified for production

## Testing Production Build Locally

```bash
cd client
npm run build
npm run preview
```

This serves the production build locally at http://localhost:4173.