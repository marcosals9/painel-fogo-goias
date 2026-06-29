FROM ubuntu:24.04

# Configurar timezone e noninteractive para não travar o apt-get
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=America/Sao_Paulo

# Instalar dependências essenciais, Node.js 20, e as dependências reais do Puppeteer (X11, GLib, etc)
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    python3 \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libcups2 \
    libxss1 \
    libxrandr2 \
    libasound2t64 \
    libatk1.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    --no-install-recommends

# Instalar Node.js nativo do Ubuntu e NPM
RUN apt-get update && apt-get install -y \
    ca-certificates \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*


WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
