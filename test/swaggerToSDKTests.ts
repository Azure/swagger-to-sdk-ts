import { ArchiverCompressor, assertEx, autorestExecutable, AzureBlobStorage, BlobPath, BlobStorage, BlobStorageBlob, BlobStoragePrefix, Compressor, createFolder, deleteFolder, FakeCompressor, FakeGitHub, FakeRunner, first, folderExistsSync, getGitHubRepository, getInMemoryLogger, getName, getParentFolderPath, getRootPath, GitHub, GitHubComment, GitHubCommit, GitHubPullRequest, GitHubPullRequestWebhookBody, HttpClient, HttpHeaders, HttpRequest, HttpResponse, InMemoryBlobStorage, InMemoryLogger, joinPath, NodeHttpClient, normalize, npmExecutable, RealRunner, Runner, URLBuilder, writeFileContents } from "@ts-common/azure-js-dev-tools";
import { getLines } from "@ts-common/azure-js-dev-tools/dist/lib/common";
import { assert } from "chai";
import { createGenerationIteration, createTempFolder, csharp, GenerationData, generationStatus, getAllLanguages, getCompressedRepositoryFileName, getCompressorCreator, getGenerationDataHTMLLines, getGenerationIterationPrefix, getGitHub, getLanguageForRepository, getLogsBlob, getPullRequestPrefix, getPullRequestRepository, getRepositoryFolderPath, getSupportedLanguages, getWorkingFolderPath, go, LanguageConfiguration, logChangedFiles, pullRequestChange, python, ruby, SwaggerToSDKConfiguration } from "../lib/swaggerToSDK";

const deleteContainer = true;
const real = true;
const realStorageUrl = `https://autosdkstorage.blob.core.windows.net/?sv=2018-03-28&ss=bfqt&srt=sco&sp=rwdlacup&se=2019-02-14T07:21:43Z&st=2019-02-13T23:21:43Z&spr=https&sig=aPWFwEfhvS1645Y3Yc2NSeCmqvGyOBtO0oyUTLkKjlg%3D`;

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
const pullRequestRepository = "Azure/azure-rest-api-specs";

const pullRequest: GitHubPullRequest = {
  base: baseCommit,
  head: headCommit,
  merge_commit_sha: pullRequestMergeCommitSha,
  id: pullRequestId,
  labels: [],
  number: pullRequestNumber,
  state: "closed",
  title: pullRequestTitle,
  url: `https://api.github.com/repos/${pullRequestRepository}/pulls/${pullRequestNumber}`,
  html_url: `https://github.com/${pullRequestRepository}/pull/${pullRequestNumber}`,
  diff_url: `https://github.com/${pullRequestRepository}/pull/${pullRequestNumber}.diff`,
  milestone: undefined,
  assignees: undefined
};

let testCount = 0;
function getWorkingPrefix(blobStorage: BlobStorage): BlobStoragePrefix {
  return blobStorage.getPrefix(new BlobPath(`abc${++testCount}`, ""));
}

