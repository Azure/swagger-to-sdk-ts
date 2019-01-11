import { GitHubPullRequestWebhookBody } from "@ts-common/azure-js-dev-tools";
import { InMemoryTelemetry } from "./inMemoryTelemetry";
import { Telemetry } from "./telemetry";

/**
 * The collection of functions that implement the Swagger To SDK service.
 */
export class SwaggerToSDK {
  public readonly telemetry: Telemetry;

  constructor(telemetry?: Telemetry) {
    this.telemetry = telemetry || new InMemoryTelemetry();
  }

  /**
   * The implementation-independent function that gets called when GitHub invokes a pull request webhook request to our tooling service.
   * @param pullRequestChangeBody The body of the GitHub pull request webhook request.
   */
  public pullRequestChange(pullRequestChangeBody: GitHubPullRequestWebhookBody): void {
    this.telemetry.logMessage(`SWAGGER_TO_SDK: Received pull request change webhook request from GitHub for "${pullRequestChangeBody.pull_request.url}".`);
  }
}
