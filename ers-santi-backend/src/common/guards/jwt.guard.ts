/**
 * JwtGuard — compatible con ES256 (proyectos Supabase nuevos) y HS256 (legacy)
 *
 * Supabase firmaba con HS256 usando el JWT Secret del proyecto.
 * Los proyectos nuevos (2024+) usan ES256 con un par de claves pública/privada.
 *
 * Este guard:
 * 1. Decodifica el header del token para leer el algoritmo (alg) y el key id (kid)
 * 2. Si es HS256 → verifica con SUPABASE_JWT_SECRET (clave simétrica)
 * 3. Si es ES256 u otro asimétrico → obtiene la clave pública desde el
 *    endpoint JWKS de Supabase y verifica con ella
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import jwksRsa = require('jwks-rsa');

@Injectable()
export class JwtGuard implements CanActivate {
  private jwksClient: jwksRsa.JwksClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');

    // Cliente JWKS: obtiene y cachea las claves públicas de Supabase
    this.jwksClient = jwksRsa({
      jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      cache: true,          // Cachea las claves para no ir a internet en cada request
      cacheMaxEntries: 5,
      cacheMaxAge: 600000,  // 10 minutos en ms
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No se proporcionó token de acceso.');
    }

    try {
      const payload = await this.verifyToken(token);
      // Adjuntamos el payload al request para usarlo en PermissionGuard y controllers
      (request as any).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado.');
    }
  }

  private verifyToken(token: string): Promise<jwt.JwtPayload> {
    return new Promise((resolve, reject) => {
      // Decodificar el header sin verificar para leer alg y kid
      const decoded = jwt.decode(token, { complete: true });

      if (!decoded || typeof decoded === 'string') {
        return reject(new Error('Token malformado'));
      }

      const alg = decoded.header.alg as jwt.Algorithm;
      const kid = decoded.header.kid;

      // ── Caso HS256 (proyectos legacy de Supabase) ──────────────────────
      if (alg === 'HS256') {
        const secret = this.configService.get<string>('SUPABASE_JWT_SECRET');
        try {
          const payload = jwt.verify(token, secret!, {
            algorithms: ['HS256'],
          }) as jwt.JwtPayload;
          return resolve(payload);
        } catch (e) {
          return reject(e);
        }
      }

      // ── Caso ES256 / RS256 (proyectos nuevos de Supabase) ─────────────
      // Obtenemos la clave pública correspondiente al kid del token
      this.jwksClient.getSigningKey(kid, (err, key) => {
        if (err || !key) {
          return reject(
            err ?? new Error(`Clave de firma no encontrada para kid: ${kid}`),
          );
        }

        const publicKey = key.getPublicKey();

        try {
          const payload = jwt.verify(token, publicKey, {
            algorithms: [alg],
          }) as jwt.JwtPayload;
          resolve(payload);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.substring(7);
  }
}

