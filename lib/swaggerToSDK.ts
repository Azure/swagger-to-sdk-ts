import * as jsDevTools from "@ts-common/azure-js-dev-tools";
import { NoTelemetry, Telemetry } from "./telemetry";

/**
 * Options that can be provided when creating a new SwaggerToSDK object.
 */
export interface SwaggerToSDKOptions {
  /**
   * The telemetry object that SwaggerToSDK will use. Defaults to NoTelemetry.
   */
  telemetry?: Telemetry;

  /**
   * The client that will be used to send HTTP requests.
   */
  httpClient?: jsDevTools.HttpClient;
}

/**
 * Options that can be provided to the SwaggerToSDK.pullRequestChange() function.
 */
export interface SwaggerToSDKPullRequestChangeOptions {
}

/**
 * The regular expression used to get a relative file path from a pull request diff_url contents
 * line.
 */
const diffGitLineRegex: RegExp = /diff --git a\/(.*) b\/.*/;

/**
 * The collection of functions that implement the Swagger To SDK service.
 */
export class SwaggerToSDK {
  public readonly telemetry: Telemetry;
  public readonly httpClient: jsDevTools.HttpClient;

  constructor(options?: SwaggerToSDKOptions) {
    options = options || {};
    this.telemetry = options.telemetry || new NoTelemetry();
    this.httpClient = options.httpClient || new jsDevTools.NodeHttpClient();
  }

  public logMessage(text: string): void {
    this.telemetry.logMessage(text);
  }

  public logError(text: string): void {
    this.telemetry.logMessage(`ERROR: ${text}`);
  }

  /**
   * The implementation-independent function that gets called when GitHub invokes a pull request webhook request to our tooling service.
   * @param pullRequestChangeBody The body of the GitHub pull request webhook request.
   */
  public async pullRequestChange(pullRequestChangeBody: jsDevTools.GitHubPullRequestWebhookBody, options?: SwaggerToSDKPullRequestChangeOptions): Promise<void> {
    options = options || {};

    const azureRestAPISpecsPullRequest: jsDevTools.GitHubPullRequest = pullRequestChangeBody.pull_request;
    this.logMessage(`Received pull request change webhook request from GitHub for "${azureRestAPISpecsPullRequest.html_url}".`);

    this.logMessage(`Getting diff_url (${azureRestAPISpecsPullRequest.diff_url}) contents...`);
    const diffUrlResponse: jsDevTools.HttpResponse = await this.httpClient.sendRequest({ method: "GET", url: azureRestAPISpecsPullRequest.diff_url });
    const statusCodeMessage = `diff_url response status code is ${diffUrlResponse.statusCode}.`;
    if (diffUrlResponse.statusCode !== 200) {
      this.logError(statusCodeMessage);
    } else {
      this.logMessage(statusCodeMessage);
      if (!diffUrlResponse.body) {
        this.logError(`diff_url response body is empty.`);
      } else {
        const diffUrlResponseBodyLines: string[] = diffUrlResponse.body.split(/\r?\n/);
        this.logMessage(`diff_url response body contains ${diffUrlResponseBodyLines.length} lines.`);
        const changedFileDiffLinePrefix = "diff --git";
        const diffGitLines: string[] = jsDevTools.where(diffUrlResponseBodyLines, (line: string) => line.startsWith(changedFileDiffLinePrefix));
        this.logMessage(`diff_url response body contains ${diffGitLines.length} "${changedFileDiffLinePrefix}" lines.`);
        const changedFileRelativePaths: string[] = jsDevTools.map(diffGitLines, (line: string) => line.match(diffGitLineRegex)![1]);
        this.logMessage(`diff_url response body contains ${changedFileRelativePaths.length} changed files:`);
        for (const changedFileRelativePath of changedFileRelativePaths) {
          this.logMessage(changedFileRelativePath);
        }
        const specificationChangedFileRelativePaths: string[] = jsDevTools.where(changedFileRelativePaths, (text: string) => text.startsWith("specification/"));
        this.logMessage(`diff_url response body contains ${specificationChangedFileRelativePaths.length} changed files in the specification folder:`);
        for (const changedFileRelativePath of specificationChangedFileRelativePaths) {
          this.logMessage(changedFileRelativePath);
        }
        const readmeMdRelativeFilePathsToGenerate: string[] = [];
        for (const changedFileRelativePath of specificationChangedFileRelativePaths) {
          let searchString = "/resource-manager/";
          let searchStringIndex: number = changedFileRelativePath.indexOf(searchString);
          if (searchStringIndex === -1) {
            searchString = "/data-plane/";
            searchStringIndex = changedFileRelativePath.indexOf(searchString);
          }

          if (searchStringIndex !== -1) {
            const readmeMdRelativeFilePath = changedFileRelativePath.substr(0, searchStringIndex + searchString.length) + "readme.md";
            if (readmeMdRelativeFilePathsToGenerate.indexOf(readmeMdRelativeFilePath) === -1) {
              readmeMdRelativeFilePathsToGenerate.push(readmeMdRelativeFilePath);
            }
          }
        }
        this.logMessage(`Found ${readmeMdRelativeFilePathsToGenerate.length} readme.md files to generate:`);
        for (const readmeMdRelativeFilePathToGenerate of readmeMdRelativeFilePathsToGenerate) {
          this.logMessage(readmeMdRelativeFilePathToGenerate);
        }
      }
    }
  }
}
