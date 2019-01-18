import * as jsDevTools from "@ts-common/azure-js-dev-tools";
import { NoTelemetry, Telemetry } from "./telemetry";
import { HttpResponse, GitHubRepository, getGitHubRepository, getRepositoryFullName } from "@ts-common/azure-js-dev-tools";
import { findSwaggerToSDKConfiguration, ReadmeMdSwaggerToSDKConfiguration } from "./autoRest";

export type Switch = "" | boolean;

/**
 * An optional dictionary of options you want to pass to Autorest. This will be passed in any call,
 * but can be override by "autorest_options" in each data. Note that you CAN'T override
 * "--output-folder" which is filled contextually. All options prefixed by "sdkrel:" can be a
 * relative path that will be solved against SDK folder before being sent to Autorest.
 */
export interface AutoRestOptions {
  /**
   * Show verbose output information.
   */
  verbose?: Switch;
  /**
   * Show internal debug information.
   */
  debug?: Switch;
  /**
   * Suppress output.
   */
  quiet?: Switch;
  /**
   * Show all installed versions of AutoRest tools.
   */
  "list-installed"?: Switch;
  /**
   * Lists the last nn releases available from github.
   */
  "list-available"?: number;
  /**
   * Uses specified version of AutoRest (installing if necessary.)
   * For version you can use a version label (see --list-available) or
   * -latest: Get latest nightly build.
   * -latest-release: Get latest release version.
   */
  version?: string;
  /**
   * Remove all installed versions of AutoRest tools and install the latest (override with
   * --version).
   */
  reset?: Switch;
  /**
   * Overrides the platform detection for the dotnet runtime (special case). Refer to the Runtime
   * Identifier (RID) catalog for more details.
   */
  "runtime-id"?: string;
  /**
   * Adds the given file to the list of input files for generation process.
   */
  "input-file"?: string;
  /**
   * Sets the namespace to use for the generated code.
   */
  namespace?: string;
  /**
   * Text to include as a header comment in generated files. Use NONE to suppress the default header.
   */
  "license-header"?: string;
  /**
   * If specified, the generated client includes a ServiceClientCredentials property and constructor
   * parameter. Authentication behaviors are implemented by extending the ServiceClientCredentials
   * type.
   */
  "add-credentials"?: Switch;
  /**
   * Name of the package.
   */
  "package-name"?: string;
  /**
   * Version of the package.
   */
  "package-version"?: string;
  /**
   * Specifies mode for generating sync wrappers. Supported value are:
   * essential - generates only one sync returning body or header (default)
   * all - generates one sync method for each async method
   * none - does not generate any sync methods
   */
  "sync-methods"?: string;
  /**
   * The maximum number of properties in the request body. If the number of properties in the
   * request body is less than or equal to this value, these properties will be represented as
   * method arguments.
   */
  "payload-flattening-threshold"?: number;
  /**
   * Name to use for the generated client type. By default, uses the value of the "Title" field from
   * the input files.
   */
  "override-client-name"?: string;
  /**
   * Indicates whether generated constructors will have an internal protection level.
   */
  "use-internal-constructors"?: Switch;
  /**
   * Indicates whether to use DateTimeOffset instead of DateTime to model date-time types.
   */
  "use-datetimeoffset"?: Switch;
  /**
   * Name to use for the generated client models namespace and folder name. By default, uses the
   * value of 'Models'. This is not currently supported by all code generators.
   */
  "models-name"?: string;
  /**
   * If set, will cause generated code to be output to a single file. Not supported by all code
   * generators.
   */
  "output-file"?: string;
  /**
   * Specifies the format, messages will be printed as. JSON format is easier to process
   * programmatically.
   */
  "message-format"?: string;
  /**
   * If set, runs the Azure specific validator plugin.
   */
  "azure-validator"?: Switch;
  /**
   * Indicates the type of configuration file being passed to the azure-validator so that it can run
   * the appropriate class of validation rules accordingly.
   */
  "openapi-type"?: string;
  /**
   * If set, validates the provided OpenAPI definition(s) against provided examples.
   */
  "model-validator"?: Switch;
  /**
   * If set, semantically verifies the provided OpenAPI definition(s), e.g. checks that a
   * parameter's specified default value matches the parameter's declared type.
   */
  "semantic-validator"?: Switch;
  /**
   * Runs the C# code generator.
   */
  csharp?: Switch;
  /**
   * Runs the Node.js JavaScript code generator.
   */
  nodjs?: Switch;
  /**
   * Runs the Python code generator.
   */
  python?: Switch;
  /**
   * Runs the Java code generator.
   */
  java?: Switch;
  /**
   * Runs the Ruby code generator.
   */
  ruby?: Switch;
  /**
   * Runs the Go code generator.
   */
  go?: Switch;
  /**
   * Runs the TypeScript code generator.
   */
  typescript?: Switch;
  /**
   * Runs the Azure Resource Schema code generator.
   */
  azureresourceschema?: Switch;
  /**
   * Uses the Azure version of the specified code generator.
   */
  "azure-arm"?: Switch;
  /**
   * An option that will be passed to AutoRest.
   */
  [propertyName: string]: undefined | string | boolean | number;
}

