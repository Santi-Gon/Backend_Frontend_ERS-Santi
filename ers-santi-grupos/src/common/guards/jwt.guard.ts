/**
 * JwtGuard — compatible con ES256 (proyectos Supabase nuevos) y HS256 (legacy)
 *
 * Los proyectos nuevos de Supabase (2024+) firman tokens con ES256.
 * Este guard detecta el algoritmo del header y verifica en consecuencia:
 *   - HS256 → usa SUPABASE_JWT_SECRET (clave simétrica del .env)
 *   - ES256 / RS256 → obtiene la clave pública desde el JWKS de Supabase
 *
 * Si el token es válido, adjunta el payload en request.user para
 * que los guards y controllers siguientes puedan usarlo.
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

    this.jwksClient = jwksRsa({
      jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000, // 10 minutos
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
      (request as any).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado.');
    }
  }

  private verifyToken(token: string): Promise<jwt.JwtPayload> {
    return new Promise((resolve, reject) => {
      const decoded = jwt.decode(token, { complete: true });

      if (!decoded || typeof decoded === 'string') {
        return reject(new Error('Token malformado'));
      }

      const alg = decoded.header.alg as jwt.Algorithm;
      const kid = decoded.header.kid;

      // ── HS256 (proyectos legacy de Supabase) ───────────────────────────
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

      // ── ES256 / RS256 (proyectos nuevos de Supabase — JWKS) ────────────
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
