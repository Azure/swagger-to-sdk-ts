import { AutoRest } from "./autoRest";

/**
 * A fake AutoRest facade implementation.
 */
export class FakeAutoRest implements AutoRest {
  public run(): void {
    throw new Error("Method not implemented.");
  }
}