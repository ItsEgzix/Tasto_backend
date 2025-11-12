# Food Cost App - Backend API

Express.js backend server for the Food Cost Management App.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

3. Update `.env` with your Supabase connection string and configuration.

## Development

Run the development server with hot reload:

```bash
npm run dev
```

The server will start on `http://localhost:5000` (or the port specified in `.env`).

## Build

Build for production:

```bash
npm run build
```

Start production server:

```bash
npm start
```

## API Endpoints

API endpoints will be available at `/api/*` once routes are implemented.

Health check: `GET /health`
