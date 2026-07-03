/** 业务错误：带业务错误码与 HTTP 状态码。全局错误处理器（app.ts）负责翻译为响应。 */
export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(code: string, statusCode: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
