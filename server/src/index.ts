import { createApp } from './app.js';
import { config } from './config.js';

const server = createApp().listen(config.port, () => {
    console.log(`News API listening on http://localhost:${config.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => server.close(() => process.exit(0)));
}
