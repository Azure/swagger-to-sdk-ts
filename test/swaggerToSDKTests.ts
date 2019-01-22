import * as jsDevTools from "@ts-common/azure-js-dev-tools";
import { HttpHeaders } from "@ts-common/azure-js-dev-tools";
import { assert } from "chai";
import { SwaggerToSDK } from "../lib/swaggerToSDK";
import { InMemoryTelemetry, NoTelemetry } from "../lib/telemetry";

const baseCommit: jsDevTools.GitHubCommit = {
  label: "Azure:master",
  ref: "master",
  sha: "1b8809ee779437bc13f9af9373a5d47472a6b889"
};

const headCommit: jsDevTools.GitHubCommit = {
  label: "pixia:master",
  ref: "master",
  sha: "d82d1491879729cdf44da9a664e815112acde158"
};

const pullRequest: jsDevTools.GitHubPullRequest = {
  base: baseCommit,
  head: headCommit,
  merge_commit_sha: "2ce7da83cb44a735d65010158b01807ef11441e2",
  id: 244099155,
  labels: [],
  number: 5025,
  state: "open",
  title: "Fix set LTR policy example",
  url: "https://api.github.com/repos/Azure/azure-rest-api-specs/pulls/5025",
  html_url: "https://github.com/Azure/azure-rest-api-specs/pull/5025",
  diff_url: "https://github.com/Azure/azure-rest-api-specs/pull/5025.diff",
  milestone: undefined,
  assignees: undefined
};

