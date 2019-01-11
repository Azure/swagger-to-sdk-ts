import { GitHubCommit, GitHubPullRequestWebhookBody } from "@ts-common/azure-js-dev-tools";
import { assert } from "chai";
import { InMemoryTelemetry } from "../lib/inMemoryTelemetry";
import { SwaggerToSDK } from "../lib/swaggerToSDK";

const baseCommit: GitHubCommit = {
  label: "FakeBaseLabel",
  ref: "FakeBaseRef",
  sha: "FakeBaseSha"
};

const headCommit: GitHubCommit = {
  label: "FakeHeadLabel",
  ref: "FakeHeadRef",
  sha: "FakeHeadSha"
};

describe("SwaggerToSDK", function () {
  describe("constructor()", function () {
    it("with no arguments", function () {
      const swaggerToSDK = new SwaggerToSDK();
      assert(swaggerToSDK.telemetry instanceof InMemoryTelemetry);
    });

    it("with undefined telemetry argument", function () {
      const swaggerToSDK = new SwaggerToSDK(undefined);
      assert(swaggerToSDK.telemetry instanceof InMemoryTelemetry);
    });

    it("with telemetry argument", function () {
      const telemetry = new InMemoryTelemetry();
      const swaggerToSDK = new SwaggerToSDK(telemetry);
      assert.strictEqual(swaggerToSDK.telemetry, telemetry);
    });
  });

  describe("pullRequestChange()", function () {
    it("should log the pull request's URL to telemetry", function () {
      const telemetry = new InMemoryTelemetry();
      const swaggerToSDK = new SwaggerToSDK(telemetry);
      const webhookBody: GitHubPullRequestWebhookBody = {
        action: "opened",
        number: 1,
        pull_request: {
          base: baseCommit,
          head: headCommit,
          id: 2,
          labels: [],
          number: 3,
          state: "open",
          title: "My Fake Pull Request",
          url: "https://github.com/can/you/guess/this/is/fake",
          milestone: undefined,
          assignees: undefined
        }
      };
      swaggerToSDK.pullRequestChange(webhookBody);
      assert.deepEqual(telemetry.logs, [
        "SWAGGER_TO_SDK: Received pull request change webhook request from GitHub for \"https://github.com/can/you/guess/this/is/fake\"."
      ]);
    });
  });
});