export interface AdvancedOptions {
  /**
   * Add more layers of folders to clone the repo, if necessary. Right now, useful for Go only.
   * "sdkrel:" will consider this as the final folder path.
   */
  clone_dir?: string;
  /**
   * An optional list of files/directory to keep when we generate new SDK. This support a
   * Bash-like wildcard syntax (i.e. "my*file.py"). This applies to every Swagger files.
   */
  wrapper_filesOrDirs?: string[];
  /**
   * An optional list of files/directory to delete from the generated SDK. This support a
   * Bash-like wildcard syntax (i.e. "my*file.py") This applies to every Swagger files.
   */
  delete_filesOrDirs?: string[];
  /**
   * If the data to consider generated by Autorest are not directly in the root folder. For
   * instance, if Autorest generates a networkclient folder and you want to consider this folder as
   * the root of data. This parameter is applied before 'delete_filesOrDirs', consider it in your
   * paths. This applies to every Swagger files.
   */
  generated_relative_base_directory?: string;
  /**
   * This is the folder in your SDK repository where you want to put the generated files.
   */
  output_dir?: string;
  /**
   * This is an optional folder where to put metadata about the generation (Autorest version, date
   * of generation, etc.). This can be used by our monitoring system to detect package that needs an
   * update. Be sure this folder is unique in the entire file, to avoid overwritting a file from
   * another project.
   */
  build_dir?: string;
}

/**
 * A set of options for giving specific properties to certain service/resource providers.
 */
export interface Project {
  /**
   * This is an optional parameter which specificy the Autorest MD file path for this project. This
   * is relative to the rest-folder paramter.
   */
  markdown?: string;
  /**
   * An optional dictionary of options you want to pass to Autorest. This will be passed in any
   * call, but can be override by "autorest_options" in each data. Note that you CAN'T override
   * "--output-folder" which is filled contextually. All options prefixed by "sdkrel:" can be a
   * relative path that will be solved against SDK folder before being sent to Autorest.
   */
  autorest_options?: AutoRestOptions;
  /**
   * An optional list of files/directory to keep when we generate new SDK. This support a
   * Bash-like wildcard syntax (i.e. "my*file.py"). This applies to every Swagger files.
   */
  wrapper_filesOrDirs?: string[];
  /**
   * An optional list of files/directory to delete from the generated SDK. This support a
   * Bash-like wildcard syntax (i.e. "my*file.py") This applies to every Swagger files.
   */
  delete_filesOrDirs?: string[];
  /**
   * If the data to consider generated by Autorest are not directly in the root folder. For
   * instance, if Autorest generates a networkclient folder and you want to consider this folder
   * as the root of data. This parameter is applied before 'delete_filesOrDirs', consider it in
   * your paths. This applies to every Swagger files.
   */
  generated_relative_base_directory?: string;
  /**
   * This is the folder in your SDK repository where you want to put the generated files.
   */
  output_dir?: string;
  /**
   * This is an optional folder where to put metadata about the generation (Autorest version, date
   * of generation, etc.). This can be used by our monitoring system to detect package that needs an
   * update. Be sure this folder is unique in the entire file, to avoid overwritting a file from
   * another project.
   */
  build_dir?: string;
}

/**
 * A configuration that describes how SwaggerToSDK should behave for a specific repository.
 */
