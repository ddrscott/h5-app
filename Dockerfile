# Build stage for client
FROM node:20-alpine AS client-builder

# Accept build arguments for client configuration
ARG VITE_WEB_URL
ARG VITE_SERVER_URL

WORKDIR /app/client-v2

# Copy client package files
COPY client-v2/package*.json ./
RUN npm ci

# Copy client source files
COPY client-v2/ ./

# Set environment variables for the build
ENV VITE_WEB_URL=${VITE_WEB_URL}
ENV VITE_SERVER_URL=${VITE_SERVER_URL}

# Build the client (Vite)
RUN npm run build

# Build stage for server
FROM node:20-alpine AS server-builder

WORKDIR /app

# Copy server package files
COPY package*.json ./
RUN npm ci

# Copy server source files
COPY . ./

# Build the server (TypeScript)
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built server files from server-builder
COPY --from=server-builder /app/build ./build

# Copy built client files from client-builder to be served statically
COPY --from=client-builder /app/client-v2/dist ./client-v2/dist

# Copy any other necessary files
# COPY .env.example .env

# Expose the port (Colyseus default is 2567)
EXPOSE 2567

# Set environment to production
ENV NODE_ENV=production

# Default WEB_URL to localhost
ENV WEB_URL=http://localhost:2567

# Start the server
CMD ["node", "build/index.js"]
