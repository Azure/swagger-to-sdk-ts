import { assertEx, autorestExecutable, AzureBlobStorage, BlobPath, BlobStorage, BlobStorageBlob, BlobStoragePrefix, FakeRunner, getInMemoryLogger, getRootPath, GitHubCommit, GitHubPullRequest, GitHubPullRequestWebhookBody, HttpClient, HttpHeaders, HttpRequest, HttpResponse, InMemoryBlobStorage, InMemoryLogger, NodeHttpClient, normalize, npmExecutable, RealGitHub, RealRunner, Runner, getParentFolderPath, deleteFolder } from "@ts-common/azure-js-dev-tools";
import { assert } from "chai";
import { allLogsName, SwaggerToSDK, getWorkingFolderPath } from "../lib/swaggerToSDK";

const baseCommit: GitHubCommit = {
  label: "Azure:master",
  ref: "master",
  sha: "1b8809ee779437bc13f9af9373a5d47472a6b889"
};

const headCommit: GitHubCommit = {
  label: "pixia:master",
  ref: "master",
  sha: "d82d1491879729cdf44da9a664e815112acde158"
};

const pullRequestMergeCommitSha = "5d204450e3ea6709a034208af441ebaaa87bd805";
const pullRequestId = 242467286;
const pullRequestNumber = 4994;
const pullRequestTitle = "Fix mysql sku values";