describe("swaggerToSDK.ts", function () {
  describe("createTempFolder()", function () {
    it("when baseFolderPath doesn't exist", async function () {
      const currentFolder: string = process.cwd();
      const baseFolderPath: string = joinPath(currentFolder, "idontexist");
      const tempFolderPath: string = await createTempFolder(baseFolderPath);
      try {
        assert.strictEqual(folderExistsSync(baseFolderPath), true);
        assert.strictEqual(folderExistsSync(tempFolderPath), true);
        assert.strictEqual(getName(tempFolderPath), "1");
      } finally {
        deleteFolder(baseFolderPath);
      }
    });

    it("when baseFolderPath exists but is empty", async function () {
      const currentFolder: string = process.cwd();
      const baseFolderPath: string = joinPath(currentFolder, "iexistnow");
      await createFolder(baseFolderPath);
      const tempFolderPath: string = await createTempFolder(baseFolderPath);
      try {
        assert.strictEqual(folderExistsSync(baseFolderPath), true);
        assert.strictEqual(folderExistsSync(tempFolderPath), true);
        assert.strictEqual(getName(tempFolderPath), "1");
      } finally {
        deleteFolder(baseFolderPath);
      }
    });

    it("when baseFolderPath exists and has a 1 folder in it", async function () {
      const currentFolder: string = process.cwd();
      const baseFolderPath: string = joinPath(currentFolder, "iexistnow");
      await createFolder(joinPath(baseFolderPath, "1"));
      const tempFolderPath: string = await createTempFolder(baseFolderPath);
      try {
        assert.strictEqual(folderExistsSync(baseFolderPath), true);
        assert.strictEqual(folderExistsSync(tempFolderPath), true);
        assert.strictEqual(getName(tempFolderPath), "2");
      } finally {
        deleteFolder(baseFolderPath);
      }
    });
  });

  describe("getWorkingFolderPath()", function () {
    it("with undefined", async function () {
      const workingFolderPath: string = await getWorkingFolderPath(undefined);
      try {
        assertEx.defined(workingFolderPath, "workingFolderPath");
        assert.strictEqual(folderExistsSync(workingFolderPath), true);
        assert.strictEqual(getName(workingFolderPath), "1");
        assert.strictEqual(getParentFolderPath(workingFolderPath), normalize(process.cwd()));
      } finally {
        deleteFolder(workingFolderPath);
      }
    });

    it("with relative path", async function () {
      const relativeBaseWorkingFolderPath = "my";
      const rootedBaseWorkingFolderPath: string = joinPath(process.cwd(), relativeBaseWorkingFolderPath);
      const workingFolderPath: string = await getWorkingFolderPath(relativeBaseWorkingFolderPath);
      try {
        assertEx.defined(workingFolderPath, "workingFolderPath");
        assert.strictEqual(folderExistsSync(workingFolderPath), true);
        assert.strictEqual(getName(workingFolderPath), "1");
        assert.strictEqual(getParentFolderPath(workingFolderPath), rootedBaseWorkingFolderPath);
      } finally {
        deleteFolder(rootedBaseWorkingFolderPath);
      }
    });

    it("with existing working folder path", async function () {
      const relativeBaseWorkingFolderPath = "my";
      const rootedBaseWorkingFolderPath: string = joinPath(process.cwd(), relativeBaseWorkingFolderPath);
      await getWorkingFolderPath(relativeBaseWorkingFolderPath);
      const workingFolderPath: string = await getWorkingFolderPath(relativeBaseWorkingFolderPath);
      try {
        assertEx.defined(workingFolderPath, "workingFolderPath");
        assert.strictEqual(folderExistsSync(workingFolderPath), true);
        assert.strictEqual(getName(workingFolderPath), "2");
        assert.strictEqual(getParentFolderPath(workingFolderPath), rootedBaseWorkingFolderPath);
      } finally {
        deleteFolder(rootedBaseWorkingFolderPath);
      }
    });
  });

  describe("getRepositoryFolderPath()", function () {
    it("with no meta property", function () {
      const generationInstanceFolderPath = "generation/instance/folder/path";
      const swaggerToSDKConfiguration: SwaggerToSDKConfiguration = {};
      const repositoryNumber = 9;
      assert.strictEqual(
        getRepositoryFolderPath(generationInstanceFolderPath, swaggerToSDKConfiguration, repositoryNumber),
        "generation/instance/folder/path/9");
    });

    it("with no advanced_options property", function () {
      const generationInstanceFolderPath = "generation/instance/folder/path";
      const swaggerToSDKConfiguration: SwaggerToSDKConfiguration = { meta: {} };
      const repositoryNumber = 10;
      assert.strictEqual(
        getRepositoryFolderPath(generationInstanceFolderPath, swaggerToSDKConfiguration, repositoryNumber),
        "generation/instance/folder/path/10");
    });

    it("with no clone_dir property", function () {
      const generationInstanceFolderPath = "generation/instance/folder/path";
      const swaggerToSDKConfiguration: SwaggerToSDKConfiguration = { meta: { advanced_options: {} } };
      const repositoryNumber = 11;
      assert.strictEqual(
        getRepositoryFolderPath(generationInstanceFolderPath, swaggerToSDKConfiguration, repositoryNumber),
        "generation/instance/folder/path/11");
    });

    it("with clone_dir property", function () {
      const generationInstanceFolderPath = "generation/instance/folder/path";
      const swaggerToSDKConfiguration: SwaggerToSDKConfiguration = { meta: { advanced_options: { clone_dir: "spam" } } };
      const repositoryNumber = 12;
      assert.strictEqual(
        getRepositoryFolderPath(generationInstanceFolderPath, swaggerToSDKConfiguration, repositoryNumber),
        "generation/instance/folder/path/spam");
    });
  });

  describe("logChangedFiles()", function () {
    it("with undefined changedFiles", async function () {
      const logger: InMemoryLogger = getInMemoryLogger();
      await logChangedFiles(undefined, logger, "spammed");
      assert.deepEqual(logger.allLogs, []);
    });

    it("with empty changedFiles", async function () {
      const logger: InMemoryLogger = getInMemoryLogger();
      await logChangedFiles([], logger, "spammed");
      assert.deepEqual(logger.allLogs, []);
    });

    it("with one value in changedFiles", async function () {
      const logger: InMemoryLogger = getInMemoryLogger();
      await logChangedFiles(["a"], logger, "spammed");
      assert.deepEqual(logger.allLogs, [
        `The following files were spammed:`,
        `  a`
      ]);
    });

    it("with multiple values in changedFiles", async function () {
      const logger: InMemoryLogger = getInMemoryLogger();
      await logChangedFiles(["a", "b", "c"], logger, "spammed");
      assert.deepEqual(logger.allLogs, [
        `The following files were spammed:`,
        `  a`,
        `  b`,
        `  c`
      ]);
    });
  });

  describe("getSupportedLanguages()", function () {
    it("with undefined", function () {
      assert.deepEqual(getSupportedLanguages(undefined), getAllLanguages());
    });

    it("with empty array", function () {
      const empty: LanguageConfiguration[] = [];
      assert.strictEqual(getSupportedLanguages(empty), empty);
    });

    it("with non-empty array", function () {
      const empty: LanguageConfiguration[] = [];
      assert.strictEqual(getSupportedLanguages(empty), empty);
    });

    it("with function that doesn't do anything", function () {
      assert.deepEqual(getSupportedLanguages(() => { }), getAllLanguages());
    });

    it("with function that modifies that default languages but doesn't return anything", function () {
      const languages: LanguageConfiguration[] = getSupportedLanguages((defaultLanguages: LanguageConfiguration[]) => { defaultLanguages.push(csharp); });
      assert.deepEqual(languages, [...getAllLanguages(), csharp]);
    });

    it("with function that modifies that default languages and then returns an array", function () {
      const languages: LanguageConfiguration[] = getSupportedLanguages((defaultLanguages: LanguageConfiguration[]) => {
        defaultLanguages.push(csharp);
        return [ruby];
      });
      assert.deepEqual(languages, [ruby]);
    });
  });

  describe("getCompressedRepositoryFileName()", function () {
    it("with blah and spam", function () {
      assert.strictEqual(getCompressedRepositoryFileName("blah", "spam"), "blah.spam");
    });

    it("with Azure/azure-sdk-for-js and zip", function () {
      assert.strictEqual(getCompressedRepositoryFileName("Azure/azure-sdk-for-js", "zip"), "azure.azure-sdk-for-js.zip");
    });

    it("with AZURE/AZURE-SDK-FOR-GO and .tgz", function () {
      assert.strictEqual(getCompressedRepositoryFileName("AZURE/AZURE-SDK-FOR-GO", ".tgz"), "azure.azure-sdk-for-go.tgz");
    });
  });

  it("getPullRequestPrefix()", function () {
    const blobStorage = new InMemoryBlobStorage();
    const workingPrefix: BlobStoragePrefix = blobStorage.getPrefix("apples/bananas/");
    const pullRequestPrefix: BlobStoragePrefix = getPullRequestPrefix(workingPrefix, "Azure/azure-sdk-for-ruby", 5837);
    assert.strictEqual(pullRequestPrefix.storage, blobStorage);
    assert.deepEqual(pullRequestPrefix.path.toString(), "apples/bananas/Azure/azure-sdk-for-ruby/5837/");
  });

  it("getGenerationInstancePrefix()", function () {
    const blobStorage = new InMemoryBlobStorage();
    const workingPrefix: BlobStoragePrefix = blobStorage.getPrefix("apples/bananas/");
    const pullRequestPrefix: BlobStoragePrefix = getPullRequestPrefix(workingPrefix, "Azure/azure-sdk-for-ruby", 5837);
    const generationInstancePrefid: BlobStoragePrefix = getGenerationIterationPrefix(pullRequestPrefix, 2);
    assert.strictEqual(generationInstancePrefid.storage, blobStorage);
    assert.deepEqual(generationInstancePrefid.path.toString(), "apples/bananas/Azure/azure-sdk-for-ruby/5837/2/");
  });

  describe("createGenerationInstance()", function () {
    it("when container doesn't exist", async function () {
      const blobStorage = new InMemoryBlobStorage();
      const prefix: BlobStoragePrefix = blobStorage.getPrefix("apples/bananas/");
      const generationInstance: number = await createGenerationIteration(prefix);
      assert.strictEqual(generationInstance, 1);
      assert.strictEqual(await blobStorage.containerExists("apples"), true);
      assert.strictEqual(await blobStorage.blobExists(`apples/bananas/1/logs.txt`), true);
    });

    it("when no other pull request generation instances exist", async function () {
      const blobStorage = new InMemoryBlobStorage();
      await blobStorage.createContainer("apples");
      const pullRequestPrefix: BlobStoragePrefix = blobStorage.getPrefix("apples/bananas/");
      const generationInstance: number = await createGenerationIteration(pullRequestPrefix);
      assert.strictEqual(generationInstance, 1);
      assert.strictEqual(await blobStorage.containerExists("apples"), true);
      assert.strictEqual(await blobStorage.blobExists(`apples/bananas/1/logs.txt`), true);
    });

    it("when another pull request generation instance exists", async function () {
      const blobStorage = new InMemoryBlobStorage();
      await blobStorage.createContainer("apples");
      await blobStorage.createBlob("apples/bananas/1/logs.txt");
      const pullRequestPrefix: BlobStoragePrefix = blobStorage.getPrefix("apples/bananas/");
      const generationInstance: number = await createGenerationIteration(pullRequestPrefix);
      assert.strictEqual(generationInstance, 2);
      assert.strictEqual(await blobStorage.containerExists("apples"), true);
      assert.strictEqual(await blobStorage.blobExists(`apples/bananas/2/logs.txt`), true);
    });
  });

  describe("getLanguageForRepository()", function () {
    it("with Azure/azure-sdk-for-python", function () {
      assert.strictEqual(getLanguageForRepository("Azure/azure-sdk-for-python", getAllLanguages()), python);
    });

    it("with my-cool-python-project", function () {
      assert.strictEqual(getLanguageForRepository("my-cool-python-project", getAllLanguages()), python);
    });

    it("with apples_and_bananas", function () {
      assert.strictEqual(getLanguageForRepository("apples_and_bananas", getAllLanguages()), undefined);
    });

    it("with csharp-stuff", function () {
      assert.strictEqual(getLanguageForRepository("csharp-stuff", getAllLanguages()), csharp);
    });

    it("with c#-crawler", function () {
      assert.strictEqual(getLanguageForRepository("c#-crawler", getAllLanguages()), csharp);
    });

    it("with fun/with-go", function () {
      assert.strictEqual(getLanguageForRepository("fun/with-go", getAllLanguages()), go);
    });
  });

  describe("getGitHub()", function () {
    it("with undefined", function () {
      const github: GitHub = getGitHub(undefined);
      assertEx.defined(github, "github");
      assert(github instanceof FakeGitHub);
    });

    it("with defined", function () {
      const fakeGitHub = new FakeGitHub();
      assert.strictEqual(getGitHub(fakeGitHub), fakeGitHub);
    });
  });

  describe("getCompressorCreator()", function () {
    it("with undefined", function () {
      const compressorCreator: (() => Compressor) = getCompressorCreator(undefined);
      assertEx.defined(compressorCreator, "compressorCreator");
      assert(compressorCreator() instanceof ArchiverCompressor);
    });

    it("with defined", function () {
      const compressorCreator: (() => Compressor) = getCompressorCreator(() => new FakeCompressor());
      assertEx.defined(compressorCreator, "compressorCreator");
      assert(compressorCreator() instanceof FakeCompressor);
    });
  });

  it("getPullRequest()", async function () {
    const github: GitHub = await createEndToEndGitHub();
    const pullRequest: GitHubPullRequest = await github.getPullRequest(pullRequestRepository, pullRequestNumber);
    assert(pullRequest);
    assert(pullRequest.base);
    assert.strictEqual(pullRequest.base.label, baseCommit.label);
    assert.strictEqual(pullRequest.base.ref, baseCommit.ref);
    assert.strictEqual(pullRequest.base.sha, baseCommit.sha);
    assert(pullRequest.head);
    assert.strictEqual(pullRequest.head.label, headCommit.label);
    assert.strictEqual(pullRequest.head.ref, headCommit.ref);
    assert.strictEqual(pullRequest.head.sha, headCommit.sha);
    assert.strictEqual(pullRequest.merge_commit_sha, pullRequestMergeCommitSha);
    assert.strictEqual(pullRequest.id, pullRequestId);
    assert.strictEqual(pullRequest.number, pullRequestNumber);
    assert.strictEqual(pullRequest.state, "closed");
    assert.strictEqual(pullRequest.title, pullRequestTitle);
    assert.strictEqual(pullRequest.url, `https://api.github.com/repos/${pullRequestRepository}/pulls/${pullRequestNumber}`);
    assert.strictEqual(pullRequest.html_url, `https://github.com/${pullRequestRepository}/pull/${pullRequestNumber}`);
    assert.strictEqual(pullRequest.diff_url, `https://github.com/${pullRequestRepository}/pull/${pullRequestNumber}.diff`);
  });

  describe("getSpecPRStatusHTML()", function () {
    it("with no arguments", function () {
      assert.deepEqual(getGenerationDataHTMLLines(), [
        `<html>`,
        `<body>`,
        `<h1>Generation Progress</h1>`,
        `</body>`,
        `</html>`
      ]);
    });

    it("with undefined specPRComment", function () {
      assert.deepEqual(getGenerationDataHTMLLines(undefined), [
        `<html>`,
        `<body>`,
        `<h1>Generation Progress</h1>`,
        `</body>`,
        `</html>`
      ]);
    });

    it("with commentId", function () {
      const generation: GenerationData = {
        pullRequest: {
          repository: getGitHubRepository(pullRequestRepository),
          number: pullRequestNumber,
          htmlUrl: pullRequest.html_url,
          diffUrl: pullRequest.diff_url,
          mergeCommit: pullRequestMergeCommitSha,
        },
        commentId: 50,
        logsBlobUrl: "fake_logs_blob_url",
        repositories: {}
      };
      assert.deepEqual(getGenerationDataHTMLLines(generation), [
        `<html>`,
        `<body>`,
        `<h1>Generation Progress</h1>`,
        `<a href=\"fake_logs_blob_url\">Generation Logs</a>`,
        `</body>`,
        `</html>`
      ]);
    });

    it("with empty repositories array", function () {
      const generation: GenerationData = {
        pullRequest: {
          repository: getGitHubRepository(pullRequestRepository),
          number: pullRequestNumber,
          htmlUrl: pullRequest.html_url,
          diffUrl: pullRequest.diff_url,
          mergeCommit: pullRequestMergeCommitSha,
        },
        commentId: 50,
        logsBlobUrl: "fake_logs_blob_url",
        repositories: {}
      };
      assert.deepEqual(getGenerationDataHTMLLines(generation), [
        `<html>`,
        `<body>`,
        `<h1>Generation Progress</h1>`,
        `<a href=\"fake_logs_blob_url\">Generation Logs</a>`,
        `</body>`,
        `</html>`
      ]);
    });

    it("with one successful repository", function () {
      const generation: GenerationData = {
        pullRequest: {
          repository: getGitHubRepository(pullRequestRepository),
          number: pullRequestNumber,
          htmlUrl: pullRequest.html_url,
          diffUrl: pullRequest.diff_url,
          mergeCommit: pullRequestMergeCommitSha,
        },
        commentId: 50,
        logsBlobUrl: "fake_logs_blob_url",
        repositories: {
          "Azure/azure-sdk-for-js": {
            fullName: "Azure/azure-sdk-for-js",
            status: "succeeded"
          }
        }
      };
      assert.deepEqual(getGenerationDataHTMLLines(generation), [
        `<html>`,
        `<body>`,
        `<h1>Generation Progress</h1>`,
        `<a href=\"fake_logs_blob_url\">Generation Logs</a>`,
        `<table>`,
        `<tr>`,
        `<td><a href="https://github.com/Azure/azure-sdk-for-js">Azure/azure-sdk-for-js</a></td>`,
        `<td>${generationStatus.succeeded}</td>`,
        `</tr>`,
        `</table>`,
        `</body>`,
        `</html>`
      ]);
    });

    it("with one failed repository", function () {
      const generation: GenerationData = {
        pullRequest: {
          repository: getGitHubRepository(pullRequestRepository),
          number: pullRequestNumber,
          htmlUrl: pullRequest.html_url,
          diffUrl: pullRequest.diff_url,
          mergeCommit: pullRequestMergeCommitSha,
        },
        commentId: 50,
        logsBlobUrl: "fake_logs_blob_url",
        repositories: {
          "Azure/azure-sdk-for-js": {
            fullName: "Azure/azure-sdk-for-js",
            status: "failed"
          }
        }
      };
      assert.deepEqual(getGenerationDataHTMLLines(generation), [
        `<html>`,
        `<body>`,
        `<h1>Generation Progress</h1>`,
        `<a href=\"fake_logs_blob_url\">Generation Logs</a>`,
        `<table>`,
        `<tr>`,
        `<td><a href="https://github.com/Azure/azure-sdk-for-js">Azure/azure-sdk-for-js</a></td>`,
        `<td>${generationStatus.failed}</td>`,
        `</tr>`,
        `</table>`,
        `</body>`,
        `</html>`
      ]);
    });

    it("with one in-progress repository", function () {
      const generation: GenerationData = {
        pullRequest: {
          repository: getGitHubRepository(pullRequestRepository),
          number: pullRequestNumber,
          htmlUrl: pullRequest.html_url,
          diffUrl: pullRequest.diff_url,
          mergeCommit: pullRequestMergeCommitSha,
        },
        commentId: 50,
        logsBlobUrl: "fake_logs_blob_url",
        repositories: {
          "Azure/azure-sdk-for-js": {
            fullName: "Azure/azure-sdk-for-js",
            status: "inProgress"
          }
        }
      };
      assert.deepEqual(getGenerationDataHTMLLines(generation), [
        `<html>`,
        `<body>`,
        `<h1>Generation Progress</h1>`,
        `<a href=\"fake_logs_blob_url\">Generation Logs</a>`,
        `<table>`,
        `<tr>`,
        `<td><a href="https://github.com/Azure/azure-sdk-for-js">Azure/azure-sdk-for-js</a></td>`,
        `<td>${generationStatus.inProgress}</td>`,
        `</tr>`,
        `</table>`,
        `</body>`,
        `</html>`
      ]);
    });

    it("with one pending repository", function () {
      const generation: GenerationData = {
        pullRequest: {
          repository: getGitHubRepository(pullRequestRepository),
          number: pullRequestNumber,
          htmlUrl: pullRequest.html_url,
          diffUrl: pullRequest.diff_url,
          mergeCommit: pullRequestMergeCommitSha,
        },
        commentId: 50,
        logsBlobUrl: "fake_logs_blob_url",
        repositories: {
          "Azure/azure-sdk-for-js": {
            fullName: "Azure/azure-sdk-for-js",
            status: "pending"
          }
        }
      };
      assert.deepEqual(getGenerationDataHTMLLines(generation), [
        `<html>`,
        `<body>`,
        `<h1>Generation Progress</h1>`,
        `<a href=\"fake_logs_blob_url\">Generation Logs</a>`,
        `<table>`,
        `<tr>`,
        `<td><a href="https://github.com/Azure/azure-sdk-for-js">Azure/azure-sdk-for-js</a></td>`,
        `<td>${generationStatus.pending}</td>`,
        `</tr>`,
        `</table>`,
        `</body>`,
        `</html>`
      ]);
    });
  });

  describe("getPullRequestRepository()", function () {
    it("with non-URL", function () {
      assert.strictEqual(getPullRequestRepository("apples and bananas"), undefined);
    });

    it("with non-GitHub URL", function () {
      assert.strictEqual(getPullRequestRepository("https://www.bing.com"), undefined);
    });

    it("with non-GitHub Pull Request URL", function () {
      assert.strictEqual(getPullRequestRepository(`https://github.com/${pullRequestRepository}/pull/${pullRequestNumber}`), undefined);
    });

    it("with GitHub Pull Request URL", function () {
      assert.deepEqual(getPullRequestRepository(`https://api.github.com/repos/${pullRequestRepository}/pulls/${pullRequestNumber}`), getGitHubRepository(pullRequestRepository));
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
        const webhookBody: GitHubPullRequestWebhookBody = {
          action: "opened",
          number: 1,
          pull_request: pullRequest
        };

        await pullRequestChange(webhookBody, workingPrefix, {
          logger,
          httpClient,
          workingFolderPath: rootPath,
          github: await createEndToEndGitHub()
        });

        assert.deepEqual(logger.allLogs, [
          `Received pull request change webhook request from GitHub for "https://github.com/${pullRequestRepository}/pull/${pullRequestNumber}".`,
          `Getting generation state from https://fake.storage.com/abc1/${pullRequestRepository}/4994/0/generationData.json...`,
          `Getting diff_url (https://github.com/${pullRequestRepository}/pull/${pullRequestNumber}.diff) contents...`,
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
        const webhookBody: GitHubPullRequestWebhookBody = {
          action: "opened",
          number: 1,
          pull_request: pullRequest
        };

        await pullRequestChange(webhookBody, workingPrefix, {
          logger,
          httpClient,
          workingFolderPath: rootPath,
          github: await createEndToEndGitHub()
        });

        assert.deepEqual(logger.allLogs, [
          `Received pull request change webhook request from GitHub for "https://github.com/${pullRequestRepository}/pull/${pullRequestNumber}".`,
          `Getting generation state from https://fake.storage.com/abc2/${pullRequestRepository}/4994/0/generationData.json...`,
          `Getting diff_url (https://github.com/${pullRequestRepository}/pull/${pullRequestNumber}.diff) contents...`,
          `diff_url response status code is 200.`,
          `diff_url response body is empty.`,
          `Deleting working folder ${rootPath}/1...`,
          `Finished deleting working folder ${rootPath}/1.`
        ]);
      });

      it("end-to-end", async function () {
        this.timeout(3600000);

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
          const github: FakeGitHub = await createEndToEndGitHub();
          const webhookBody: GitHubPullRequestWebhookBody = {
            action: "opened",
            number: 1,
            pull_request: pullRequest
          };

          await pullRequestChange(webhookBody, workingPrefix, {
            logger,
            runner,
            httpClient,
            workingFolderPath: baseWorkingFolderPath,
            deleteClonedRepositories: true,
            github,
            compressorCreator
          });

          assert.strictEqual(await workingPrefix.getContainer().exists(), true);

          const pullRequestPrefix: BlobStoragePrefix = workingPrefix.getPrefix(`${pullRequestRepository}/${pullRequest.number}/`);
          const generationInstancePrefix: BlobStoragePrefix = pullRequestPrefix.getPrefix(`1/`);

          const allLogsBlob: BlobStorageBlob = getLogsBlob(generationInstancePrefix);
          assert.strictEqual(await allLogsBlob.exists(), true);
          assert.strictEqual(await allLogsBlob.getContentType(), "text/plain");
          const expectedLogs: string[] = [
            `Received pull request change webhook request from GitHub for "https://github.com/${pullRequestRepository}/pull/${pullRequestNumber}".`,
            `diff_url response status code is 200.`,
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
            `Looking for repositories to generate in "specification/mysql/resource-manager/readme.md"...`,
            `Getting file contents for "https://raw.githubusercontent.com/azure/azure-rest-api-specs/${pullRequestMergeCommitSha}/specification/mysql/resource-manager/readme.md"...`,
            `Merged readme.md response status code is 200.`,
            `Found 5 requested SDK repositories:`,
            `Azure/azure-sdk-for-python`,
            `Azure/azure-sdk-for-java`,
            `Azure/azure-sdk-for-go`,
            `Azure/azure-sdk-for-js`,
            `Azure/azure-sdk-for-node`,
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
          const javaScriptPackageUrl: URLBuilder = URLBuilder.parse(blobStorage.getBlobURL(`abc3/${pullRequestRepository}/4994/1/Azure/azure-sdk-for-js/azure-arm-mysql-3.2.0.tgz`));
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
          const nodePackageUrl: URLBuilder = URLBuilder.parse(blobStorage.getBlobURL(`abc3/${pullRequestRepository}/4994/1/Azure/azure-sdk-for-node/azure-arm-mysql-3.2.0.tgz`));
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

          assert.strictEqual(await generationInstancePrefix.blobExists("Azure/azure-sdk-for-js/azure.azure-sdk-for-js.zip"), false);
          assert.strictEqual(await generationInstancePrefix.blobExists("Azure/azure-sdk-for-java/azure.azure-sdk-for-java.zip"), false);
          assert.strictEqual(await generationInstancePrefix.blobExists("Azure/azure-sdk-for-python/azure.azure-sdk-for-python.zip"), false);
          assert.strictEqual(await generationInstancePrefix.blobExists("Azure/azure-sdk-for-node/azure.azure-sdk-for-node.zip"), false);
          assert.strictEqual(await generationInstancePrefix.blobExists("Azure/azure-sdk-for-go/azure.azure-sdk-for-go.zip"), true);

          assert.strictEqual(await generationInstancePrefix.blobExists("Azure/azure-sdk-for-js/azure-arm-mysql-3.2.0.tgz"), true);
          assert.strictEqual(await generationInstancePrefix.blobExists("Azure/azure-sdk-for-node/azure-arm-mysql-3.2.0.tgz"), true);

          const generationBlob: BlobStorageBlob = generationInstancePrefix.getBlob("generationData.json");
          assert.strictEqual(await generationBlob.exists(), true);
          const generation: GenerationData = JSON.parse((await generationBlob.getContentsAsString())!);
          const commentId: number = generation.commentId!;
          const githubComment: GitHubComment = first(await github.getPullRequestComments(pullRequestRepository, pullRequestNumber),
            (comment: GitHubComment) => comment.id === commentId)!;
          assertEx.defined(githubComment, "githubComment");
          assert.strictEqual(githubComment.id, commentId);
          assertEx.contains(githubComment.body, `<h1>Generation Progress</h1>`);
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

function createEndToEndHttpClient(real?: boolean): HttpClient {
  return real
    ? new NodeHttpClient()
    : {
      sendRequest(request: HttpRequest): Promise<HttpResponse> {
        const requestPath: string | undefined = URLBuilder.parse(request.url.toString()).getPath();
        let body: string | undefined;
        switch (requestPath) {
          case URLBuilder.parse(pullRequest.diff_url).getPath()!:
            body = `
diff --git a/specification/mysql/resource-manager/Microsoft.DBforMySQL/preview/2017-12-01-preview/examples/ServerCreate.json b/specification/mysql/resource-manager/Microsoft.DBforMySQL/preview/2017-12-01-preview/examples/ServerCreate.json
diff --git a/specification/mysql/resource-manager/Microsoft.DBforMySQL/stable/2017-12-01/examples/ServerCreate.json b/specification/mysql/resource-manager/Microsoft.DBforMySQL/stable/2017-12-01/examples/ServerCreate.json
diff --git a/specification/mysql/resource-manager/Microsoft.DBforMySQL/stable/2017-12-01/examples/ServerCreateGeoRestoreMode.json b/specification/mysql/resource-manager/Microsoft.DBforMySQL/stable/2017-12-01/examples/ServerCreateGeoRestoreMode.json
diff --git a/specification/mysql/resource-manager/Microsoft.DBforMySQL/stable/2017-12-01/examples/ServerCreatePointInTimeRestore.json b/specification/mysql/resource-manager/Microsoft.DBforMySQL/stable/2017-12-01/examples/ServerCreatePointInTimeRestore.json
diff --git a/specification/mysql/resource-manager/Microsoft.DBforMySQL/stable/2017-12-01/examples/ServerCreateReplicaMode.json b/specification/mysql/resource-manager/Microsoft.DBforMySQL/stable/2017-12-01/examples/ServerCreateReplicaMode.json
`;
            break;

          case "/azure/azure-rest-api-specs/5d204450e3ea6709a034208af441ebaaa87bd805/specification/mysql/resource-manager/readme.md":
            body = `
\`\`\`yaml $(swagger-to-sdk)
swagger-to-sdk:
  - repo: azure-sdk-for-python
  - repo: azure-sdk-for-java
  - repo: azure-sdk-for-go
  - repo: azure-sdk-for-js
  - repo: azure-sdk-for-node
\`\`\`
`;
            break;

          case "/Azure/azure-sdk-for-js":
          case "/Azure/azure-sdk-for-python":
          case "/Azure/azure-sdk-for-go":
          case "/Azure/azure-sdk-for-java":
          case "/Azure/azure-sdk-for-node":
            body = "";
            break;

          case "/Azure/azure-sdk-for-js/master/swagger_to_sdk_config.json":
            const jsSwaggerToSDKConfiguration: SwaggerToSDKConfiguration = {
              "meta": {
                "autorest_options": {
                  "typescript": "",
                  "license-header": "MICROSOFT_MIT_NO_VERSION",
                  "sdkrel:typescript-sdks-folder": ".",
                  "use": "@microsoft.azure/autorest.typescript@2.1.1"
                },
                "advanced_options": {
                  "clone_dir": "azure-sdk-for-js"
                }
              }
            };
            body = JSON.stringify(jsSwaggerToSDKConfiguration);
            break;

          case "/Azure/azure-sdk-for-python/master/swagger_to_sdk_config.json":
            const pythonSwaggerToSDKConfiguration: SwaggerToSDKConfiguration = {
              meta: {
                autorest_options: {
                  "version": "preview",
                  "use": "@microsoft.azure/autorest.python@~3.0.56",
                  "python": "",
                  "python-mode": "update",
                  "multiapi": "",
                  "sdkrel:python-sdks-folder": "."
                }
              }
            };
            body = JSON.stringify(pythonSwaggerToSDKConfiguration);
            break;

          case "/Azure/azure-sdk-for-go/master/swagger_to_sdk_config.json":
            const goSwaggerToSDKConfiguration: SwaggerToSDKConfiguration = {
              meta: {
                "autorest_options": {
                  "use": "@microsoft.azure/autorest.go@~2.1.127",
                  "go": "",
                  "verbose": "",
                  "multiapi": "",
                  "use-onever": "",
                  "preview-chk": "",
                  "sdkrel:go-sdk-folder": "."
                },
                advanced_options: {
                  clone_dir: "src/github.com/Azure/azure-sdk-for-go"
                }
              }
            };
            body = JSON.stringify(goSwaggerToSDKConfiguration);
            break;

          case "/Azure/azure-sdk-for-java/master/swagger_to_sdk_config.json":
            const javaSwaggerToSDKConfiguration: SwaggerToSDKConfiguration = {
              "meta": {
                "autorest_options": {
                  "java": "",
                  "verbose": "",
                  "multiapi": "",
                  "sdkrel:azure-libraries-for-java-folder": ".",
                  "use": "@microsoft.azure/autorest.java@2.1.85",
                }
              }
            };
            body = JSON.stringify(javaSwaggerToSDKConfiguration);
            break;

          case "/Azure/azure-sdk-for-node/master/swagger_to_sdk_config.json":
            const nodeSwaggerToSDKConfiguration: SwaggerToSDKConfiguration = {
              "meta": {
                "autorest_options": {
                  "nodejs": "",
                  "license-header": "MICROSOFT_MIT_NO_VERSION",
                  "use": "@microsoft.azure/autorest.nodejs@2.2.131",
                  "sdkrel:node-sdks-folder": "."
                },
                "advanced_options": {
                  "clone_dir": "azure-sdk-for-node"
                }
              }
            };
            body = JSON.stringify(nodeSwaggerToSDKConfiguration);
            break;
        }

        return Promise.resolve({
          request,
          statusCode: body != undefined ? 200 : 404,
          headers: new HttpHeaders(),
          body
        });
      }
    };
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

async function createEndToEndGitHub(): Promise<FakeGitHub> {
  const result = new FakeGitHub();
  await result.createUser("fake_user");
  await result.setCurrentUser("fake_user");
  await result.createFakeRepository(pullRequestRepository);
  await result.createPullRequest(pullRequestRepository, pullRequest);
  return result;
}
