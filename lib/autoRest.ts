import { RunResult } from "@ts-common/azure-js-dev-tools";
import * as commonmark from "commonmark";
import * as jsYaml from "js-yaml";

/**
 * An interface that can be used to invoke an AutoRest generation process.
 */
export abstract class AutoRest {
  /**
   * Create a new AutoRest object that will install and run from the provided baseFolder.
   * @param baseFolder The folder that AutoRest will be installed and run relative to.
   * @param version The version of AutoRest that will be installed. Defaults to the latest version.
   */
  constructor(public readonly baseFolder: string, public readonly version?: string) {
  }
  /**
   * Install AutoRest.
   */
  public abstract install(): RunResult;
  /**
   * Run AutoRest.
   */
  public abstract run(): RunResult;
}

/**
 * A real AutoRest facade implementation that attempts to invoke AutoRest.
 */
export class RealAutoRest extends AutoRest {
  public install(): RunResult {
    throw new Error("Method not implemented.");
  }
  public run(): RunResult {
    throw new Error("Method not implemented.");
  }
}

/**
 * A fake AutoRest facade implementation.
 */
export class FakeAutoRest extends AutoRest {
  public install(): RunResult {
    throw new Error("Method not implemented.");
  }
  public run(): RunResult {
    throw new Error("Method not implemented.");
  }
}

/**
 * The parsed version of the swagger-to-sdk YAML block within an AutoRest readme.md file.
 */
export interface ReadmeMdSwaggerToSDKConfiguration {
  /**
   * The repositories specified.
   */
  repositories: RepositoryConfiguration[];
}

/**
 * An individual repository configuration within an AutoRest readme.md swagger-to-sdk YAML block
 * configuration.
 */
export interface RepositoryConfiguration {
  /**
   * The name of the GitHub repository this configuration applies to. If no organization is
   * specified, then Azure will be used.
   */
  repo: string;
  /**
   * The list of commands that will be run (in order) after an SDK has been generated.
   */
  after_scripts: string[];
}

function findSwaggerToSDKYamlBlocks(parsedMarkdownNode: commonmark.Node | undefined | null): commonmark.Node[] {
  const result: commonmark.Node[] = [];
  if (parsedMarkdownNode) {
    const nodesToVisit: commonmark.Node[] = [parsedMarkdownNode];
    while (nodesToVisit.length > 0) {
      const node: commonmark.Node = nodesToVisit.shift()!;

      if (node.firstChild) {
        nodesToVisit.push(node.firstChild);
      }
      if (node.next) {
        nodesToVisit.push(node.next);
      }

      if (node.type === "code_block" && node.info && node.info.toLowerCase().indexOf("$(swagger-to-sdk)") !== -1) {
        result.push(node);
      }
    }
  }
  return result;
}

/**
 * Parse the contents of an AutoRest readme.md configuration file and return the parsed swagger to
 * sdk configuration section.
 * @param readmeMdFileContents The contents of an AutoRest readme.md configuration file.
 */
export function findSwaggerToSDKConfiguration(readmeMdFileContents: string | undefined): ReadmeMdSwaggerToSDKConfiguration | undefined {
  let result: ReadmeMdSwaggerToSDKConfiguration | undefined;
  if (readmeMdFileContents) {
    const markdownParser = new commonmark.Parser();
    const parsedReadmeMd: commonmark.Node = markdownParser.parse(readmeMdFileContents);
    const swaggerToSDKYamlBlocks: commonmark.Node[] = findSwaggerToSDKYamlBlocks(parsedReadmeMd);
    const repositories: RepositoryConfiguration[] = [];
    for (const swaggerToSDKYamlBlock of swaggerToSDKYamlBlocks) {
      const yamlBlockContents: string | null = swaggerToSDKYamlBlock.literal;
      if (yamlBlockContents) {
        const yaml: any = jsYaml.safeLoad(yamlBlockContents);
        if (yaml) {
          const swaggerToSDK: any = yaml["swagger-to-sdk"];
          if (swaggerToSDK && Array.isArray(swaggerToSDK)) {
            repositories.push(...swaggerToSDK);
          }
        }
      }
    }
    result = { repositories };
  }
  return result;
}
