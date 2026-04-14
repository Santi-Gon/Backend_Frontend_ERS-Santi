import 'dotenv/config';
import { buildApp } from './app';

const PORT = parseInt(process.env.PORT ?? '3002', 10);

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`\n🚀 ERS-Santi Tickets corriendo en: http://localhost:${PORT}/api/v1`);
    console.log(`💡 Health check: http://localhost:${PORT}/api/v1/health\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
