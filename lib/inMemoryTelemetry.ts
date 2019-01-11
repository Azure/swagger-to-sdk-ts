import { Telemetry } from "./telemetry";

/**
 * An implementation of the Telemetry interface that stores all logs in-memory.
 */
export class InMemoryTelemetry implements Telemetry {
  public readonly logs: string[] = [];

  /**
   * Log the provided message to the telemetry endpoint.
   * @param message The message to log.
   */
  public logMessage(message: string): void {
    this.logs.push(message);
  }
}