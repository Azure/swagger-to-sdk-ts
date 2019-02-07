import { ArchiverCompressor, assertEx, autorestExecutable, AzureBlobStorage, BlobPath, BlobStorage, BlobStorageBlob, BlobStoragePrefix, Compressor, createFolder, deleteFolder, FakeCompressor, FakeRunner, getInMemoryLogger, getParentFolderPath, getRootPath, GitHubCommit, GitHubPullRequest, GitHubPullRequestWebhookBody, HttpClient, HttpHeaders, HttpRequest, HttpResponse, InMemoryBlobStorage, InMemoryLogger, joinPath, NodeHttpClient, normalize, npmExecutable, RealGitHub, RealRunner, Runner, writeFileContents, URLBuilder } from "@ts-common/azure-js-dev-tools";
import { getLines } from "@ts-common/azure-js-dev-tools/dist/lib/common";
import { assert } from "chai";
import { logsFileName, getWorkingFolderPath, SwaggerToSDK } from "../lib/swaggerToSDK";

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

      it("end-to-end", async function () {
        this.timeout(600000);

        const deleteContainer = true;
        const real = false;
        const realStorageUrl = `https://autosdkstorage.blob.core.windows.net/?sv=2018-03-28&ss=bfqt&srt=sco&sp=rwdlacup&se=2019-02-08T04:51:46Z&st=2019-02-07T20:51:46Z&spr=https&sig=AxUugZSuDCmHm9KI7jaFMqaSsByFwSUR%2BESqVas475w%3D`;

        const blobStorage: BlobStorage = createEndToEndBlobStorage(real, realStorageUrl);
        const workingPrefix: BlobStoragePrefix = getWorkingPrefix(blobStorage);
        try {
          const logger: InMemoryLogger = getInMemoryLogger();
          const compressorCreator: () => Compressor = createEndToEndCompressorCreator(real);
          const httpClient: HttpClient = createEndToEndHttpClient();
          const workingFolderPath: string = await getWorkingFolderPath(getRootPath(process.cwd())!);
          await deleteFolder(workingFolderPath);
          const baseWorkingFolderPath: string = getParentFolderPath(workingFolderPath);
          const pythonFolderPath: string = joinPath(baseWorkingFolderPath, "1/1");
          const javaFolderPath: string = joinPath(baseWorkingFolderPath, "1/2");
          const goFolderPath: string = joinPath(baseWorkingFolderPath, "1/src/github.com/Azure/azure-sdk-for-go");
          const nodeFolderPath: string = joinPath(baseWorkingFolderPath, "1/azure-sdk-for-node");
          const jsFolderPath: string = joinPath(baseWorkingFolderPath, "1/azure-sdk-for-js");
          const npm: string = npmExecutable();
          const autorest: string = autorestExecutable({ autorestPath: "./node_modules/.bin/autorest" });
          const runner: Runner = createEndToEndRunner({ real, npm, autorest, baseWorkingFolderPath });
          const swaggerToSDK = new SwaggerToSDK(workingPrefix, { logger, httpClient, runner, compressorCreator });
          const webhookBody: GitHubPullRequestWebhookBody = {
            action: "opened",
            number: 1,
            pull_request: pullRequest
          };
          const uploadClonedRepositories: boolean = !real;

          await swaggerToSDK.pullRequestChange(webhookBody, {
            workingFolderPath: baseWorkingFolderPath,
            deleteClonedRepositories: true,
            uploadClonedRepositories
          });

          assert.strictEqual(await workingPrefix.getContainer().exists(), true);

          const generationInstancePrefix: BlobStoragePrefix = workingPrefix.getPrefix(`Azure/azure-rest-api-specs/${pullRequest.number}/1/`);

          const allLogsBlob: BlobStorageBlob = generationInstancePrefix.getBlob(logsFileName);
          assert.strictEqual(await allLogsBlob.exists(), true);
          assert.strictEqual(await allLogsBlob.getContentType(), "text/plain");
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
            `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-python ${pythonFolderPath}`,
            `${pythonFolderPath}: ${npm} install autorest`,
            `${pythonFolderPath}: ${autorest} --version=preview --use=@microsoft.azure/autorest.python@~3.0.56 --python --python-mode=update --multiapi --python-sdks-folder=${joinPath(baseWorkingFolderPath, "1/1")} https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`,
            `${pythonFolderPath}: git status`,
            `Deleting clone of Azure/azure-sdk-for-python at folder ${pythonFolderPath}...`,
            `Finished deleting clone of Azure/azure-sdk-for-python at folder ${pythonFolderPath}.`,
            `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-java ${javaFolderPath}`,
            `${javaFolderPath}: ${npm} install autorest`,
            `${javaFolderPath}: ${autorest} --java --verbose --multiapi --use=@microsoft.azure/autorest.java@2.1.85 --azure-libraries-for-java-folder=${javaFolderPath} https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`,
            `Deleting clone of Azure/azure-sdk-for-java at folder ${javaFolderPath}...`,
            `Finished deleting clone of Azure/azure-sdk-for-java at folder ${javaFolderPath}.`,
            `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-go ${goFolderPath}`,
            `${goFolderPath}: ${npm} install autorest`,
            `${goFolderPath}: ${autorest} --use=@microsoft.azure/autorest.go@~2.1.127 --go --verbose --multiapi --use-onever --preview-chk --go-sdk-folder=${goFolderPath} https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`,
            `Deleting clone of Azure/azure-sdk-for-go at folder ${goFolderPath}...`,
            `Finished deleting clone of Azure/azure-sdk-for-go at folder ${goFolderPath}.`,
            `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-js ${jsFolderPath}`,
            `${jsFolderPath}: ${npm} install autorest`,
            `${jsFolderPath}: ${autorest} --typescript --license-header=MICROSOFT_MIT_NO_VERSION --use=@microsoft.azure/autorest.typescript@2.1.1 --typescript-sdks-folder=${jsFolderPath} https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`,
            `Deleting clone of Azure/azure-sdk-for-js at folder ${jsFolderPath}...`,
            `Finished deleting clone of Azure/azure-sdk-for-js at folder ${jsFolderPath}.`,
            `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-node ${nodeFolderPath}`,
            `${nodeFolderPath}: ${npm} install autorest`,
            `${nodeFolderPath}: ${autorest} --nodejs --license-header=MICROSOFT_MIT_NO_VERSION --use=@microsoft.azure/autorest.nodejs@2.2.131 --node-sdks-folder=${nodeFolderPath} https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`,
            `Deleting clone of Azure/azure-sdk-for-node at folder ${nodeFolderPath}...`,
            `Finished deleting clone of Azure/azure-sdk-for-node at folder ${nodeFolderPath}.`,
            `Deleting working folder ${joinPath(baseWorkingFolderPath, "1")}...`,
            `Finished deleting working folder ${joinPath(baseWorkingFolderPath, "1")}.`
          ];
          assertEx.containsAll(getLines(await allLogsBlob.getContentsAsString()), expectedLogs);
          assertEx.containsAll(logger.allLogs, expectedLogs);

          const javaScriptLogsBlob: BlobStorageBlob = generationInstancePrefix.getBlob("Azure/azure-sdk-for-js/logs.txt");
          assert.strictEqual(await javaScriptLogsBlob.exists(), true);
          assert.strictEqual(await javaScriptLogsBlob.getContentType(), "text/plain");
          const javaScriptLogs: string[] = getLines(await javaScriptLogsBlob.getContentsAsString());
          const javaScriptPackageUrl: URLBuilder = URLBuilder.parse(blobStorage.getBlobURL("abc7/Azure/azure-rest-api-specs/4994/1/Azure/azure-sdk-for-js/azure-arm-mysql-3.2.0.tgz"));
          javaScriptPackageUrl.setQuery(undefined);
          assertEx.containsAll(javaScriptLogs, [
            `The following files were modified:`,
            `  ${joinPath(jsFolderPath, "packages/@azure/arm-mysql/LICENSE.txt")}`,
            `  ${joinPath(jsFolderPath, "packages/@azure/arm-mysql/README.md")}`,
            `  ${joinPath(jsFolderPath, "packages/@azure/arm-mysql/lib/models/checkNameAvailabilityMappers.ts")}`,
            `  ${joinPath(jsFolderPath, "packages/@azure/arm-mysql/lib/models/configurationsMappers.ts")}`,
            `Repository Azure/azure-sdk-for-js matches programming language JavaScript.`,
            `Found 1 package folder that changed:`,
            `  ${joinPath(jsFolderPath, "packages/@azure/arm-mysql")}`,
            `Found 1 package file in ${joinPath(jsFolderPath, "packages/@azure/arm-mysql")}:`,
            `  ${joinPath(jsFolderPath, "packages/@azure/arm-mysql/azure-arm-mysql-3.2.0.tgz")}`,
            `Uploading ${joinPath(jsFolderPath, "packages/@azure/arm-mysql/azure-arm-mysql-3.2.0.tgz")} to ${javaScriptPackageUrl.toString()}...`
          ]);

          const javaLogsBlob: BlobStorageBlob = generationInstancePrefix.getBlob("Azure/azure-sdk-for-java/logs.txt");
          assert.strictEqual(await javaLogsBlob.exists(), true);
          assert.strictEqual(await javaLogsBlob.getContentType(), "text/plain");
          assertEx.containsAll(getLines(await javaLogsBlob.getContentsAsString()), [
            `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-java ${javaFolderPath}`,
            `${javaFolderPath}: ${npm} install autorest`,
            `${javaFolderPath}: ${autorest} --java --verbose --multiapi --use=@microsoft.azure/autorest.java@2.1.85 --azure-libraries-for-java-folder=${javaFolderPath} https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md`,
            `Deleting clone of Azure/azure-sdk-for-java at folder ${javaFolderPath}...`,
            `Repository Azure/azure-sdk-for-java matches programming language Java.`,
            `Found 1 package folder that changed:`,
            `  ${joinPath(javaFolderPath, "mysql/resource-manager/v2017_12_01")}`,
            `Java has no registered package commands.`
          ]);

          const pythonLogsBlob: BlobStorageBlob = generationInstancePrefix.getBlob("Azure/azure-sdk-for-python/logs.txt");
          assert.strictEqual(await pythonLogsBlob.exists(), true);
          assert.strictEqual(await pythonLogsBlob.getContentType(), "text/plain");
          assertEx.containsAll(getLines(await pythonLogsBlob.getContentsAsString()), [
            `Repository Azure/azure-sdk-for-python matches programming language Python.`,
            `Found 1 package folder that changed:`,
            `  ${joinPath(pythonFolderPath, "azure-mgmt-rdbms")}`,
            `Deleting clone of Azure/azure-sdk-for-python at folder ${pythonFolderPath}...`,
            `Finished deleting clone of Azure/azure-sdk-for-python at folder ${pythonFolderPath}.`,
            `Python has no registered package commands.`
          ]);

          const nodeLogsBlob: BlobStorageBlob = generationInstancePrefix.getBlob("Azure/azure-sdk-for-node/logs.txt");
          assert.strictEqual(await nodeLogsBlob.exists(), true);
          assert.strictEqual(await nodeLogsBlob.getContentType(), "text/plain");
          const nodePackageUrl: URLBuilder = URLBuilder.parse(blobStorage.getBlobURL("abc7/Azure/azure-rest-api-specs/4994/1/Azure/azure-sdk-for-node/azure-arm-mysql-3.2.0.tgz"));
          nodePackageUrl.setQuery(undefined);
          const nodeLogs: string[] = getLines(await nodeLogsBlob.getContentsAsString());
          assertEx.containsAll(nodeLogs, [
            `Repository Azure/azure-sdk-for-node matches programming language JavaScript.`,
            `Found 1 package folder that changed:`,
            `  ${joinPath(nodeFolderPath, "lib/services/mysqlManagement")}`,
            `Found 1 package file in ${joinPath(nodeFolderPath, "lib/services/mysqlManagement")}:`,
            `  ${joinPath(nodeFolderPath, "lib/services/mysqlManagement/azure-arm-mysql-3.2.0.tgz")}`,
            `Uploading ${joinPath(nodeFolderPath, "lib/services/mysqlManagement/azure-arm-mysql-3.2.0.tgz")} to ${nodePackageUrl.toString()}...`
          ]);

          const goLogsBlob: BlobStorageBlob = generationInstancePrefix.getBlob("Azure/azure-sdk-for-go/logs.txt");
          assert.strictEqual(await goLogsBlob.exists(), true);
          assert.strictEqual(await goLogsBlob.getContentType(), "text/plain");
          assertEx.containsAll(getLines(await goLogsBlob.getContentsAsString()), [
            `Repository Azure/azure-sdk-for-go matches programming language Go.`,
            `No packageRootFileName property has been specified in the language configuration for Go.`
          ]);

          assert.strictEqual(await generationInstancePrefix.blobExists("Azure/azure-sdk-for-js/azure.azure-sdk-for-js.zip"), uploadClonedRepositories);
          assert.strictEqual(await generationInstancePrefix.blobExists("Azure/azure-sdk-for-java/azure.azure-sdk-for-java.zip"), uploadClonedRepositories);
          assert.strictEqual(await generationInstancePrefix.blobExists("Azure/azure-sdk-for-python/azure.azure-sdk-for-python.zip"), uploadClonedRepositories);
          assert.strictEqual(await generationInstancePrefix.blobExists("Azure/azure-sdk-for-node/azure.azure-sdk-for-node.zip"), uploadClonedRepositories);
          assert.strictEqual(await generationInstancePrefix.blobExists("Azure/azure-sdk-for-go/azure.azure-sdk-for-go.zip"), uploadClonedRepositories);

          assert.strictEqual(await generationInstancePrefix.blobExists("Azure/azure-sdk-for-js/azure-arm-mysql-3.2.0.tgz"), true);
          assert.strictEqual(await generationInstancePrefix.blobExists("Azure/azure-sdk-for-node/azure-arm-mysql-3.2.0.tgz"), true);
        } finally {
          if (deleteContainer) {
            await workingPrefix.getContainer().delete();
          }
        }
      });
    });
  });
});

