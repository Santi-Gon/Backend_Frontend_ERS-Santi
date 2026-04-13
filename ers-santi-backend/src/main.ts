import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Prefijo global de API ────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── CORS ─────────────────────────────────────────────────────────────────
  // Ajusta el origin al dominio de tu frontend cuando lo conectes
  app.enableCors({
    origin: ['http://localhost:4200', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Validación global de DTOs ─────────────────────────────────────────────
  // whitelist: rechaza campos no definidos en el DTO
  // forbidNonWhitelisted: devuelve error si hay campos extra
  // transform: convierte los tipos automáticamente (string → number, etc.)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Formato de respuesta estándar ─────────────────────────────────────────
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 ERS-Santi Backend corriendo en: http://localhost:${port}/api/v1`);
}

bootstrap();

