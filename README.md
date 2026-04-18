<div align="center">

# Sayless Backend

**NestJS backend for the Sayless anonymous feedback platform**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

</div>

---

## About

Backend service for the Sayless anonymous feedback platform. Built with NestJS and TypeScript, it handles authentication, real-time WebSocket connections, feedback management, and Telegram bot integration. Fully containerized with Docker.

## Features

- **WebSocket Server** — Real-time bidirectional communication via Socket.IO
- **Authentication** — JWT-based auth with OAuth support
- **MongoDB** — Persistent storage with Mongoose
- **Telegram Bot** — Feedback notifications via Telegram
- **Docker** — Multi-stage Docker builds
- **Tests** — Jest test coverage
- **CI-ready** — Railway deployment config included

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | NestJS |
| Language | TypeScript |
| Database | MongoDB |
| Real-time | Socket.IO |
| Bot | Telegram Bot API |
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
