import internal from "stream";

export class CustomResponse<T> extends Response {
  constructor(body: T, init?: ResponseInit) {
    super(JSON.stringify(body), {
      ...init,
      headers: {
        ...init?.headers,
        "Content-Type": "application/json",
      },
    });
  }

  static ok<T>(body: T) {
    return new CustomResponse(body, { status: 200 });
  }

  static badRequest<T>(body: T) {
    return new CustomResponse(body, { status: 400 });
  }

  static internalServerError<T>(body: T) {
    return new CustomResponse(body, { status: 500 });
  }
}