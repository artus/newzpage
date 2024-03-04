import { Logger } from "../helpers/logger";

export class Result<T> {
  private constructor(
    private readonly _value?: T,
    readonly _error?: Error) {
    if (!!_value && !!_error) {
      throw new Error("A result can not contain both a value and an error.");
    }
  }

  isSuccess(): boolean {
    return this._error === undefined;
  }

  get value(): T  {
    if (this.isFailure()) {
      this.throwError();
    }
    return this._value as T;
  }

  get error(): Error {
    if (this.isSuccess()) {
      throw new Error("Can not get Error of a successful result.");
    }

    return this._error!;
  }

  private throwError() {
    Logger.error("Error in Result", this.error);
    throw this.error;
  }

  isFailure(): boolean {
    return !this.isSuccess();
  }

  static success<T>(value: T) {
    return new Result(value);
  }

  static failure<T>(error: Error | string): Result<T> {
    if (typeof error === "string") {
      return new Result(null as T, new Error(error));
    }

    return new Result(null as T, error);
  }
}