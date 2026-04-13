import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardResponse<T> {
  statusCode: number;
  intOpCode: number;
  data: T[];
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse();

    return next.handle().pipe(
      map((data) => ({
        statusCode: response.statusCode,
        intOpCode: 0,
        data: Array.isArray(data) ? data : [data],
      })),
    );
  }
}
