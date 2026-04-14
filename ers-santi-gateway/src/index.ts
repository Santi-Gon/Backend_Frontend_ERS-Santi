import { config } from 'dotenv';
config();

import { buildApp } from './app';

async function bootstrap() {
  const app = await buildApp();
  const port = parseInt(process.env.PORT ?? '3003', 10);

  try {
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 ERS-Santi API Gateway corriendo en: http://localhost:${port}/api/v1`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
