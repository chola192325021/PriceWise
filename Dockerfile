FROM node:20-slim

# Install latest chromium (and its dependencies) for Puppeteer
RUN apt-get update \
    && apt-get install -y chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to skip downloading Chrome and use the installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port (Render defaults to 10000 if not specified, but let's be explicit)
EXPOSE 10000

# Start the application
CMD ["node", "server.js"]