describe("SwaggerToSDK", function () {
  describe("constructor()", function () {
    it("with no arguments", function () {
      const swaggerToSDK = new SwaggerToSDK();
      assert(swaggerToSDK.telemetry instanceof NoTelemetry);
      assert(swaggerToSDK.httpClient instanceof jsDevTools.NodeHttpClient);
    });

    it("with undefined options argument", function () {
      const swaggerToSDK = new SwaggerToSDK(undefined);
      assert(swaggerToSDK.telemetry instanceof NoTelemetry);
      assert(swaggerToSDK.httpClient instanceof jsDevTools.NodeHttpClient);
    });

    it("with telemetry argument", function () {
      const telemetry = new InMemoryTelemetry();
      const swaggerToSDK = new SwaggerToSDK({ telemetry });
      assert.strictEqual(swaggerToSDK.telemetry, telemetry);
      assert(swaggerToSDK.httpClient instanceof jsDevTools.NodeHttpClient);
    });

    it("with httpClient argument", function () {
      const httpClient = new jsDevTools.NodeHttpClient();
      const swaggerToSDK = new SwaggerToSDK({ httpClient });
      assert(swaggerToSDK.telemetry instanceof NoTelemetry);
      assert.strictEqual(swaggerToSDK.httpClient, httpClient);
    });
  });

  describe("pullRequestChange()", function () {
    describe("pull request created", function () {
      it("when diff_url returns 404", async function () {
        const telemetry = new InMemoryTelemetry();
        const httpClient: jsDevTools.HttpClient = {
          sendRequest(request: jsDevTools.HttpRequest): Promise<jsDevTools.HttpResponse> {
            return Promise.resolve({
              request,
              statusCode: 404,
              headers: new HttpHeaders()
            });
          }
        };
        const swaggerToSDK = new SwaggerToSDK({ telemetry, httpClient });
        const webhookBody: jsDevTools.GitHubPullRequestWebhookBody = {
          action: "opened",
          number: 1,
          pull_request: pullRequest
        };
        await swaggerToSDK.pullRequestChange(webhookBody);
        assert.deepEqual(telemetry.logs, [
          `Received pull request change webhook request from GitHub for "https://github.com/Azure/azure-rest-api-specs/pull/5025".`,
          `Getting diff_url (https://github.com/Azure/azure-rest-api-specs/pull/5025.diff) contents...`,
          `ERROR: diff_url response status code is 404.`
        ]);
      });

      it("when diff_url returns empty body", async function () {
        const telemetry = new InMemoryTelemetry();
        const httpClient: jsDevTools.HttpClient = {
          sendRequest(request: jsDevTools.HttpRequest): Promise<jsDevTools.HttpResponse> {
            return Promise.resolve({
              request,
              statusCode: 200,
              headers: new HttpHeaders(),
              body: ""
            });
          }
        };
        const swaggerToSDK = new SwaggerToSDK({ telemetry, httpClient });
        const webhookBody: jsDevTools.GitHubPullRequestWebhookBody = {
          action: "opened",
          number: 1,
          pull_request: pullRequest
        };
        await swaggerToSDK.pullRequestChange(webhookBody);
        assert.deepEqual(telemetry.logs, [
          `Received pull request change webhook request from GitHub for "https://github.com/Azure/azure-rest-api-specs/pull/5025".`,
          `Getting diff_url (https://github.com/Azure/azure-rest-api-specs/pull/5025.diff) contents...`,
          `diff_url response status code is 200.`,
          `ERROR: diff_url response body is empty.`
        ]);
      });

      it("end-to-end", async function () {
        this.timeout(600000);
        const telemetry = new InMemoryTelemetry();
        const httpClient: jsDevTools.HttpClient = new jsDevTools.NodeHttpClient();
        const swaggerToSDK = new SwaggerToSDK({ telemetry, httpClient });
        const webhookBody: jsDevTools.GitHubPullRequestWebhookBody = {
          action: "opened",
          number: 1,
          pull_request: pullRequest
        };
        await swaggerToSDK.pullRequestChange(webhookBody, { workingFolderPath: "C:/" });
        assert.deepEqual(telemetry.logs, [
          `Received pull request change webhook request from GitHub for "https://github.com/Azure/azure-rest-api-specs/pull/5025".`,
          `Getting diff_url (https://github.com/Azure/azure-rest-api-specs/pull/5025.diff) contents...`,
          `diff_url response status code is 200.`,
          `diff_url response body contains 87 lines.`,
          `diff_url response body contains 2 "diff --git" lines.`,
          `diff_url response body contains 2 changed files:`,
          `specification/sql/resource-manager/Microsoft.Sql/preview/2017-03-01-preview/examples/LongTermRetentionPolicyCreateOrUpdate.json`,
          `specification/sql/resource-manager/Microsoft.Sql/preview/2017-03-01-preview/longTermRetention.json`,
          `diff_url response body contains 2 changed files in the specification folder:`,
          `specification/sql/resource-manager/Microsoft.Sql/preview/2017-03-01-preview/examples/LongTermRetentionPolicyCreateOrUpdate.json`,
          `specification/sql/resource-manager/Microsoft.Sql/preview/2017-03-01-preview/longTermRetention.json`,
          `Found 1 readme.md files to generate:`,
          `specification/sql/resource-manager/readme.md`,
          `Looking for languages to generate in "specification/sql/resource-manager/readme.md"...`,
          `Getting file contents for "https://raw.githubusercontent.com/azure/azure-rest-api-specs/2ce7da83cb44a735d65010158b01807ef11441e2/specification/sql/resource-manager/readme.md"...`,
          `Merged readme.md response status code is 200.`,
          `Found 6 requested SDK repositories:`,
          `azure-sdk-for-python`,
          `azure-sdk-for-java`,
          `azure-sdk-for-go`,
          `azure-sdk-for-node`,
          `azure-sdk-for-js`,
          `azure-sdk-for-ruby`,
          `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-python C:/5025/1/1`,
          `Deleting clone of Azure/azure-sdk-for-python at folder C:/5025/1/1...`,
          `Finished deleting clone of Azure/azure-sdk-for-python at folder C:/5025/1/1.`,
          `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-java C:/5025/1/1`,
          `Deleting clone of Azure/azure-sdk-for-java at folder C:/5025/1/1...`,
          `Finished deleting clone of Azure/azure-sdk-for-java at folder C:/5025/1/1.`,
          `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-go C:/5025/1/src/github.com/Azure/azure-sdk-for-go`,
          `Deleting clone of Azure/azure-sdk-for-go at folder C:/5025/1/src/github.com/Azure/azure-sdk-for-go...`,
          `Finished deleting clone of Azure/azure-sdk-for-go at folder C:/5025/1/src/github.com/Azure/azure-sdk-for-go.`,
          `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-node C:/5025/1/azure-sdk-for-node`,
          `Deleting clone of Azure/azure-sdk-for-node at folder C:/5025/1/azure-sdk-for-node...`,
          `Finished deleting clone of Azure/azure-sdk-for-node at folder C:/5025/1/azure-sdk-for-node.`,
          `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-js C:/5025/1/azure-sdk-for-js`,
          `Deleting clone of Azure/azure-sdk-for-js at folder C:/5025/1/azure-sdk-for-js...`,
          `Finished deleting clone of Azure/azure-sdk-for-js at folder C:/5025/1/azure-sdk-for-js.`,
          `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-ruby C:/5025/1/1`,
          `Deleting clone of Azure/azure-sdk-for-ruby at folder C:/5025/1/1...`,
          `Finished deleting clone of Azure/azure-sdk-for-ruby at folder C:/5025/1/1.`,
          `Deleting generation instance folder C:/5025/1...`,
          `Finished deleting generation instance folder C:/5025/1.`
        ]);
      });
    });
  });
});
