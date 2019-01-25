import * as jsDevTools from "@ts-common/azure-js-dev-tools";
import { npmExecutable } from "@ts-common/azure-js-dev-tools";
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

const pullRequestMergeCommitSha = "5d204450e3ea6709a034208af441ebaaa87bd805";
const pullRequestId = 242467286;
const pullRequestNumber = 4994;
const pullRequestTitle = "Fix mysql sku values";

const pullRequest: jsDevTools.GitHubPullRequest = {
  base: baseCommit,
  head: headCommit,
  merge_commit_sha: pullRequestMergeCommitSha,
  id: pullRequestId,
  labels: [],
  number: pullRequestNumber,
  state: "open",
  title: pullRequestTitle,
  url: `https://api.github.com/repos/Azure/azure-rest-api-specs/pulls/${pullRequestNumber}`,
  html_url: `https://github.com/Azure/azure-rest-api-specs/pull/${pullRequestNumber}`,
  diff_url: `https://github.com/Azure/azure-rest-api-specs/pull/${pullRequestNumber}.diff`,
  milestone: undefined,
  assignees: undefined
};

describe("SwaggerToSDK", function () {
  it("getPullRequest()", async function () {
    const github = new jsDevTools.RealGitHub();
    const pullRequest: jsDevTools.GitHubPullRequest = await github.getPullRequest("Azure/azure-rest-api-specs", pullRequestNumber);
    assert(pullRequest);
    assert(pullRequest.base);
    assert.strictEqual(pullRequest.base.label, "Azure:master");
    assert.strictEqual(pullRequest.base.ref, "master");
    assert.strictEqual(pullRequest.base.sha, "a4368ac83299657f35f105033353c2133db89176");
    assert(pullRequest.head);
    assert.strictEqual(pullRequest.head.label, "zikalino:fix-mysql");
    assert.strictEqual(pullRequest.head.ref, "fix-mysql");
    assert.strictEqual(pullRequest.head.sha, "a1d4df17cd05dd014bdc838e9304d393b414df2f");
    assert.strictEqual(pullRequest.merge_commit_sha, pullRequestMergeCommitSha);
    assert.strictEqual(pullRequest.id, pullRequestId);
    assert.strictEqual(pullRequest.number, pullRequestNumber);
    assert.strictEqual(pullRequest.state, "closed");
    assert.strictEqual(pullRequest.title, pullRequestTitle);
    assert.strictEqual(pullRequest.url, `https://api.github.com/repos/Azure/azure-rest-api-specs/pulls/${pullRequestNumber}`);
    assert.strictEqual(pullRequest.html_url, `https://github.com/Azure/azure-rest-api-specs/pull/${pullRequestNumber}`);
    assert.strictEqual(pullRequest.diff_url, `https://github.com/Azure/azure-rest-api-specs/pull/${pullRequestNumber}.diff`);
  });

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
              headers: new jsDevTools.HttpHeaders()
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
          `Received pull request change webhook request from GitHub for "https://github.com/Azure/azure-rest-api-specs/pull/${pullRequestNumber}".`,
          `Getting diff_url (https://github.com/Azure/azure-rest-api-specs/pull/${pullRequestNumber}.diff) contents...`,
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
              headers: new jsDevTools.HttpHeaders(),
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
          `Received pull request change webhook request from GitHub for "https://github.com/Azure/azure-rest-api-specs/pull/${pullRequestNumber}".`,
          `Getting diff_url (https://github.com/Azure/azure-rest-api-specs/pull/${pullRequestNumber}.diff) contents...`,
          `diff_url response status code is 200.`,
          `ERROR: diff_url response body is empty.`
        ]);
      });

      interface CreateEndToEndRunnerOptions {
        npm: string;
        autorest: string;
        rootPath: string;
        real: boolean;
      }

      function createEndToEndRunner(options: CreateEndToEndRunnerOptions): jsDevTools.Runner {
        let runner: jsDevTools.Runner;
        if (options.real) {
          runner = new jsDevTools.RealRunner();
        } else {
          const fakeRunner = new jsDevTools.FakeRunner();
          fakeRunner.set(`git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-python ${options.rootPath}${pullRequestNumber}/1/1`, { exitCode: 0 });
          fakeRunner.set(`git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-java ${options.rootPath}${pullRequestNumber}/1/1`, { exitCode: 0 });
          fakeRunner.set(`git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-go ${options.rootPath}${pullRequestNumber}/1/src/github.com/Azure/azure-sdk-for-go`, { exitCode: 0 });
          fakeRunner.set(`git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-node ${options.rootPath}${pullRequestNumber}/1/azure-sdk-for-node`, { exitCode: 0 });
          fakeRunner.set(`git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-js ${options.rootPath}${pullRequestNumber}/1/azure-sdk-for-js`, { exitCode: 0 });
          fakeRunner.set(`git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-ruby ${options.rootPath}${pullRequestNumber}/1/1`, { exitCode: 0 });
          fakeRunner.set(`${options.npm} install autorest`, { exitCode: 0 });
          fakeRunner.set(`${options.autorest} --version=preview --use=@microsoft.azure/autorest.python@~3.0.56 --python --python-mode=update --multiapi --python-sdks-folder=${options.rootPath}${pullRequestNumber}/1/1 https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`, { exitCode: 0 });
          fakeRunner.set(`${options.autorest} --java --verbose --multiapi --use=@microsoft.azure/autorest.java@2.1.85 --azure-libraries-for-java-folder=${options.rootPath}${pullRequestNumber}/1/1 https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`, { exitCode: 0 });
          fakeRunner.set(`${options.autorest} --use=@microsoft.azure/autorest.go@~2.1.127 --go --verbose --multiapi --use-onever --preview-chk --go-sdk-folder=${options.rootPath}${pullRequestNumber}/1/src/github.com/Azure/azure-sdk-for-go https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`, { exitCode: 0 });
          fakeRunner.set(`${options.autorest} --nodejs --license-header=MICROSOFT_MIT_NO_VERSION --use=@microsoft.azure/autorest.nodejs@2.2.131 --node-sdks-folder=${options.rootPath}${pullRequestNumber}/1/azure-sdk-for-node https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`, { exitCode: 0 });
          fakeRunner.set(`${options.autorest} --typescript --license-header=MICROSOFT_MIT_NO_VERSION --use=@microsoft.azure/autorest.typescript@2.1.1 --typescript-sdks-folder=${options.rootPath}${pullRequestNumber}/1/azure-sdk-for-js https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`, { exitCode: 0 });
          fakeRunner.set(`${options.autorest} --version=preview --use=@microsoft.azure/autorest.ruby@3.0.20 --ruby --multiapi --ruby-sdks-folder=${options.rootPath}${pullRequestNumber}/1/1 https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`, { exitCode: 0 });
          runner = fakeRunner;
        }
        return runner;
      }

      it("end-to-end", async function () {
        this.timeout(600000);
        const telemetry = new InMemoryTelemetry();
        const httpClient: jsDevTools.HttpClient = new jsDevTools.NodeHttpClient();
        const rootPath: string = jsDevTools.normalize(jsDevTools.getRootPath(process.cwd())!);
        const npm: string = npmExecutable();
        const autorest: string = jsDevTools.autorestExecutable({ autorestPath: "./node_modules/.bin/autorest" });
        const runner: jsDevTools.Runner = createEndToEndRunner({ real: false, npm, autorest, rootPath });
        const swaggerToSDK = new SwaggerToSDK({ telemetry, httpClient, runner });
        const webhookBody: jsDevTools.GitHubPullRequestWebhookBody = {
          action: "opened",
          number: 1,
          pull_request: pullRequest
        };
        await swaggerToSDK.pullRequestChange(webhookBody, { workingFolderPath: rootPath });
        assert.deepEqual(telemetry.logs, [
          `Received pull request change webhook request from GitHub for "https://github.com/Azure/azure-rest-api-specs/pull/${pullRequestNumber}".`,
          `Getting diff_url (https://github.com/Azure/azure-rest-api-specs/pull/${pullRequestNumber}.diff) contents...`,
          `diff_url response status code is 200.`,
          `diff_url response body contains 189 lines.`,
          `diff_url response body contains 5 "diff --git" lines.`,
          `diff_url response body contains 5 changed files:`,
          `specification/mysql/resource-manager/Microsoft.DBforMySQL/preview/2017-12-01-preview/examples/ServerCreate.json`,
          `specification/mysql/resource-manager/Microsoft.DBforMySQL/stable/2017-12-01/examples/ServerCreate.json`,
          `specification/mysql/resource-manager/Microsoft.DBforMySQL/stable/2017-12-01/examples/ServerCreateGeoRestoreMode.json`,
          `specification/mysql/resource-manager/Microsoft.DBforMySQL/stable/2017-12-01/examples/ServerCreatePointInTimeRestore.json`,
          `specification/mysql/resource-manager/Microsoft.DBforMySQL/stable/2017-12-01/examples/ServerCreateReplicaMode.json`,
          `diff_url response body contains 5 changed files in the specification folder:`,
          `specification/mysql/resource-manager/Microsoft.DBforMySQL/preview/2017-12-01-preview/examples/ServerCreate.json`,
          `specification/mysql/resource-manager/Microsoft.DBforMySQL/stable/2017-12-01/examples/ServerCreate.json`,
          `specification/mysql/resource-manager/Microsoft.DBforMySQL/stable/2017-12-01/examples/ServerCreateGeoRestoreMode.json`,
          `specification/mysql/resource-manager/Microsoft.DBforMySQL/stable/2017-12-01/examples/ServerCreatePointInTimeRestore.json`,
          `specification/mysql/resource-manager/Microsoft.DBforMySQL/stable/2017-12-01/examples/ServerCreateReplicaMode.json`,
          `Found 1 readme.md files to generate:`,
          `specification/mysql/resource-manager/readme.md`,
          `Looking for languages to generate in "specification/mysql/resource-manager/readme.md"...`,
          `Getting file contents for "https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md"...`,
          `Merged readme.md response status code is 200.`,
          `Found 5 requested SDK repositories:`,
          `azure-sdk-for-python`,
          `azure-sdk-for-java`,
          `azure-sdk-for-go`,
          `azure-sdk-for-js`,
          `azure-sdk-for-node`,
          `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-python ${rootPath}${pullRequestNumber}/1/1`,
          `${rootPath}${pullRequestNumber}/1/1: ${npm} install autorest`,
          `${rootPath}${pullRequestNumber}/1/1: ${autorest} --version=preview --use=@microsoft.azure/autorest.python@~3.0.56 --python --python-mode=update --multiapi --python-sdks-folder=${rootPath}${pullRequestNumber}/1/1 https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`,
          `Deleting clone of Azure/azure-sdk-for-python at folder ${rootPath}${pullRequestNumber}/1/1...`,
          `Finished deleting clone of Azure/azure-sdk-for-python at folder ${rootPath}${pullRequestNumber}/1/1.`,
          `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-java ${rootPath}${pullRequestNumber}/1/1`,
          `${rootPath}${pullRequestNumber}/1/1: ${npm} install autorest`,
          `${rootPath}${pullRequestNumber}/1/1: ${autorest} --java --verbose --multiapi --use=@microsoft.azure/autorest.java@2.1.85 --azure-libraries-for-java-folder=${rootPath}${pullRequestNumber}/1/1 https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`,
          `Deleting clone of Azure/azure-sdk-for-java at folder ${rootPath}${pullRequestNumber}/1/1...`,
          `Finished deleting clone of Azure/azure-sdk-for-java at folder ${rootPath}${pullRequestNumber}/1/1.`,
          `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-go ${rootPath}${pullRequestNumber}/1/src/github.com/Azure/azure-sdk-for-go`,
          `${rootPath}${pullRequestNumber}/1/src/github.com/Azure/azure-sdk-for-go: ${npm} install autorest`,
          `${rootPath}${pullRequestNumber}/1/src/github.com/Azure/azure-sdk-for-go: ${autorest} --use=@microsoft.azure/autorest.go@~2.1.127 --go --verbose --multiapi --use-onever --preview-chk --go-sdk-folder=${rootPath}${pullRequestNumber}/1/src/github.com/Azure/azure-sdk-for-go https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`,
          `Deleting clone of Azure/azure-sdk-for-go at folder ${rootPath}${pullRequestNumber}/1/src/github.com/Azure/azure-sdk-for-go...`,
          `Finished deleting clone of Azure/azure-sdk-for-go at folder ${rootPath}${pullRequestNumber}/1/src/github.com/Azure/azure-sdk-for-go.`,
          `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-js ${rootPath}${pullRequestNumber}/1/azure-sdk-for-js`,
          `${rootPath}${pullRequestNumber}/1/azure-sdk-for-js: ${npm} install autorest`,
          `${rootPath}${pullRequestNumber}/1/azure-sdk-for-js: ${autorest} --typescript --license-header=MICROSOFT_MIT_NO_VERSION --use=@microsoft.azure/autorest.typescript@2.1.1 --typescript-sdks-folder=${rootPath}${pullRequestNumber}/1/azure-sdk-for-js https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`,
          `Deleting clone of Azure/azure-sdk-for-js at folder ${rootPath}${pullRequestNumber}/1/azure-sdk-for-js...`,
          `Finished deleting clone of Azure/azure-sdk-for-js at folder ${rootPath}${pullRequestNumber}/1/azure-sdk-for-js.`,
          `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-node ${rootPath}${pullRequestNumber}/1/azure-sdk-for-node`,
          `${rootPath}${pullRequestNumber}/1/azure-sdk-for-node: ${npm} install autorest`,
          `${rootPath}${pullRequestNumber}/1/azure-sdk-for-node: ${autorest} --nodejs --license-header=MICROSOFT_MIT_NO_VERSION --use=@microsoft.azure/autorest.nodejs@2.2.131 --node-sdks-folder=${rootPath}${pullRequestNumber}/1/azure-sdk-for-node https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`,
          `Deleting clone of Azure/azure-sdk-for-node at folder ${rootPath}${pullRequestNumber}/1/azure-sdk-for-node...`,
          `Finished deleting clone of Azure/azure-sdk-for-node at folder ${rootPath}${pullRequestNumber}/1/azure-sdk-for-node.`,
          `Deleting generation instance folder ${rootPath}${pullRequestNumber}/1...`,
          `Finished deleting generation instance folder ${rootPath}${pullRequestNumber}/1.`
        ]);
      });
    });
  });
});
