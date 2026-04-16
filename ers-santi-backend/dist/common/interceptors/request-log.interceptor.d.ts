import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { SupabaseService } from '../../supabase/supabase.service';
export declare class RequestLogInterceptor implements NestInterceptor {
    private readonly supabaseService;
    constructor(supabaseService: SupabaseService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
}
