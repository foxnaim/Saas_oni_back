<div align="center">

# 🔧 Anonymous-chat-backend

**Backend API for Anonymous Chat — Node.js, Express, WebSocket**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

</div>

---

## About

Backend service for the Anonymous Chat platform. Handles WebSocket connections, message routing, and room management. Fully containerized with Docker.

## Features

- 🔌 **WebSocket Server** — Real-time bidirectional communication
- 🏠 **Room Management** — Create and join chat rooms
- 📨 **Message Routing** — Efficient message delivery
- 🐳 **Docker** — Multi-stage Docker builds
- 🧪 **Tests** — Jest test coverage
- 🚀 **CI-ready** — Railway deployment config included

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Framework | Express + NestJS |
| Language | TypeScript |
| Real-time | Socket.io |
| Testing | Jest |
| Deploy | Docker, Railway |

## Getting Started

```bash
git clone https://github.com/foxnaim/Anonymous-chat-backend.git
cd Anonymous-chat-backend
yarn install
yarn start:dev
```

### Docker

```bash
docker-compose -f docker-compose.dev.yml up
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| WS | `/` | WebSocket connection |
| GET | `/health` | Health check |

## License

MIT © [foxnaim](https://github.com/foxnaim)
# Saas_oni_back
