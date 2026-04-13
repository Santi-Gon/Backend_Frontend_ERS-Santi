/**
 * ResponseInterceptor
 * Envuelve TODAS las respuestas del API en el formato estándar:
 * {
 *   statusCode: number,
 *   intOpCode: number,  ← 0 = éxito
 *   data: T[]
 * }
 */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  statusCode: number;
  intOpCode: number;
  data: T[];
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse();

    return next.handle().pipe(
      map((data) => ({
        statusCode: response.statusCode,
        intOpCode: 0,
        // Si el servicio ya devuelve un array lo usamos; si es un objeto lo envolvemos
        data: Array.isArray(data) ? data : [data],
      })),
    );
  }
}
