export class Optional<T> {
  private constructor(
    readonly _value: T | undefined
  ) {
  }

  isPresent() {
    return this._value !== undefined;
  }

  isEmpty() {
    return !this.isPresent();
  }

  orElse(other: () => T | Promise<T>) {
    return this.isPresent()
      ? this._value as T
      : other();
  }

  get value(): T {
    if (this.isEmpty()) {
      throw new Error("Value is not present");
    }
    return this._value as T;
  }

  static of<T>(value: T) {
    return new Optional(value);
  }

  static empty<T>() {
    return new Optional<T>(undefined);
  }
}