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