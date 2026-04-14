import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Prefijo global de API ────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── CORS REMOVIDO ────────────────────────────────────────────────────────
  // El API Gateway ahora maneja todo el CORS con el frontend de Angular.
  // Este microservicio no debe emitir headers de CORS origin.


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

  // ── Seguridad: solo el API Gateway puede hablar con este servicio ─────────
  // Verifica el header X-Internal-Secret en cada request.
  // OPTIONS (preflight CORS) pasa sin verificar.
  app.use((req: any, res: any, next: any) => {
    if (req.method === 'OPTIONS') return next();
    const secret = req.headers['x-internal-secret'];
    if (!secret || secret !== process.env.INTERNAL_SECRET) {
      return res.status(403).json({
        statusCode: 403,
        intOpCode: 1,
        data: [{ message: 'Acceso no autorizado. Usa el API Gateway.' }],
      });
    }
    next();
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 ERS-Santi Backend corriendo en: http://localhost:${port}/api/v1`);
}

bootstrap();