export interface SwaggerToSDKConfiguration {
  meta?: {
    /**
     * The version of SwaggerToSDK to use.
     * The version must be 0.2.0.
     */
    version?: string;
    /**
     * List of commands to execute after the generation is done. Will be executed in the order of the
     * list. Current working directory will be the cloned path. See also "envs" node.
     */
    after_scripts?: string[];
    /**
     * An optional dictionary of options you want to pass to Autorest. This will be passed in any
     * call, but can be override by "autorest_options" in each data. Note that you CAN'T override
     * "--output-folder" which is filled contextually. All options prefixed by "sdkrel:" can be a
     * relative path that will be solved against SDK folder before being sent to Autorest.
     */
    autorest_options?: AutoRestOptions;
    /**
     * Environment variables for after_scripts. All options prefixed by "sdkrel:" can be a relative
     * path that will be resolved against SDK folder before being sent to the scripts.
     */
    envs?: jsDevTools.StringMap<string | boolean | number>;
    advanced_options?: AdvancedOptions;
    /**
     * An optional list of files/directory to keep when we generate new SDK. This support a
     * Bash-like wildcard syntax (i.e. "my*file.py"). This applies to every Swagger files.
     */
    wrapper_filesOrDirs?: string[];
    /**
     * An optional list of files/directory to delete from the generated SDK. This support a
     * Bash-like wildcard syntax (i.e. "my*file.py") This applies to every Swagger files.
     */
    delete_filesOrDirs?: string[];
    /**
     * If the data to consider generated by Autorest are not directly in the root folder. For
     * instance, if Autorest generates a networkclient folder and you want to consider this folder
     * as the root of data. This parameter is applied before 'delete_filesOrDirs', consider it in
     * your paths. This applies to every Swagger files.
     */
    generated_relative_base_directory?: string;
  };
  /**
   * It's a dict where keys are a project id. The project id has no constraint, but it's recommended
   * to use namespace style, like "datalake.store.account" to provide the best flexibility for the
   * --project parameter.
   */
  projects?: jsDevTools.StringMap<Project>;
}

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
  /**
   * The folder where SwaggerToSDK can create folders and clone repositories to. If this isn't
   * defined, then the current working directory will be used.
   */
  workingFolderPath?: string;
  /**
   * Whether or not to delete the locally cloned repositories used for generation. Defaults to true.
   */
  deleteClonedRepositories?: boolean;
}

/**
 * The regular expression used to get a relative file path from a pull request diff_url contents
 * line.
 */
const diffGitLineRegex: RegExp = /diff --git a\/(.*) b\/.*/;

export function getWorkingFolderPath(workingFolderPath: string | undefined): string {
  if (!workingFolderPath) {
    workingFolderPath = process.cwd();
  } else if (!jsDevTools.isRooted(workingFolderPath)) {
    workingFolderPath = jsDevTools.joinPath(process.cwd(), workingFolderPath);
  }
  return workingFolderPath;
}

export function getPullRequestFolderPath(workingFolderPath: string | undefined, pullRequestNumber: number): string {
  return jsDevTools.joinPath(getWorkingFolderPath(workingFolderPath), pullRequestNumber.toString());
}

/**
 * Get the path to the folder that generation work for the provided pull request number will take
 * place.
 * @param pullRequestNumber The number of the pull request that generation will happen for.
 * @param workingFolderPath The base folder that generation folders will be based on.
 */
export function getGenerationInstanceFolderPath(pullRequestFolderPath: string): string {
  let generationInstance = 1;
  let generationFolderPath: string = jsDevTools.joinPath(pullRequestFolderPath, generationInstance.toString());
  while (jsDevTools.folderExistsSync(generationFolderPath)) {
    ++generationInstance;
    generationFolderPath = jsDevTools.joinPath(pullRequestFolderPath, generationInstance.toString());
  }
  return generationFolderPath;
}

