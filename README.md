# Nebulosa Web

Lightweight, decentralized web client for the **Hive blockchain** — powered directly by public Hive JSON-RPC APIs with zero backend, zero database, and zero secrets.

## Tech Stack

| Layer | Technology |
|---|---|
| Build | [Vite 8](https://vitejs.dev/) |
| UI | [React 19](https://react.dev/) + TypeScript |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| Icons | [Lucide React](https://lucide.dev/) |
| Sanitization | [DOMPurify](https://github.com/cure53/DOMPurify) |
| Runtime | Node >= 22.12 |

## Getting Started

### Prerequisites

- **Node.js** >= 22.12 (recommended: latest LTS)

### Setup

```bash
# Clone the repository
git clone https://github.com/faireye-hive/vision-web.git
cd vision-web

# Install dependencies
npm install

# Start the development server (http://localhost:3000)
npm run dev
```

### Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite dev server on port 3000 |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |

## Project Structure

The layout, routes, and the constraints that are easy to break are in [docs/estado.md](docs/estado.md).

## Architecture

The app is a **pure client-side SPA** — no SSR, no API proxy, no server-side secrets. All blockchain data is fetched directly from public Hive RPC nodes via JSON-RPC 2.0 calls through the browser's native `fetch` API.

**Signing & broadcasting** is handled via [Hive Keychain](https://hive-keychain.com/) browser extension — the app never touches private keys.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

---

## License

[MIT](LICENSE)