const pullRequest: GitHubPullRequest = {
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

let testCount = 0;
function getWorkingPrefix(blobStorage: BlobStorage): BlobStoragePrefix {
  return blobStorage.getPrefix(new BlobPath(`abc${++testCount}`, ""));
}

describe("SwaggerToSDK", function () {
  it("getPullRequest()", async function () {
    const github = new RealGitHub();
    const pullRequest: GitHubPullRequest = await github.getPullRequest("Azure/azure-rest-api-specs", pullRequestNumber);
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
    it("with no options", function () {
      const blobStorage = new InMemoryBlobStorage();
      const workingPrefix: BlobStoragePrefix = getWorkingPrefix(blobStorage);
      const swaggerToSDK = new SwaggerToSDK(workingPrefix);
      assert.strictEqual(swaggerToSDK.workingPrefix, workingPrefix);
      assert.strictEqual(swaggerToSDK.logger, undefined);
      assert(swaggerToSDK.httpClient instanceof NodeHttpClient);
    });

    it("with undefined options argument", function () {
      const blobStorage = new InMemoryBlobStorage();
      const workingPrefix: BlobStoragePrefix = getWorkingPrefix(blobStorage);
      const swaggerToSDK = new SwaggerToSDK(workingPrefix, undefined);
      assert.strictEqual(swaggerToSDK.workingPrefix, workingPrefix);
      assert.strictEqual(swaggerToSDK.logger, undefined);
      assert(swaggerToSDK.httpClient instanceof NodeHttpClient);
    });

    it("with telemetry argument", function () {
      const blobStorage = new InMemoryBlobStorage();
      const workingPrefix: BlobStoragePrefix = getWorkingPrefix(blobStorage);
      const logger: InMemoryLogger = getInMemoryLogger();
      const swaggerToSDK = new SwaggerToSDK(workingPrefix, { logger });
      assert.strictEqual(swaggerToSDK.workingPrefix, workingPrefix);
      assert.strictEqual(swaggerToSDK.logger, logger);
      assert(swaggerToSDK.httpClient instanceof NodeHttpClient);
    });

    it("with httpClient argument", function () {
      const blobStorage = new InMemoryBlobStorage();
      const workingPrefix: BlobStoragePrefix = getWorkingPrefix(blobStorage);
      const httpClient = new NodeHttpClient();
      const swaggerToSDK = new SwaggerToSDK(workingPrefix, { httpClient });
      assert.strictEqual(swaggerToSDK.workingPrefix, workingPrefix);
      assert.strictEqual(swaggerToSDK.logger, undefined);
      assert.strictEqual(swaggerToSDK.httpClient, httpClient);
    });
  });

  describe("pullRequestChange()", function () {
    describe("pull request created", function () {
      it("when diff_url returns 404", async function () {
        const rootPath: string = normalize(process.cwd());
        const blobStorage = new InMemoryBlobStorage();
        const workingPrefix: BlobStoragePrefix = getWorkingPrefix(blobStorage);
        const logger: InMemoryLogger = getInMemoryLogger();
        const httpClient: HttpClient = {
          sendRequest(request: HttpRequest): Promise<HttpResponse> {
            return Promise.resolve({
              request,
              statusCode: 404,
              headers: new HttpHeaders()
            });
          }
        };
        const swaggerToSDK = new SwaggerToSDK(workingPrefix, { logger, httpClient });
        const webhookBody: GitHubPullRequestWebhookBody = {
          action: "opened",
          number: 1,
          pull_request: pullRequest
        };

        await swaggerToSDK.pullRequestChange(webhookBody, { workingFolderPath: rootPath });

        assert.deepEqual(logger.allLogs, [
          `Received pull request change webhook request from GitHub for "https://github.com/Azure/azure-rest-api-specs/pull/${pullRequestNumber}".`,
          `Getting diff_url (https://github.com/Azure/azure-rest-api-specs/pull/${pullRequestNumber}.diff) contents...`,
          `diff_url response status code is 404.`,
          `Deleting working folder ${rootPath}/1...`,
          `Finished deleting working folder ${rootPath}/1.`
        ]);
      });

      it("when diff_url returns empty body", async function () {
        const rootPath: string = normalize(process.cwd());
        const blobStorage = new InMemoryBlobStorage();
        const workingPrefix: BlobStoragePrefix = getWorkingPrefix(blobStorage);
        const logger: InMemoryLogger = getInMemoryLogger();
        const httpClient: HttpClient = {
          sendRequest(request: HttpRequest): Promise<HttpResponse> {
            return Promise.resolve({
              request,
              statusCode: 200,
              headers: new HttpHeaders(),
              body: ""
            });
          }
        };
        const swaggerToSDK = new SwaggerToSDK(workingPrefix, { logger, httpClient });
        const webhookBody: GitHubPullRequestWebhookBody = {
          action: "opened",
          number: 1,
          pull_request: pullRequest
        };

        await swaggerToSDK.pullRequestChange(webhookBody, { workingFolderPath: rootPath });

        assert.deepEqual(logger.allLogs, [
          `Received pull request change webhook request from GitHub for "https://github.com/Azure/azure-rest-api-specs/pull/${pullRequestNumber}".`,
          `Getting diff_url (https://github.com/Azure/azure-rest-api-specs/pull/${pullRequestNumber}.diff) contents...`,
          `diff_url response status code is 200.`,
          `diff_url response body is empty.`,
          `Deleting working folder ${rootPath}/1...`,
          `Finished deleting working folder ${rootPath}/1.`
        ]);
      });

      function createEndToEndBlobStorage(real?: boolean): BlobStorage {
        return real
          ? new AzureBlobStorage(`azure storage account SAS URL`)
          : new InMemoryBlobStorage();
      }

      function createEndToEndHttpClient(): HttpClient {
        return new NodeHttpClient();
      }

      interface CreateEndToEndRunnerOptions {
        npm: string;
        autorest: string;
        baseWorkingFolderPath: string;
        real: boolean;
      }

      function createEndToEndRunner(options: CreateEndToEndRunnerOptions): Runner {
        let runner: Runner;
        if (options.real) {
          runner = new RealRunner();
        } else {
          const fakeRunner = new FakeRunner();
          fakeRunner.set(`git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-python ${options.baseWorkingFolderPath}1/1`, { exitCode: 0 });
          fakeRunner.set(`git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-java ${options.baseWorkingFolderPath}1/1`, { exitCode: 0 });
          fakeRunner.set(`git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-go ${options.baseWorkingFolderPath}1/src/github.com/Azure/azure-sdk-for-go`, { exitCode: 0 });
          fakeRunner.set(`git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-node ${options.baseWorkingFolderPath}1/azure-sdk-for-node`, { exitCode: 0 });
          fakeRunner.set(`git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-js ${options.baseWorkingFolderPath}1/azure-sdk-for-js`, { exitCode: 0 });
          fakeRunner.set(`git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-ruby ${options.baseWorkingFolderPath}1/1`, { exitCode: 0 });
          fakeRunner.set(`${options.npm} install autorest`, { exitCode: 0 });
          fakeRunner.set(`${options.autorest} --version=preview --use=@microsoft.azure/autorest.python@~3.0.56 --python --python-mode=update --multiapi --python-sdks-folder=${options.baseWorkingFolderPath}1/1 https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`, { exitCode: 0 });
          fakeRunner.set(`${options.autorest} --java --verbose --multiapi --use=@microsoft.azure/autorest.java@2.1.85 --azure-libraries-for-java-folder=${options.baseWorkingFolderPath}1/1 https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`, { exitCode: 0 });
          fakeRunner.set(`${options.autorest} --use=@microsoft.azure/autorest.go@~2.1.127 --go --verbose --multiapi --use-onever --preview-chk --go-sdk-folder=${options.baseWorkingFolderPath}1/src/github.com/Azure/azure-sdk-for-go https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`, { exitCode: 0 });
          fakeRunner.set(`${options.autorest} --nodejs --license-header=MICROSOFT_MIT_NO_VERSION --use=@microsoft.azure/autorest.nodejs@2.2.131 --node-sdks-folder=${options.baseWorkingFolderPath}1/azure-sdk-for-node https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`, { exitCode: 0 });
          fakeRunner.set(`${options.autorest} --typescript --license-header=MICROSOFT_MIT_NO_VERSION --use=@microsoft.azure/autorest.typescript@2.1.1 --typescript-sdks-folder=${options.baseWorkingFolderPath}1/azure-sdk-for-js https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`, { exitCode: 0 });
          fakeRunner.set(`${options.autorest} --version=preview --use=@microsoft.azure/autorest.ruby@3.0.20 --ruby --multiapi --ruby-sdks-folder=${options.baseWorkingFolderPath}1/1 https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`, { exitCode: 0 });
          fakeRunner.set(`git status`, { exitCode: 0 });
          runner = fakeRunner;
        }
        return runner;
      }

      it("end-to-end", async function () {
        this.timeout(600000);
        const real = false;
        const blobStorage: BlobStorage = createEndToEndBlobStorage(false);
        const workingPrefix: BlobStoragePrefix = getWorkingPrefix(blobStorage);
        try {
          const logger: InMemoryLogger = getInMemoryLogger();
          const httpClient: HttpClient = createEndToEndHttpClient();
          const workingFolderPath: string = await getWorkingFolderPath(getRootPath(process.cwd())!);
          await deleteFolder(workingFolderPath);
          const baseWorkingFolderPath: string = getParentFolderPath(workingFolderPath);
          const npm: string = npmExecutable();
          const autorest: string = autorestExecutable({ autorestPath: "./node_modules/.bin/autorest" });
          const runner: Runner = createEndToEndRunner({ real, npm, autorest, baseWorkingFolderPath });
          const swaggerToSDK = new SwaggerToSDK(workingPrefix, { logger, httpClient, runner });
          const webhookBody: GitHubPullRequestWebhookBody = {
            action: "opened",
            number: 1,
            pull_request: pullRequest
          };

          await swaggerToSDK.pullRequestChange(webhookBody, { workingFolderPath: baseWorkingFolderPath });

          assert.strictEqual(await workingPrefix.getContainer().exists(), true);
          const allLogsBlob: BlobStorageBlob = workingPrefix.getBlob(`Azure/azure-rest-api-specs/${pullRequest.number}/1/${allLogsName}`);
          const javaLogsBlob: BlobStorageBlob = workingPrefix.getBlob(`Azure/azure-rest-api-specs/${pullRequest.number}/1/azure.azure-sdk-for-java.logs.html`);
          assert.strictEqual(await allLogsBlob.exists(), true);

          const expectedLogs: string[] = [
            `Received pull request change webhook request from GitHub for "https://github.com/Azure/azure-rest-api-specs/pull/${pullRequestNumber}".`,
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
            `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-python ${baseWorkingFolderPath}1/1`,
            `${baseWorkingFolderPath}1/1: ${npm} install autorest`,
            `${baseWorkingFolderPath}1/1: ${autorest} --version=preview --use=@microsoft.azure/autorest.python@~3.0.56 --python --python-mode=update --multiapi --python-sdks-folder=${baseWorkingFolderPath}1/1 https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`,
            `${baseWorkingFolderPath}1/1: git status`,
            `Deleting clone of Azure/azure-sdk-for-python at folder ${baseWorkingFolderPath}1/1...`,
            `Finished deleting clone of Azure/azure-sdk-for-python at folder ${baseWorkingFolderPath}1/1.`,
            `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-java ${baseWorkingFolderPath}1/1`,
            `${baseWorkingFolderPath}1/1: ${npm} install autorest`,
            `${baseWorkingFolderPath}1/1: ${autorest} --java --verbose --multiapi --use=@microsoft.azure/autorest.java@2.1.85 --azure-libraries-for-java-folder=${baseWorkingFolderPath}1/1 https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`,
            `Deleting clone of Azure/azure-sdk-for-java at folder ${baseWorkingFolderPath}1/1...`,
            `Finished deleting clone of Azure/azure-sdk-for-java at folder ${baseWorkingFolderPath}1/1.`,
            `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-go ${baseWorkingFolderPath}1/src/github.com/Azure/azure-sdk-for-go`,
            `${baseWorkingFolderPath}1/src/github.com/Azure/azure-sdk-for-go: ${npm} install autorest`,
            `${baseWorkingFolderPath}1/src/github.com/Azure/azure-sdk-for-go: ${autorest} --use=@microsoft.azure/autorest.go@~2.1.127 --go --verbose --multiapi --use-onever --preview-chk --go-sdk-folder=${baseWorkingFolderPath}1/src/github.com/Azure/azure-sdk-for-go https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`,
            `Deleting clone of Azure/azure-sdk-for-go at folder ${baseWorkingFolderPath}1/src/github.com/Azure/azure-sdk-for-go...`,
            `Finished deleting clone of Azure/azure-sdk-for-go at folder ${baseWorkingFolderPath}1/src/github.com/Azure/azure-sdk-for-go.`,
            `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-js ${baseWorkingFolderPath}1/azure-sdk-for-js`,
            `${baseWorkingFolderPath}1/azure-sdk-for-js: ${npm} install autorest`,
            `${baseWorkingFolderPath}1/azure-sdk-for-js: ${autorest} --typescript --license-header=MICROSOFT_MIT_NO_VERSION --use=@microsoft.azure/autorest.typescript@2.1.1 --typescript-sdks-folder=${baseWorkingFolderPath}1/azure-sdk-for-js https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`,
            `Deleting clone of Azure/azure-sdk-for-js at folder ${baseWorkingFolderPath}1/azure-sdk-for-js...`,
            `Finished deleting clone of Azure/azure-sdk-for-js at folder ${baseWorkingFolderPath}1/azure-sdk-for-js.`,
            `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-node ${baseWorkingFolderPath}1/azure-sdk-for-node`,
            `${baseWorkingFolderPath}1/azure-sdk-for-node: ${npm} install autorest`,
            `${baseWorkingFolderPath}1/azure-sdk-for-node: ${autorest} --nodejs --license-header=MICROSOFT_MIT_NO_VERSION --use=@microsoft.azure/autorest.nodejs@2.2.131 --node-sdks-folder=${baseWorkingFolderPath}1/azure-sdk-for-node https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`,
            `Deleting clone of Azure/azure-sdk-for-node at folder ${baseWorkingFolderPath}1/azure-sdk-for-node...`,
            `Finished deleting clone of Azure/azure-sdk-for-node at folder ${baseWorkingFolderPath}1/azure-sdk-for-node.`,
            `Deleting working folder ${baseWorkingFolderPath}1...`,
            `Finished deleting working folder ${baseWorkingFolderPath}1.`
          ];
          assertEx.containsAll(logger.allLogs, expectedLogs);
          assertEx.containsAll(await allLogsBlob.getContentsAsString(), expectedLogs);
          assertEx.containsAll(await javaLogsBlob.getContentsAsString(), [
            `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-java ${baseWorkingFolderPath}1/1`,
            `${baseWorkingFolderPath}1/1: ${npm} install autorest`,
            `${baseWorkingFolderPath}1/1: ${autorest} --java --verbose --multiapi --use=@microsoft.azure/autorest.java@2.1.85 --azure-libraries-for-java-folder=${baseWorkingFolderPath}1/1 https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`,
            `Deleting clone of Azure/azure-sdk-for-java at folder ${baseWorkingFolderPath}1/1...`,
          ]);
        } finally {
          await workingPrefix.getContainer().delete();
        }
      });
    });
  });
});
