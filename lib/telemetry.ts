/**
 * A telemetry interface that is used by the SwaggerToSDK service.
 */
export interface Telemetry {
  /**
   * Log the provided message to the telemetry endpoint.
   * @param message The message to log.
   */
  logMessage(message: string): void;
}

/**
 * An implementation of the Telemetry interface that does nothing.
 */
export class NoTelemetry implements Telemetry {
  public logMessage(): void {
  }
}

/**
 * An implementation of the Telemetry interface that stores all logs in-memory.
 */
export class InMemoryTelemetry implements Telemetry {
  public readonly logs: string[] = [];

  public logMessage(message: string): void {
    this.logs.push(message);
  }
}
