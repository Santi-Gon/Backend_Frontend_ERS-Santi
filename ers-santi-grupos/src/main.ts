import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Prefijo global de API ────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: ['http://localhost:4200', 'http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Validación global de DTOs ─────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Formato de respuesta estándar ─────────────────────────────────────────
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 ERS-Santi Grupos corriendo en: http://localhost:${port}/api/v1`);
}

bootstrap();