function createEndToEndBlobStorage(real: boolean, realStorageUrl: string): BlobStorage {
  return real
    ? new AzureBlobStorage(realStorageUrl)
    : new InMemoryBlobStorage();
}

function createEndToEndCompressorCreator(real?: boolean): () => Compressor {
  return real
    ? () => new ArchiverCompressor()
    : () => new FakeCompressor();
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
  const rootPath: string = options.baseWorkingFolderPath;
  const pythonFolderPath: string = joinPath(rootPath, "1/1");
  const javaFolderPath: string = joinPath(rootPath, "1/2");
  const goFolderPath: string = joinPath(rootPath, "1/src/github.com/Azure/azure-sdk-for-go");
  const nodeFolderPath: string = joinPath(rootPath, "1/azure-sdk-for-node");
  const jsFolderPath: string = joinPath(rootPath, "1/azure-sdk-for-js");
  const rubyFolderPath: string = joinPath(rootPath, "1/6");
  let runner: Runner;
  if (options.real) {
    runner = new RealRunner();
  } else {
    const fakeRunner = new FakeRunner();
    fakeRunner.set({
      command: `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-python ${pythonFolderPath}`,
      result: async () => {
        const packageFolderPath: string = joinPath(pythonFolderPath, "azure-mgmt-rdbms");
        await createFolder(packageFolderPath);
        await writeFileContents(joinPath(packageFolderPath, "setup.py"), "");
        return { exitCode: 0 };
      }
    });
    fakeRunner.set({
      command: `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-java ${javaFolderPath}`,
      result: async () => {
        const packageFolderPath: string = joinPath(javaFolderPath, "mysql/resource-manager/v2017_12_01");
        await createFolder(packageFolderPath);
        await writeFileContents(joinPath(packageFolderPath, "pom.xml"), "");
        return { exitCode: 0 };
      }
    });
    fakeRunner.set({
      command: `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-go ${goFolderPath}`,
      result: async () => {
        const packageFolderPath: string = joinPath(goFolderPath, "services/mysql/mgmt/2017-12-01/mysql");
        await createFolder(packageFolderPath);
        await writeFileContents(joinPath(packageFolderPath, "client.go"), "");
        return { exitCode: 0 };
      }
    });
    fakeRunner.set({
      command: `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-node ${nodeFolderPath}`,
      result: async () => {
        const packageFolderPath: string = joinPath(nodeFolderPath, "lib/services/mysqlManagement");
        await createFolder(packageFolderPath);
        await writeFileContents(joinPath(packageFolderPath, "package.json"), "{}");
        return { exitCode: 0 };
      }
    });
    fakeRunner.set({
      command: `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-js ${jsFolderPath}`,
      result: async () => {
        const packageFolderPath: string = joinPath(jsFolderPath, "packages/@azure/arm-mysql");
        await createFolder(packageFolderPath);
        await writeFileContents(joinPath(packageFolderPath, "package.json"), "{}");
        return { exitCode: 0 };
      }
    });
    fakeRunner.set({ command: `git clone --quiet --depth 1 https://github.com/Azure/azure-sdk-for-ruby ${rubyFolderPath}` });
    fakeRunner.set({ command: `${options.npm} install autorest` });
    fakeRunner.set({ command: `${options.autorest} --version=preview --use=@microsoft.azure/autorest.python@~3.0.56 --python --python-mode=update --multiapi --python-sdks-folder=${pythonFolderPath} https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md` });
    fakeRunner.set({ command: `${options.autorest} --java --verbose --multiapi --use=@microsoft.azure/autorest.java@2.1.85 --azure-libraries-for-java-folder=${javaFolderPath} https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md` });
    fakeRunner.set({ command: `${options.autorest} --use=@microsoft.azure/autorest.go@~2.1.127 --go --verbose --multiapi --use-onever --preview-chk --go-sdk-folder=${goFolderPath} https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md` });
    fakeRunner.set({ command: `${options.autorest} --nodejs --license-header=MICROSOFT_MIT_NO_VERSION --use=@microsoft.azure/autorest.nodejs@2.2.131 --node-sdks-folder=${nodeFolderPath} https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md` });
    fakeRunner.set({ command: `${options.autorest} --typescript --license-header=MICROSOFT_MIT_NO_VERSION --use=@microsoft.azure/autorest.typescript@2.1.1 --typescript-sdks-folder=${jsFolderPath} https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md` });
    fakeRunner.set({ command: `${options.autorest} --version=preview --use=@microsoft.azure/autorest.ruby@3.0.20 --ruby --multiapi --ruby-sdks-folder=${rubyFolderPath} https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md` });
    fakeRunner.set({ command: `git checkout package.json` });
    fakeRunner.set({
      command: `git status`, executionFolderPath: goFolderPath,
      result: {
        exitCode: 0,
        stdout:
          `On branch master
Your branch is up to date with 'origin/master'.

Changes not staged for commit:
(use "git add <file>..." to update what will be committed)
(use "git checkout -- <file>..." to discard changes in working directory)

modified:   services/mysql/mgmt/2017-12-01/mysql/locationbasedperformancetier.go`
      }
    });
    fakeRunner.set({
      command: `git status`, executionFolderPath: nodeFolderPath,
      result: {
        exitCode: 0,
        stdout:
          `On branch master
Your branch is up to date with 'origin/master'.

Changes not staged for commit:
(use "git add <file>..." to update what will be committed)
(use "git checkout -- <file>..." to discard changes in working directory)

modified:   lib/services/mysqlManagement/lib/models/firewallRuleListResult.js`
      }
    });
    fakeRunner.set({
      command: `git status`, executionFolderPath: pythonFolderPath,
      result: {
        exitCode: 0,
        stdout:
          `On branch master
Your branch is up to date with 'origin/master'.

Changes not staged for commit:
(use "git add <file>..." to update what will be committed)
(use "git checkout -- <file>..." to discard changes in working directory)

modified:   azure-mgmt-rdbms/azure/mgmt/rdbms/mysql/models/configuration.py`
      }
    });
    fakeRunner.set({
      command: `git status`, executionFolderPath: jsFolderPath,
      result: {
        exitCode: 0,
        stdout:
          `On branch master
Your branch is up to date with 'origin/master'.

Changes not staged for commit:
(use "git add <file>..." to update what will be committed)
(use "git checkout -- <file>..." to discard changes in working directory)

modified:   packages/@azure/arm-mysql/LICENSE.txt
modified:   packages/@azure/arm-mysql/README.md
modified:   packages/@azure/arm-mysql/lib/models/checkNameAvailabilityMappers.ts
modified:   packages/@azure/arm-mysql/lib/models/configurationsMappers.ts`
      }
    });
    fakeRunner.set({
      command: `git status`, executionFolderPath: javaFolderPath,
      result: {
        exitCode: 0,
        stdout:
          `On branch master
Your branch is up to date with 'origin/master'.

Changes not staged for commit:
(use "git add <file>..." to update what will be committed)
(use "git checkout -- <file>..." to discard changes in working directory)

modified:   mysql/resource-manager/v2017_12_01/src/main/java/com/microsoft/azure/management/mysql/v2017_12_01/CheckNameAvailabilitys.java
modified:   mysql/resource-manager/v2017_12_01/src/main/java/com/microsoft/azure/management/mysql/v2017_12_01/Configuration.java`
      }
    });
    fakeRunner.set({
      command: `${npmExecutable()} pack`, executionFolderPath: joinPath(jsFolderPath, "packages/@azure/arm-mysql"),
      result: async () => {
        const packageFolderPath: string = joinPath(jsFolderPath, "packages/@azure/arm-mysql");
        await createFolder(packageFolderPath);
        await writeFileContents(joinPath(packageFolderPath, "azure-arm-mysql-3.2.0.tgz"), "");
        return { exitCode: 0 };
      }
    });
    fakeRunner.set({
      command: `${npmExecutable()} pack`, executionFolderPath: joinPath(nodeFolderPath, "lib/services/mysqlManagement"),
      result: async () => {
        const packageFolderPath: string = joinPath(nodeFolderPath, "lib/services/mysqlManagement");
        await createFolder(packageFolderPath);
        await writeFileContents(joinPath(packageFolderPath, "azure-arm-mysql-3.2.0.tgz"), "");
        return { exitCode: 0 };
      }
    });
    runner = fakeRunner;
  }
  return runner;
}