export function getRepositoryFolderPath(generationInstanceFolderPath: string, swaggerToSDKConfig: SwaggerToSDKConfiguration): string {
  let repositoryFolderPath = `${generationInstanceFolderPath}`;
  if (swaggerToSDKConfig.meta &&
      swaggerToSDKConfig.meta.advanced_options &&
      swaggerToSDKConfig.meta.advanced_options.clone_dir) {
    repositoryFolderPath = jsDevTools.joinPath(repositoryFolderPath, swaggerToSDKConfig.meta.advanced_options.clone_dir);
  } else {
    let repositoryNumber = 1;
    while (jsDevTools.folderExistsSync(jsDevTools.joinPath(repositoryFolderPath, repositoryNumber.toString()))) {
      ++repositoryNumber;
    }
    repositoryFolderPath = jsDevTools.joinPath(repositoryFolderPath, repositoryNumber.toString());
  }
  return repositoryFolderPath;
}

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

    const deleteClonedRepositories: boolean = options.deleteClonedRepositories != undefined ? options.deleteClonedRepositories : true;

    const azureRestAPISpecsPullRequest: jsDevTools.GitHubPullRequest = pullRequestChangeBody.pull_request;
    this.logMessage(`Received pull request change webhook request from GitHub for "${azureRestAPISpecsPullRequest.html_url}".`);

    const pullRequestFolderPath: string = getPullRequestFolderPath(options.workingFolderPath, azureRestAPISpecsPullRequest.number);
    const generationInstanceFolderPath: string = getGenerationInstanceFolderPath(pullRequestFolderPath);

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
        for (const readmeMdRelativeFilePathToGenerate of readmeMdRelativeFilePathsToGenerate) {
          this.logMessage(`Looking for languages to generate in "${readmeMdRelativeFilePathToGenerate}"...`);
          const mergedReadmeMdFileUrl = `https://raw.githubusercontent.com/azure/azure-rest-api-specs/${azureRestAPISpecsPullRequest.merge_commit_sha}/${readmeMdRelativeFilePathToGenerate}`;
          this.logMessage(`Getting file contents for "${mergedReadmeMdFileUrl}"...`);
          const mergedReadmeMdFileResponse: HttpResponse = await this.httpClient.sendRequest({ method: "GET", url: mergedReadmeMdFileUrl });
          this.logMessage(`Merged readme.md response status code is ${mergedReadmeMdFileResponse.statusCode}.`);
          const mergedReadmeMdFileContents: string | undefined = mergedReadmeMdFileResponse.body;
          if (!mergedReadmeMdFileContents) {
            this.logError(`Merged readme.md response body is empty.`);
          } else {
            const swaggerToSDKConfiguration: ReadmeMdSwaggerToSDKConfiguration | undefined = findSwaggerToSDKConfiguration(mergedReadmeMdFileContents);
            if (!swaggerToSDKConfiguration) {
              this.logError(`No SwaggerToSDK configuration YAML block found in the merged readme.md.`);
            } else {
              this.logMessage(`Found ${swaggerToSDKConfiguration.repositories.length} requested SDK repositories:`);
              for (const requestedRepository of swaggerToSDKConfiguration.repositories) {
                this.logMessage(requestedRepository.repo);
              }
              for (const requestedRepository of swaggerToSDKConfiguration.repositories) {
                const repository: GitHubRepository = getGitHubRepository(requestedRepository.repo);
                if (!repository.organization) {
                  repository.organization = "Azure";
                }
                const fullRepositoryName: string = getRepositoryFullName(repository);
                const repositoryUrl = `https://github.com/${fullRepositoryName}`;
                const repositoryExistsResponse: HttpResponse = await this.httpClient.sendRequest({ method: "HEAD", url: repositoryUrl });
                if (repositoryExistsResponse.statusCode !== 200) {
                  this.logError(`Could not find a repository at ${repositoryUrl}.`);
                } else {
                  const swaggerToSDKConfigFileUrl = `https://raw.githubusercontent.com/${fullRepositoryName}/master/swagger_to_sdk_config.json`;
                  const swaggerToSDKConfigFileResponse: HttpResponse = await this.httpClient.sendRequest({ method: "GET", url: swaggerToSDKConfigFileUrl });
                  if (swaggerToSDKConfigFileResponse.statusCode !== 200) {
                    this.logError(`Could not find a swagger_to_sdk_config.json file at ${swaggerToSDKConfigFileUrl}.`);
                  } else {
                    const swaggerToSDKConfigFileContents: string | undefined = swaggerToSDKConfigFileResponse.body;
                    if (!swaggerToSDKConfigFileContents) {
                      this.logError(`The swagger_to_sdk_config.json file at ${swaggerToSDKConfigFileUrl} is empty.`);
                    } else {
                      const swaggerToSDKConfig: SwaggerToSDKConfiguration = JSON.parse(swaggerToSDKConfigFileContents);
                      if (!swaggerToSDKConfig.meta) {
                        this.logError(`No meta property exists in ${swaggerToSDKConfigFileUrl}.`);
                      } else {
                        const repositoryFolderPath = getRepositoryFolderPath(generationInstanceFolderPath, swaggerToSDKConfig);
                        const cloneResult: jsDevTools.RunResult = jsDevTools.gitClone(repositoryUrl, {
                          depth: 1,
                          directory: repositoryFolderPath,
                          quiet: true,
                          log: (text: string) => this.logMessage(text),
                          showCommand: true
                        });
                        if (cloneResult.exitCode !== 0) {
                          this.logError(`Failed to clone ${repositoryUrl} to ${repositoryFolderPath}:`);
                          for (const errorMessage of cloneResult.stderr.split(/\r?\n/)) {
                            if (errorMessage) {
                              this.logError(errorMessage);
                            }
                          }
                        }



                        if (!deleteClonedRepositories) {
                          this.logMessage(`Not deleting clone of ${fullRepositoryName} at folder ${repositoryFolderPath}.`);
                        } else {
                          this.logMessage(`Deleting clone of ${fullRepositoryName} at folder ${repositoryFolderPath}...`);
                          jsDevTools.deleteFolder(repositoryFolderPath);
                          this.logMessage(`Finished deleting clone of ${fullRepositoryName} at folder ${repositoryFolderPath}.`);
                        }
                      }
                    }
                  }
                }
              }

              if (!deleteClonedRepositories) {
                this.logMessage(`Not deleting generation instance folder ${generationInstanceFolderPath}.`);
              } else {
                this.logMessage(`Deleting generation instance folder ${generationInstanceFolderPath}...`);
                jsDevTools.deleteFolder(generationInstanceFolderPath);
                this.logMessage(`Finished deleting generation instance folder ${generationInstanceFolderPath}.`);
              }
            }
          }
        }
      }
    }
  }
}
