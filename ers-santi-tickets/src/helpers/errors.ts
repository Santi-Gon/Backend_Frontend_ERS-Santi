/** Crea un error con statusCode para que el setErrorHandler lo procese correctamente */
export function createError(statusCode: number, message: string): Error {
  const err = new Error(message) as any;
  err.statusCode = statusCode;
  return err;
}
