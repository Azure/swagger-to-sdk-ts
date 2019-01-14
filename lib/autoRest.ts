/**
 * An interface that can be used to invoke an AutoRest generation process.
 */
export interface AutoRest {
  /**
   * Create a new synchronous AutoRest generation process.
   */
  run(): void;
}