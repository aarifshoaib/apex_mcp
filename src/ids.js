/**
 * Unique ID generator singleton.
 * Formula: 8_900_000_000_000_000 + (salt % 1_000_000) * 1_000_000 + counter
 */

const BASE = 8_900_000_000_000_000n;

class IdGenerator {
  constructor() {
    this._salt = 0n;
    this._counter = 0n;
    this._registry = {};
    this._newSalt();
  }

  _newSalt() {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const raw = bytes.reduce((acc, b, i) => acc | (BigInt(b) << BigInt(i * 8)), 0n);
    this._salt = raw % 1_000_000n;
  }

  reset() {
    this._newSalt();
    this._counter = 0n;
    this._registry = {};
  }

  next(name) {
    this._counter++;
    const id = BASE + this._salt * 1_000_000n + this._counter;
    const num = Number(id);
    if (name) this._registry[name] = num;
    return num;
  }

  get(name) {
    if (!(name in this._registry)) throw new Error(`No ID registered for '${name}'`);
    return this._registry[name];
  }

  register(name, value) {
    this._registry[name] = value;
    return value;
  }

  has(name) {
    return name in this._registry;
  }
}

export const ids = new IdGenerator();
