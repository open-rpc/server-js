export class JSONRPCError extends Error {
  public code: number;
  public message: string;
  public data?: any;
  constructor(message: string, code: number, data?: any) {
    super();
    this.code = code;
    this.message = message;
    this.data = data;
  }
}
