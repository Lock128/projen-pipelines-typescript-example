"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CDKPipeline = exports.PipelineEngine = void 0;
const JSII_RTTI_SYMBOL_1 = Symbol.for("jsii.rtti");
const projen_1 = require("projen");
const common_1 = require("projen/lib/common");
const javascript_1 = require("projen/lib/javascript");
/**
 * The CI/CD tooling used to run your pipeline.
 * The component will render workflows for the given system
 */
var PipelineEngine;
(function (PipelineEngine) {
    /** Create GitHub actions */
    PipelineEngine[PipelineEngine["GITHUB"] = 0] = "GITHUB";
    /** Create a .gitlab-ci.yaml file */
    PipelineEngine[PipelineEngine["GITLAB"] = 1] = "GITLAB";
    // /** Create AWS CodeCatalyst workflows */
    // CODE_CATALYST,
})(PipelineEngine = exports.PipelineEngine || (exports.PipelineEngine = {}));
/**
 * The CDKPipeline class extends the Component class and sets up the necessary configuration for deploying AWS CDK (Cloud Development Kit) applications across multiple stages.
 * It also manages tasks such as publishing CDK assets, bumping version based on git tags, and cleaning up conflicting tasks.
 */
class CDKPipeline extends projen_1.Component {
    constructor(app, baseOptions) {
        super(app);
        this.app = app;
        this.baseOptions = baseOptions;
        // Add development dependencies
        this.app.addDevDeps('@types/standard-version', 'standard-version', 'cdk-assets');
        // this.app.addDeps(
        // );
        this.stackPrefix = baseOptions.stackPrefix ?? app.name;
        // Removes the compiled cloud assembly before each synth
        this.project.tasks.tryFind('synth')?.prependExec(`rm -rf ${this.app.cdkConfig.cdkout}`);
        this.project.tasks.tryFind('synth:silent')?.prependExec(`rm -rf ${this.app.cdkConfig.cdkout}`);
        // Remove tasks that might conflict with the pipeline process
        this.project.removeTask('deploy');
        this.project.removeTask('diff');
        this.project.removeTask('destroy');
        this.project.removeTask('watch');
        // Creates different deployment stages
        if (baseOptions.personalStage) {
            this.createPersonalStage();
        }
        if (baseOptions.featureStages) {
            this.createFeatureStage();
        }
        for (const stage of baseOptions.stages) {
            this.createPipelineStage(stage);
        }
        // Creates tasks to handle the release process
        this.createReleaseTasks();
        // Creates a specialized CDK App class
        this.createApplicationEntrypoint();
    }
    renderInstallCommands() {
        return [
            ...(this.baseOptions.preInstallCommands ?? []),
            `npx projen ${this.app.package.installCiTask.name}`,
        ];
    }
    renderInstallPackageCommands(packageName, runPreInstallCommands = false) {
        const commands = runPreInstallCommands ? this.baseOptions.preInstallCommands ?? [] : [];
        switch (this.app.package.packageManager) {
            case javascript_1.NodePackageManager.YARN:
            case javascript_1.NodePackageManager.YARN2:
            case javascript_1.NodePackageManager.YARN_BERRY:
            case javascript_1.NodePackageManager.YARN_CLASSIC:
                commands.push(`yarn add ${packageName}`);
                break;
            case javascript_1.NodePackageManager.NPM:
                commands.push(`npm install ${packageName}`);
                break;
            default:
                throw new Error('No install scripts for packageManager: ' + this.app.package.packageManager);
        }
        return commands;
    }
    renderSynthCommands() {
        return [
            ...this.renderInstallCommands(),
            ...(this.baseOptions.preSynthCommands ?? []),
            'npx projen build',
            ...(this.baseOptions.postSynthCommands ?? []),
        ];
    }
    getAssetUploadCommands(needsVersionedArtifacts) {
        return [
            ...this.renderInstallCommands(),
            'npx projen publish:assets',
            ...(needsVersionedArtifacts ? [
                'npx projen bump',
                'npx projen release:push-assembly',
            ] : []),
        ];
    }
    renderDeployCommands(stageName) {
        return [
            `npx projen deploy:${stageName}`,
        ];
    }
    renderDiffCommands(stageName) {
        return [
            `npx projen diff:${stageName}`,
        ];
    }
    /**
     * This method generates the entry point for the application, including interfaces and classes
     * necessary to set up the pipeline and define the AWS CDK stacks for different environments.
     */
    createApplicationEntrypoint() {
        let propsCode = '';
        let appCode = '';
        if (this.baseOptions.personalStage) {
            propsCode += `  /** This function will be used to generate a personal stack. */
  providePersonalStack: (app: App, stackId: string, props: PipelineAppStackProps) => Stack;
`;
            appCode += `    // If the environment variable USER is set and a function is provided for creating a personal stack, it is called with necessary arguments.
    if (props.providePersonalStack && process.env.USER) {
      const stageName = 'personal-' + process.env.USER.toLowerCase().replace(/\\\//g, '-');
      props.providePersonalStack(this, '${this.stackPrefix}-personal', { env: ${JSON.stringify(this.baseOptions.personalStage.env)}, stackName: \`${this.stackPrefix}-\${stageName}\`, stageName });
    }
`;
        }
        if (this.baseOptions.featureStages) {
            propsCode += `  /** This function will be used to generate a feature stack. */
  provideFeatureStack: (app: App, stackId: string, props: PipelineAppStackProps) => Stack;
`;
            appCode += `    // If the environment variable BRANCH is set and a function is provided for creating a feature stack, it is called with necessary arguments.
    if (props.provideFeatureStack && process.env.BRANCH) {
      const stageName = 'feature-' + process.env.BRANCH.toLowerCase().replace(/\\\//g, '-');
      props.provideFeatureStack(this, '${this.stackPrefix}-feature', { env: ${JSON.stringify(this.baseOptions.featureStages.env)}, stackName: \`${this.stackPrefix}-\${stageName}\`, stageName });
    }
`;
        }
        for (const stage of this.baseOptions.stages) {
            const nameUpperFirst = `${stage.name.charAt(0).toUpperCase()}${stage.name.substring(1)}`;
            propsCode += `  /** This function will be used to generate a ${stage.name} stack. */
  provide${nameUpperFirst}Stack: (app: App, stackId: string, props: PipelineAppStackProps) => Stack;
`;
            appCode += `    // If a function is provided for creating a ${stage.name} stack, it is called with necessary arguments.
    if (props.provide${nameUpperFirst}Stack) {
      props.provide${nameUpperFirst}Stack(this, '${this.stackPrefix}-${stage.name}', { env: ${JSON.stringify(stage.env)}, stackName: '${this.stackPrefix}-${stage.name}', stageName: '${stage.name}' });
    }
`;
        }
        const appFile = new projen_1.TextFile(this.project, `${this.app.srcdir}/app.ts`);
        appFile.addLine(`// ${common_1.PROJEN_MARKER}
/* eslint-disable */
import { App, AppProps, Stack, StackProps } from 'aws-cdk-lib';

/**
 * PipelineAppProps is an extension of AppProps, which is part of the AWS CDK core.
 * It includes optional functions to provide AWS Stacks for different stages.
 *
 * Use these functions to instantiate your application stacks with the parameters for
 * each stage
 */
export interface PipelineAppProps extends AppProps {
${propsCode}
}

/**
 * PipelineAppStackProps is an extension of StackProps, which is part of the AWS CDK core.
 * It includes an additional property to specify the stage name.
 */
export interface PipelineAppStackProps extends StackProps {
  stageName: string;
}

/**
 * The PipelineApp class extends the App class from AWS CDK and overrides the constructor to support
 * different stages of the application (development, production, personal, feature) by invoking the provided
 * stack-providing functions from the props.
 */
export class PipelineApp extends App {
  constructor(props: PipelineAppProps) {
    super(props);

${appCode}

  }
}
`);
    }
    /**
     * This method sets up tasks to publish CDK assets to all accounts and handle versioning, including bumping the version
     * based on the latest git tag and pushing the CDK assembly to the package repository.
     */
    createReleaseTasks() {
        // Task to publish the CDK assets to all accounts
        this.project.addTask('publish:assets', {
            steps: this.baseOptions.stages.map(stage => ({
                exec: `npx cdk-assets -p ${this.app.cdkConfig.cdkout}/${this.stackPrefix}-${stage.name}.assets.json publish`,
            })),
        });
        this.project.addTask('bump', {
            description: 'Bumps version based on latest git tag',
            steps: [
                {
                    exec: 'pipelines-release bump',
                },
                {
                    exec: 'git push --tags',
                },
            ],
        });
        this.project.addTask('release:push-assembly', {
            steps: [
                {
                    exec: `pipelines-release create-manifest "${this.app.cdkConfig.cdkout}"  "${this.baseOptions.pkgNamespace}"`,
                },
                {
                    cwd: this.app.cdkConfig.cdkout,
                    exec: 'npm version --no-git-tag-version from-git',
                },
                {
                    cwd: this.app.cdkConfig.cdkout,
                    exec: 'npm publish',
                },
            ],
        });
    }
    /**
     * This method sets up tasks for the personal deployment stage, including deployment, watching for changes,
     * comparing changes (diff), and destroying the stack when no longer needed.
     */
    createPersonalStage() {
        this.project.addTask('deploy:personal', {
            exec: `cdk deploy ${this.stackPrefix}-personal`,
        });
        this.project.addTask('watch:personal', {
            exec: `cdk deploy --watch --hotswap ${this.stackPrefix}-personal`,
        });
        this.project.addTask('diff:personal', {
            exec: `cdk diff ${this.stackPrefix}-personal`,
        });
        this.project.addTask('destroy:personal', {
            exec: `cdk destroy ${this.stackPrefix}-personal`,
        });
    }
    /**
     * This method sets up tasks for the feature deployment stage, including deployment, comparing changes (diff),
     * and destroying the stack when no longer needed.
     */
    createFeatureStage() {
        this.project.addTask('deploy:feature', {
            exec: `cdk --progress events --require-approval never deploy ${this.stackPrefix}-feature`,
        });
        this.project.addTask('diff:feature', {
            exec: `cdk diff ${this.stackPrefix}-feature`,
        });
        this.project.addTask('destroy:feature', {
            exec: `cdk destroy ${this.stackPrefix}-feature`,
        });
    }
    /**
     * This method sets up tasks for the general pipeline stages (dev, prod), including deployment and comparing changes (diff).
     * @param {DeployStageOptions} stage - The stage to create
     */
    createPipelineStage(stage) {
        this.project.addTask(`deploy:${stage.name}`, {
            exec: `cdk --app ${this.app.cdkConfig.cdkout} --progress events --require-approval never deploy ${this.stackPrefix}-${stage.name}`,
        });
        this.project.addTask(`diff:${stage.name}`, {
            exec: `cdk --app ${this.app.cdkConfig.cdkout} diff ${this.stackPrefix}-${stage.name}`,
        });
    }
}
exports.CDKPipeline = CDKPipeline;
_a = JSII_RTTI_SYMBOL_1;
CDKPipeline[_a] = { fqn: "projen-pipelines.CDKPipeline", version: "0.0.0" };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hd3NjZGsvYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLG1DQUFxRDtBQUNyRCw4Q0FBa0Q7QUFDbEQsc0RBQTJEO0FBdUIzRDs7O0dBR0c7QUFDSCxJQUFZLGNBT1g7QUFQRCxXQUFZLGNBQWM7SUFDeEIsNEJBQTRCO0lBQzVCLHVEQUFNLENBQUE7SUFDTixvQ0FBb0M7SUFDcEMsdURBQU0sQ0FBQTtJQUNOLDJDQUEyQztJQUMzQyxpQkFBaUI7QUFDbkIsQ0FBQyxFQVBXLGNBQWMsR0FBZCxzQkFBYyxLQUFkLHNCQUFjLFFBT3pCO0FBa0VEOzs7R0FHRztBQUNILE1BQXNCLFdBQVksU0FBUSxrQkFBUztJQUlqRCxZQUFzQixHQUErQixFQUFVLFdBQStCO1FBQzVGLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQURTLFFBQUcsR0FBSCxHQUFHLENBQTRCO1FBQVUsZ0JBQVcsR0FBWCxXQUFXLENBQW9CO1FBRzVGLCtCQUErQjtRQUMvQixJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FDakIseUJBQXlCLEVBQ3pCLGtCQUFrQixFQUNsQixZQUFZLENBQ2IsQ0FBQztRQUNGLG9CQUFvQjtRQUNwQixLQUFLO1FBRUwsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUMsV0FBVyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUM7UUFFdkQsd0RBQXdEO1FBQ3hELElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxXQUFXLENBQUMsVUFBVSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ3hGLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsRUFBRSxXQUFXLENBQUMsVUFBVSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMs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ckMsSUFBSSxFQUFFLHlEQUF5RCxJQUFJLENBQUMsV0FBVyxVQUFVO1NBQzFGLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLGNBQWMsRUFBRTtZQUNuQyxJQUFJLEVBQUUsWUFBWSxJQUFJLENBQUMsV0FBVyxVQUFVO1NBQzdDLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLGlCQUFpQixFQUFFO1lBQ3RDLElBQUksRUFBRSxlQUFlLElBQUksQ0FBQyxXQUFXLFVBQVU7U0FDaEQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7T0FHRztJQUNPLG1CQUFtQixDQUFDLEtBQXNCO1FBQ2xELElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsS0FBSyxDQUFDLElBQUksRUFBRSxFQUFFO1lBQzNDLElBQUksRUFBRSxhQUFhLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sc0RBQXNELElBQUksQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLElBQUksRUFBRTtTQUNuSSxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxRQUFRLEtBQUssQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUN6QyxJQUFJLEVBQUUsYUFBYSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLFNBQVMsSUFBSSxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFO1NBQ3RGLENBQUMsQ0FBQztJQUNMLENBQUM7O0FBcFJILGtDQXFSQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvbmVudCwgVGV4dEZpbGUsIGF3c2NkayB9IGZyb20gJ3Byb2plbic7XG5pbXBvcnQgeyBQUk9KRU5fTUFSS0VSIH0gZnJvbSAncHJvamVuL2xpYi9jb21tb24nO1xuaW1wb3J0IHsgTm9kZVBhY2thZ2VNYW5hZ2VyIH0gZnJvbSAncHJvamVuL2xpYi9qYXZhc2NyaXB0JztcblxuLyoqXG4gKiBUaGUgRW52aXJvbm1lbnQgaW50ZXJmYWNlIGlzIGRlc2lnbmVkIHRvIGhvbGQgQVdTIHJlbGF0ZWQgaW5mb3JtYXRpb25cbiAqIGZvciBhIHNwZWNpZmljIGRlcGxveW1lbnQgZW52aXJvbm1lbnQgd2l0aGluIHlvdXIgaW5mcmFzdHJ1Y3R1cmUuXG4gKiBFYWNoIGVudmlyb25tZW50IHJlcXVpcmVzIGEgc3BlY2lmaWMgYWNjb3VudCBhbmQgcmVnaW9uIGZvciBpdHMgcmVzb3VyY2VzLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEVudmlyb25tZW50IHtcbiAgLyoqXG4gICAqIFRoZSBBV1MgQWNjb3VudCBJRCBhc3NvY2lhdGVkIHdpdGggdGhlIGVudmlyb25tZW50LiBJdCdzIGltcG9ydGFudCBiZWNhdXNlXG4gICAqIGRpZmZlcmVudCBzZXJ2aWNlcyBvciBmZWF0dXJlcyBjb3VsZCBoYXZlIGRpc3RpbmN0IHBlcm1pc3Npb25zIGFuZCBzZXR0aW5nc1xuICAgKiBpbiBkaWZmZXJlbnQgYWNjb3VudHMuXG4gICAqL1xuICByZWFkb25seSBhY2NvdW50OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFRoZSBBV1MgUmVnaW9uIGZvciB0aGUgZW52aXJvbm1lbnQuIFRoaXMgZGV0ZXJtaW5lcyB3aGVyZSB5b3VyIHJlc291cmNlc1xuICAgKiBhcmUgY3JlYXRlZCBhbmQgd2hlcmUgeW91ciBhcHBsaWNhdGlvbiB3aWxsIHJ1bi4gSXQgY2FuIGFmZmVjdCBsYXRlbmN5LFxuICAgKiBhdmFpbGFiaWxpdHksIGFuZCBwcmljaW5nLlxuICAgKi9cbiAgcmVhZG9ubHkgcmVnaW9uOiBzdHJpbmc7XG59XG5cbi8qKlxuICogVGhlIENJL0NEIHRvb2xpbmcgdXNlZCB0byBydW4geW91ciBwaXBlbGluZS5cbiAqIFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgd29ya2Zsb3dzIGZvciB0aGUgZ2l2ZW4gc3lzdGVtXG4gKi9cbmV4cG9ydCBlbnVtIFBpcGVsaW5lRW5naW5lIHtcbiAgLyoqIENyZWF0ZSBHaXRIdWIgYWN0aW9ucyAqL1xuICBHSVRIVUIsXG4gIC8qKiBDcmVhdGUgYSAuZ2l0bGFiLWNpLnlhbWwgZmlsZSAqL1xuICBHSVRMQUIsXG4gIC8vIC8qKiBDcmVhdGUgQVdTIENvZGVDYXRhbHlzdCB3b3JrZmxvd3MgKi9cbiAgLy8gQ09ERV9DQVRBTFlTVCxcbn1cblxuLy8gLyoqXG4vLyAgKiBEZXNjcmliZXMgdGhlIHR5cGUgb2YgcGlwZWxpbmUgdGhhdCB3aWxsIGJlIGNyZWF0ZWRcbi8vICAqL1xuLy8gZXhwb3J0IGVudW0gRGVwbG95bWVudFR5cGUge1xuLy8gICAvKiogRGVwbG95IGV2ZXJ5IGNvbW1pdCBhcyBmYXIgYXMgcG9zc2libGU7IGhvcGVmdWxseSBpbnRvIHByb2R1Y3Rpb24gKi9cbi8vICAgQ09OVElOVU9VU19ERVBMT1lNRU5ULFxuLy8gICAvKiogQnVpbGQgZXZlcnkgY29tbWl0IGFuZCBwcmVwYXJlIGFsbCBhc3NldHMgZm9yIGEgbGF0ZXIgZGVwbG95bWVudCAqL1xuLy8gICBDT05USU5VT1VTX0RFTElWRVJZLFxuLy8gfVxuXG5leHBvcnQgaW50ZXJmYWNlIERlcGxveW1lbnRTdGFnZSB7XG4gIHJlYWRvbmx5IG5hbWU6IHN0cmluZztcbiAgcmVhZG9ubHkgZW52OiBFbnZpcm9ubWVudDtcbiAgcmVhZG9ubHkgbWFudWFsQXBwcm92YWw/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFN0YWdlT3B0aW9ucyB7XG4gIHJlYWRvbmx5IGVudjogRW52aXJvbm1lbnQ7XG59XG5cbi8qKlxuICogVGhlIENES1BpcGVsaW5lT3B0aW9ucyBpbnRlcmZhY2UgaXMgZGVzaWduZWQgdG8gcHJvdmlkZSBjb25maWd1cmF0aW9uXG4gKiBvcHRpb25zIGZvciBhIENESyAoQ2xvdWQgRGV2ZWxvcG1lbnQgS2l0KSBwaXBlbGluZS4gSXQgYWxsb3dzIHRoZSBkZWZpbml0aW9uXG4gKiBvZiBzZXR0aW5ncyBzdWNoIGFzIHRoZSBzdGFjayBwcmVmaXggYW5kIHBhY2thZ2UgbmFtZXNwYWNlIHRvIGJlIHVzZWQgaW4gdGhlXG4gKiBBV1Mgc3RhY2ssIGFsb25nIHdpdGggdGhlIGVudmlyb25tZW50cyBjb25maWd1cmF0aW9uIHRvIGJlIHVzZWQuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ0RLUGlwZWxpbmVPcHRpb25zIHtcblxuICAvKipcbiAgICogVGhpcyBmaWVsZCBpcyB1c2VkIHRvIGRlZmluZSBhIHByZWZpeCBmb3IgdGhlIEFXUyBTdGFjayByZXNvdXJjZXMgY3JlYXRlZFxuICAgKiBkdXJpbmcgdGhlIHBpcGVsaW5lJ3Mgb3BlcmF0aW9uLlxuICAgKlxuICAgKiBAZGVmYXVsdCBwcm9qZWN0IG5hbWVcbiAgICovXG4gIHJlYWRvbmx5IHN0YWNrUHJlZml4Pzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBUaGlzIGZpZWxkIGRldGVybWluZXMgdGhlIE5QTSBuYW1lc3BhY2UgdG8gYmUgdXNlZCB3aGVuIHBhY2thZ2luZyBDREsgY2xvdWRcbiAgICogYXNzZW1ibGllcy4gQSBuYW1lc3BhY2UgaGVscHMgZ3JvdXAgcmVsYXRlZCByZXNvdXJjZXMgdG9nZXRoZXIsIHByb3ZpZGluZ1xuICAgKiBiZXR0ZXIgb3JnYW5pemF0aW9uIGFuZCBlYXNlIG9mIG1hbmFnZW1lbnQuXG4gICAqL1xuICByZWFkb25seSBwa2dOYW1lc3BhY2U6IHN0cmluZztcblxuICByZWFkb25seSBzdGFnZXM6IERlcGxveW1lbnRTdGFnZVtdO1xuXG4gIHJlYWRvbmx5IHBlcnNvbmFsU3RhZ2U/OiBTdGFnZU9wdGlvbnM7XG5cbiAgcmVhZG9ubHkgZmVhdHVyZVN0YWdlcz86IFN0YWdlT3B0aW9ucztcblxuICAvLyAvKipcbiAgLy8gICogVGhpcyBmaWVsZCBzcGVjaWZpZXMgdGhlIHR5cGUgb2YgcGlwZWxpbmUgdG8gY3JlYXRlLiBJZiBzZXQgdG8gQ09OVElOVU9VU19ERVBMT1lNRU5ULFxuICAvLyAgKiBldmVyeSBjb21taXQgaXMgZGVwbG95ZWQgYXMgZmFyIGFzIHBvc3NpYmxlLCBob3BlZnVsbHkgaW50byBwcm9kdWN0aW9uLiBJZiBzZXQgdG9cbiAgLy8gICogQ09OVElOVU9VU19ERUxJVkVSWSwgZXZlcnkgY29tbWl0IGlzIGJ1aWx0IGFuZCBhbGwgYXNzZXRzIGFyZSBwcmVwYXJlZCBmb3IgYSBsYXRlciBkZXBsb3ltZW50LlxuICAvLyAgKlxuICAvLyAgKiBAZGVmYXVsdCBDT05USU5VT1VTX0RFTElWRVJZXG4gIC8vICAqL1xuICAvLyByZWFkb25seSBkZXBsb3ltZW50VHlwZT86IERlcGxveW1lbnRUeXBlO1xuXG4gIHJlYWRvbmx5IHByZUluc3RhbGxDb21tYW5kcz86IHN0cmluZ1tdO1xuICByZWFkb25seSBwcmVTeW50aENvbW1hbmRzPzogc3RyaW5nW107XG4gIHJlYWRvbmx5IHBvc3RTeW50aENvbW1hbmRzPzogc3RyaW5nW107XG5cbn1cblxuLyoqXG4gKiBUaGUgQ0RLUGlwZWxpbmUgY2xhc3MgZXh0ZW5kcyB0aGUgQ29tcG9uZW50IGNsYXNzIGFuZCBzZXRzIHVwIHRoZSBuZWNlc3NhcnkgY29uZmlndXJhdGlvbiBmb3IgZGVwbG95aW5nIEFXUyBDREsgKENsb3VkIERldmVsb3BtZW50IEtpdCkgYXBwbGljYXRpb25zIGFjcm9zcyBtdWx0aXBsZSBzdGFnZXMuXG4gKiBJdCBhbHNvIG1hbmFnZXMgdGFza3Mgc3VjaCBhcyBwdWJsaXNoaW5nIENESyBhc3NldHMsIGJ1bXBpbmcgdmVyc2lvbiBiYXNlZCBvbiBnaXQgdGFncywgYW5kIGNsZWFuaW5nIHVwIGNvbmZsaWN0aW5nIHRhc2tzLlxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQ0RLUGlwZWxpbmUgZXh0ZW5kcyBDb21wb25lbnQge1xuXG4gIHB1YmxpYyByZWFkb25seSBzdGFja1ByZWZpeDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCBhcHA6IGF3c2Nkay5Bd3NDZGtUeXBlU2NyaXB0QXBwLCBwcml2YXRlIGJhc2VPcHRpb25zOiBDREtQaXBlbGluZU9wdGlvbnMpIHtcbiAgICBzdXBlcihhcHApO1xuXG4gICAgLy8gQWRkIGRldmVsb3BtZW50IGRlcGVuZGVuY2llc1xuICAgIHRoaXMuYXBwLmFkZERldkRlcHMoXG4gICAgICAnQHR5cGVzL3N0YW5kYXJkLXZlcnNpb24nLFxuICAgICAgJ3N0YW5kYXJkLXZlcnNpb24nLFxuICAgICAgJ2Nkay1hc3NldHMnLFxuICAgICk7XG4gICAgLy8gdGhpcy5hcHAuYWRkRGVwcyhcbiAgICAvLyApO1xuXG4gICAgdGhpcy5zdGFja1ByZWZpeCA9IGJhc2VPcHRpb25zLnN0YWNrUHJlZml4ID8/IGFwcC5uYW1lO1xuXG4gICAgLy8gUmVtb3ZlcyB0aGUgY29tcGlsZWQgY2xvdWQgYXNzZW1ibHkgYmVmb3JlIGVhY2ggc3ludGhcbiAgICB0aGlzLnByb2plY3QudGFza3MudHJ5RmluZCgnc3ludGgnKT8ucHJlcGVuZEV4ZWMoYHJtIC1yZiAke3RoaXMuYXBwLmNka0NvbmZpZy5jZGtvdXR9YCk7XG4gICAgdGhpcy5wcm9qZWN0LnRhc2tzLnRyeUZpbmQoJ3N5bnRoOnNpbGVudCcpPy5wcmVwZW5kRXhlYyhgcm0gLXJmICR7dGhpcy5hcHAuY2RrQ29uZmlnLmNka291dH1gKTtcblxuICAgIC8vIFJlbW92ZSB0YXNrcyB0aGF0IG1pZ2h0IGNvbmZsaWN0IHdpdGggdGhlIHBpcGVsaW5lIHByb2Nlc3NcbiAgICB0aGlzLnByb2plY3QucmVtb3ZlVGFzaygnZGVwbG95Jyk7XG4gICAgdGhpcy5wcm9qZWN0LnJlbW92ZVRhc2soJ2RpZmYnKTtcbiAgICB0aGlzLnByb2plY3QucmVtb3ZlVGFzaygnZGVzdHJveScpO1xuICAgIHRoaXMucHJvamVjdC5yZW1vdmVUYXNrKCd3YXRjaCcpO1xuXG4gICAgLy8gQ3JlYXRlcyBkaWZmZXJlbnQgZGVwbG95bWVudCBzdGFnZXNcbiAgICBpZiAoYmFzZU9wdGlvbnMucGVyc29uYWxTdGFnZSkge1xuICAgICAgdGhpcy5jcmVhdGVQZXJzb25hbFN0YWdlKCk7XG4gICAgfVxuICAgIGlmIChiYXNlT3B0aW9ucy5mZWF0dXJlU3RhZ2VzKSB7XG4gICAgICB0aGlzLmNyZWF0ZUZlYXR1cmVTdGFnZSgpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHN0YWdlIG9mIGJhc2VPcHRpb25zLnN0YWdlcykge1xuICAgICAgdGhpcy5jcmVhdGVQaXBlbGluZVN0YWdlKHN0YWdlKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGVzIHRhc2tzIHRvIGhhbmRsZSB0aGUgcmVsZWFzZSBwcm9jZXNzXG4gICAgdGhpcy5jcmVhdGVSZWxlYXNlVGFza3MoKTtcblxuICAgIC8vIENyZWF0ZXMgYSBzcGVjaWFsaXplZCBDREsgQXBwIGNsYXNzXG4gICAgdGhpcy5jcmVhdGVBcHBsaWNhdGlvbkVudHJ5cG9pbnQoKTtcblxuICB9XG5cbiAgcHJvdGVjdGVkIHJlbmRlckluc3RhbGxDb21tYW5kcygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIC4uLih0aGlzLmJhc2VPcHRpb25zLnByZUluc3RhbGxDb21tYW5kcyA/PyBbXSksXG4gICAgICBgbnB4IHByb2plbiAke3RoaXMuYXBwLnBhY2thZ2UuaW5zdGFsbENpVGFzay5uYW1lfWAsXG4gICAgXTtcbiAgfVxuXG4gIHByb3RlY3RlZCByZW5kZXJJbnN0YWxsUGFja2FnZUNvbW1hbmRzKHBhY2thZ2VOYW1lOiBzdHJpbmcsIHJ1blByZUluc3RhbGxDb21tYW5kczogYm9vbGVhbiA9IGZhbHNlKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IGNvbW1hbmRzID0gcnVuUHJlSW5zdGFsbENvbW1hbmRzID8gdGhpcy5iYXNlT3B0aW9ucy5wcmVJbnN0YWxsQ29tbWFuZHMgPz8gW10gOiBbXTtcblxuICAgIHN3aXRjaCAodGhpcy5hcHAucGFja2FnZS5wYWNrYWdlTWFuYWdlcikge1xuICAgICAgY2FzZSBOb2RlUGFja2FnZU1hbmFnZXIuWUFSTjpcbiAgICAgIGNhc2UgTm9kZVBhY2thZ2VNYW5hZ2VyLllBUk4yOlxuICAgICAgY2FzZSBOb2RlUGFja2FnZU1hbmFnZXIuWUFSTl9CRVJSWTpcbiAgICAgIGNhc2UgTm9kZVBhY2thZ2VNYW5hZ2VyLllBUk5fQ0xBU1NJQzpcbiAgICAgICAgY29tbWFuZHMucHVzaChgeWFybiBhZGQgJHtwYWNrYWdlTmFtZX1gKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIE5vZGVQYWNrYWdlTWFuYWdlci5OUE06XG4gICAgICAgIGNvbW1hbmRzLnB1c2goYG5wbSBpbnN0YWxsICR7cGFja2FnZU5hbWV9YCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBpbnN0YWxsIHNjcmlwdHMgZm9yIHBhY2thZ2VNYW5hZ2VyOiAnICsgdGhpcy5hcHAucGFja2FnZS5wYWNrYWdlTWFuYWdlcik7XG4gICAgfVxuICAgIHJldHVybiBjb21tYW5kcztcbiAgfVxuXG4gIHByb3RlY3RlZCByZW5kZXJTeW50aENvbW1hbmRzKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gW1xuICAgICAgLi4udGhpcy5yZW5kZXJJbnN0YWxsQ29tbWFuZHMoKSxcbiAgICAgIC4uLih0aGlzLmJhc2VPcHRpb25zLnByZVN5bnRoQ29tbWFuZHMgPz8gW10pLFxuICAgICAgJ25weCBwcm9qZW4gYnVpbGQnLFxuICAgICAgLi4uKHRoaXMuYmFzZU9wdGlvbnMucG9zdFN5bnRoQ29tbWFuZHMgPz8gW10pLFxuICAgIF07XG4gIH1cblxuICBwcm90ZWN0ZWQgZ2V0QXNzZXRVcGxvYWRDb21tYW5kcyhuZWVkc1ZlcnNpb25lZEFydGlmYWN0czogYm9vbGVhbik6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gW1xuICAgICAgLi4udGhpcy5yZW5kZXJJbnN0YWxsQ29tbWFuZHMoKSxcbiAgICAgICducHggcHJvamVuIHB1Ymxpc2g6YXNzZXRzJyxcbiAgICAgIC4uLihuZWVkc1ZlcnNpb25lZEFydGlmYWN0cyA/IFtcbiAgICAgICAgJ25weCBwcm9qZW4gYnVtcCcsXG4gICAgICAgICducHggcHJvamVuIHJlbGVhc2U6cHVzaC1hc3NlbWJseScsXG4gICAgICBdIDogW10pLFxuICAgIF07XG4gIH1cblxuICBwcm90ZWN0ZWQgcmVuZGVyRGVwbG95Q29tbWFuZHMoc3RhZ2VOYW1lOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIGBucHggcHJvamVuIGRlcGxveToke3N0YWdlTmFtZX1gLFxuICAgIF07XG4gIH1cblxuICBwcm90ZWN0ZWQgcmVuZGVyRGlmZkNvbW1hbmRzKHN0YWdlTmFtZTogc3RyaW5nKTogc3RyaW5nW10ge1xuICAgIHJldHVybiBbXG4gICAgICBgbnB4IHByb2plbiBkaWZmOiR7c3RhZ2VOYW1lfWAsXG4gICAgXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIG1ldGhvZCBnZW5lcmF0ZXMgdGhlIGVudHJ5IHBvaW50IGZvciB0aGUgYXBwbGljYXRpb24sIGluY2x1ZGluZyBpbnRlcmZhY2VzIGFuZCBjbGFzc2VzXG4gICAqIG5lY2Vzc2FyeSB0byBzZXQgdXAgdGhlIHBpcGVsaW5lIGFuZCBkZWZpbmUgdGhlIEFXUyBDREsgc3RhY2tzIGZvciBkaWZmZXJlbnQgZW52aXJvbm1lbnRzLlxuICAgKi9cbiAgcHJvdGVjdGVkIGNyZWF0ZUFwcGxpY2F0aW9uRW50cnlwb2ludCgpIHtcbiAgICBsZXQgcHJvcHNDb2RlID0gJyc7XG4gICAgbGV0IGFwcENvZGUgPSAnJztcblxuICAgIGlmICh0aGlzLmJhc2VPcHRpb25zLnBlcnNvbmFsU3RhZ2UpIHtcbiAgICAgIHByb3BzQ29kZSArPSBgICAvKiogVGhpcyBmdW5jdGlvbiB3aWxsIGJlIHVzZWQgdG8gZ2VuZXJhdGUgYSBwZXJzb25hbCBzdGFjay4gKi9cbiAgcHJvdmlkZVBlcnNvbmFsU3RhY2s6IChhcHA6IEFwcCwgc3RhY2tJZDogc3RyaW5nLCBwcm9wczogUGlwZWxpbmVBcHBTdGFja1Byb3BzKSA9PiBTdGFjaztcbmA7XG4gICAgICBhcHBDb2RlICs9IGAgICAgLy8gSWYgdGhlIGVudmlyb25tZW50IHZhcmlhYmxlIFVTRVIgaXMgc2V0IGFuZCBhIGZ1bmN0aW9uIGlzIHByb3ZpZGVkIGZvciBjcmVhdGluZyBhIHBlcnNvbmFsIHN0YWNrLCBpdCBpcyBjYWxsZWQgd2l0aCBuZWNlc3NhcnkgYXJndW1lbnRzLlxuICAgIGlmIChwcm9wcy5wcm92aWRlUGVyc29uYWxTdGFjayAmJiBwcm9jZXNzLmVudi5VU0VSKSB7XG4gICAgICBjb25zdCBzdGFnZU5hbWUgPSAncGVyc29uYWwtJyArIHByb2Nlc3MuZW52LlVTRVIudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9cXFxcXFwvL2csICctJyk7XG4gICAgICBwcm9wcy5wcm92aWRlUGVyc29uYWxTdGFjayh0aGlzLCAnJHt0aGlzLnN0YWNrUHJlZml4fS1wZXJzb25hbCcsIHsgZW52OiAke0pTT04uc3RyaW5naWZ5KHRoaXMuYmFzZU9wdGlvbnMucGVyc29uYWxTdGFnZS5lbnYpfSwgc3RhY2tOYW1lOiBcXGAke3RoaXMuc3RhY2tQcmVmaXh9LVxcJHtzdGFnZU5hbWV9XFxgLCBzdGFnZU5hbWUgfSk7XG4gICAgfVxuYDtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5iYXNlT3B0aW9ucy5mZWF0dXJlU3RhZ2VzKSB7XG4gICAgICBwcm9wc0NvZGUgKz0gYCAgLyoqIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSB1c2VkIHRvIGdlbmVyYXRlIGEgZmVhdHVyZSBzdGFjay4gKi9cbiAgcHJvdmlkZUZlYXR1cmVTdGFjazogKGFwcDogQXBwLCBzdGFja0lkOiBzdHJpbmcsIHByb3BzOiBQaXBlbGluZUFwcFN0YWNrUHJvcHMpID0+IFN0YWNrO1xuYDtcbiAgICAgIGFwcENvZGUgKz0gYCAgICAvLyBJZiB0aGUgZW52aXJvbm1lbnQgdmFyaWFibGUgQlJBTkNIIGlzIHNldCBhbmQgYSBmdW5jdGlvbiBpcyBwcm92aWRlZCBmb3IgY3JlYXRpbmcgYSBmZWF0dXJlIHN0YWNrLCBpdCBpcyBjYWxsZWQgd2l0aCBuZWNlc3NhcnkgYXJndW1lbnRzLlxuICAgIGlmIChwcm9wcy5wcm92aWRlRmVhdHVyZVN0YWNrICYmIHByb2Nlc3MuZW52LkJSQU5DSCkge1xuICAgICAgY29uc3Qgc3RhZ2VOYW1lID0gJ2ZlYXR1cmUtJyArIHByb2Nlc3MuZW52LkJSQU5DSC50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1xcXFxcXC8vZywgJy0nKTtcbiAgICAgIHByb3BzLnByb3ZpZGVGZWF0dXJlU3RhY2sodGhpcywgJyR7dGhpcy5zdGFja1ByZWZpeH0tZmVhdHVyZScsIHsgZW52OiAke0pTT04uc3RyaW5naWZ5KHRoaXMuYmFzZU9wdGlvbnMuZmVhdHVyZVN0YWdlcy5lbnYpfSwgc3RhY2tOYW1lOiBcXGAke3RoaXMuc3RhY2tQcmVmaXh9LVxcJHtzdGFnZU5hbWV9XFxgLCBzdGFnZU5hbWUgfSk7XG4gICAgfVxuYDtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHN0YWdlIG9mIHRoaXMuYmFzZU9wdGlvbnMuc3RhZ2VzKSB7XG4gICAgICBjb25zdCBuYW1lVXBwZXJGaXJzdCA9IGAke3N0YWdlLm5hbWUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCl9JHtzdGFnZS5uYW1lLnN1YnN0cmluZygxKX1gO1xuXG4gICAgICBwcm9wc0NvZGUgKz0gYCAgLyoqIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSB1c2VkIHRvIGdlbmVyYXRlIGEgJHtzdGFnZS5uYW1lfSBzdGFjay4gKi9cbiAgcHJvdmlkZSR7bmFtZVVwcGVyRmlyc3R9U3RhY2s6IChhcHA6IEFwcCwgc3RhY2tJZDogc3RyaW5nLCBwcm9wczogUGlwZWxpbmVBcHBTdGFja1Byb3BzKSA9PiBTdGFjaztcbmA7XG4gICAgICBhcHBDb2RlICs9IGAgICAgLy8gSWYgYSBmdW5jdGlvbiBpcyBwcm92aWRlZCBmb3IgY3JlYXRpbmcgYSAke3N0YWdlLm5hbWV9IHN0YWNrLCBpdCBpcyBjYWxsZWQgd2l0aCBuZWNlc3NhcnkgYXJndW1lbnRzLlxuICAgIGlmIChwcm9wcy5wcm92aWRlJHtuYW1lVXBwZXJGaXJzdH1TdGFjaykge1xuICAgICAgcHJvcHMucHJvdmlkZSR7bmFtZVVwcGVyRmlyc3R9U3RhY2sodGhpcywgJyR7dGhpcy5zdGFja1ByZWZpeH0tJHtzdGFnZS5uYW1lfScsIHsgZW52OiAke0pTT04uc3RyaW5naWZ5KHN0YWdlLmVudil9LCBzdGFja05hbWU6ICcke3RoaXMuc3RhY2tQcmVmaXh9LSR7c3RhZ2UubmFtZX0nLCBzdGFnZU5hbWU6ICcke3N0YWdlLm5hbWV9JyB9KTtcbiAgICB9XG5gO1xuICAgIH1cblxuICAgIGNvbnN0IGFwcEZpbGUgPSBuZXcgVGV4dEZpbGUodGhpcy5wcm9qZWN0LCBgJHt0aGlzLmFwcC5zcmNkaXJ9L2FwcC50c2ApO1xuICAgIGFwcEZpbGUuYWRkTGluZShgLy8gJHtQUk9KRU5fTUFSS0VSfVxuLyogZXNsaW50LWRpc2FibGUgKi9cbmltcG9ydCB7IEFwcCwgQXBwUHJvcHMsIFN0YWNrLCBTdGFja1Byb3BzIH0gZnJvbSAnYXdzLWNkay1saWInO1xuXG4vKipcbiAqIFBpcGVsaW5lQXBwUHJvcHMgaXMgYW4gZXh0ZW5zaW9uIG9mIEFwcFByb3BzLCB3aGljaCBpcyBwYXJ0IG9mIHRoZSBBV1MgQ0RLIGNvcmUuXG4gKiBJdCBpbmNsdWRlcyBvcHRpb25hbCBmdW5jdGlvbnMgdG8gcHJvdmlkZSBBV1MgU3RhY2tzIGZvciBkaWZmZXJlbnQgc3RhZ2VzLlxuICpcbiAqIFVzZSB0aGVzZSBmdW5jdGlvbnMgdG8gaW5zdGFudGlhdGUgeW91ciBhcHBsaWNhdGlvbiBzdGFja3Mgd2l0aCB0aGUgcGFyYW1ldGVycyBmb3JcbiAqIGVhY2ggc3RhZ2VcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQaXBlbGluZUFwcFByb3BzIGV4dGVuZHMgQXBwUHJvcHMge1xuJHtwcm9wc0NvZGV9XG59XG5cbi8qKlxuICogUGlwZWxpbmVBcHBTdGFja1Byb3BzIGlzIGFuIGV4dGVuc2lvbiBvZiBTdGFja1Byb3BzLCB3aGljaCBpcyBwYXJ0IG9mIHRoZSBBV1MgQ0RLIGNvcmUuXG4gKiBJdCBpbmNsdWRlcyBhbiBhZGRpdGlvbmFsIHByb3BlcnR5IHRvIHNwZWNpZnkgdGhlIHN0YWdlIG5hbWUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGlwZWxpbmVBcHBTdGFja1Byb3BzIGV4dGVuZHMgU3RhY2tQcm9wcyB7XG4gIHN0YWdlTmFtZTogc3RyaW5nO1xufVxuXG4vKipcbiAqIFRoZSBQaXBlbGluZUFwcCBjbGFzcyBleHRlbmRzIHRoZSBBcHAgY2xhc3MgZnJvbSBBV1MgQ0RLIGFuZCBvdmVycmlkZXMgdGhlIGNvbnN0cnVjdG9yIHRvIHN1cHBvcnRcbiAqIGRpZmZlcmVudCBzdGFnZXMgb2YgdGhlIGFwcGxpY2F0aW9uIChkZXZlbG9wbWVudCwgcHJvZHVjdGlvbiwgcGVyc29uYWwsIGZlYXR1cmUpIGJ5IGludm9raW5nIHRoZSBwcm92aWRlZFxuICogc3RhY2stcHJvdmlkaW5nIGZ1bmN0aW9ucyBmcm9tIHRoZSBwcm9wcy5cbiAqL1xuZXhwb3J0IGNsYXNzIFBpcGVsaW5lQXBwIGV4dGVuZHMgQXBwIHtcbiAgY29uc3RydWN0b3IocHJvcHM6IFBpcGVsaW5lQXBwUHJvcHMpIHtcbiAgICBzdXBlcihwcm9wcyk7XG5cbiR7YXBwQ29kZX1cblxuICB9XG59XG5gKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIG1ldGhvZCBzZXRzIHVwIHRhc2tzIHRvIHB1Ymxpc2ggQ0RLIGFzc2V0cyB0byBhbGwgYWNjb3VudHMgYW5kIGhhbmRsZSB2ZXJzaW9uaW5nLCBpbmNsdWRpbmcgYnVtcGluZyB0aGUgdmVyc2lvblxuICAgKiBiYXNlZCBvbiB0aGUgbGF0ZXN0IGdpdCB0YWcgYW5kIHB1c2hpbmcgdGhlIENESyBhc3NlbWJseSB0byB0aGUgcGFja2FnZSByZXBvc2l0b3J5LlxuICAgKi9cbiAgcHJvdGVjdGVkIGNyZWF0ZVJlbGVhc2VUYXNrcygpIHtcbiAgICAvLyBUYXNrIHRvIHB1Ymxpc2ggdGhlIENESyBhc3NldHMgdG8gYWxsIGFjY291bnRzXG4gICAgdGhpcy5wcm9qZWN0LmFkZFRhc2soJ3B1Ymxpc2g6YXNzZXRzJywge1xuICAgICAgc3RlcHM6IHRoaXMuYmFzZU9wdGlvbnMuc3RhZ2VzLm1hcChzdGFnZSA9PiAoe1xuICAgICAgICBleGVjOiBgbnB4IGNkay1hc3NldHMgLXAgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fS8ke3RoaXMuc3RhY2tQcmVmaXh9LSR7c3RhZ2UubmFtZX0uYXNzZXRzLmpzb24gcHVibGlzaGAsXG4gICAgICB9KSksXG4gICAgfSk7XG5cbiAgICB0aGlzLnByb2plY3QuYWRkVGFzaygnYnVtcCcsIHtcbiAgICAgIGRlc2NyaXB0aW9uOiAnQnVtcHMgdmVyc2lvbiBiYXNlZCBvbiBsYXRlc3QgZ2l0IHRhZycsXG4gICAgICBzdGVwczogW1xuICAgICAgICB7XG4gICAgICAgICAgZXhlYzogJ3BpcGVsaW5lcy1yZWxlYXNlIGJ1bXAnLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgZXhlYzogJ2dpdCBwdXNoIC0tdGFncycsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuICAgIHRoaXMucHJvamVjdC5hZGRUYXNrKCdyZWxlYXNlOnB1c2gtYXNzZW1ibHknLCB7XG4gICAgICBzdGVwczogW1xuICAgICAgICB7XG4gICAgICAgICAgZXhlYzogYHBpcGVsaW5lcy1yZWxlYXNlIGNyZWF0ZS1tYW5pZmVzdCBcIiR7dGhpcy5hcHAuY2RrQ29uZmlnLmNka291dH1cIiAgXCIke3RoaXMuYmFzZU9wdGlvbnMucGtnTmFtZXNwYWNlfVwiYCxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGN3ZDogdGhpcy5hcHAuY2RrQ29uZmlnLmNka291dCxcbiAgICAgICAgICBleGVjOiAnbnBtIHZlcnNpb24gLS1uby1naXQtdGFnLXZlcnNpb24gZnJvbS1naXQnLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgY3dkOiB0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0LFxuICAgICAgICAgIGV4ZWM6ICducG0gcHVibGlzaCcsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoaXMgbWV0aG9kIHNldHMgdXAgdGFza3MgZm9yIHRoZSBwZXJzb25hbCBkZXBsb3ltZW50IHN0YWdlLCBpbmNsdWRpbmcgZGVwbG95bWVudCwgd2F0Y2hpbmcgZm9yIGNoYW5nZXMsXG4gICAqIGNvbXBhcmluZyBjaGFuZ2VzIChkaWZmKSwgYW5kIGRlc3Ryb3lpbmcgdGhlIHN0YWNrIHdoZW4gbm8gbG9uZ2VyIG5lZWRlZC5cbiAgICovXG4gIHByb3RlY3RlZCBjcmVhdGVQZXJzb25hbFN0YWdlKCkge1xuICAgIHRoaXMucHJvamVjdC5hZGRUYXNrKCdkZXBsb3k6cGVyc29uYWwnLCB7XG4gICAgICBleGVjOiBgY2RrIGRlcGxveSAke3RoaXMuc3RhY2tQcmVmaXh9LXBlcnNvbmFsYCxcbiAgICB9KTtcbiAgICB0aGlzLnByb2plY3QuYWRkVGFzaygnd2F0Y2g6cGVyc29uYWwnLCB7XG4gICAgICBleGVjOiBgY2RrIGRlcGxveSAtLXdhdGNoIC0taG90c3dhcCAke3RoaXMuc3RhY2tQcmVmaXh9LXBlcnNvbmFsYCxcbiAgICB9KTtcbiAgICB0aGlzLnByb2plY3QuYWRkVGFzaygnZGlmZjpwZXJzb25hbCcsIHtcbiAgICAgIGV4ZWM6IGBjZGsgZGlmZiAke3RoaXMuc3RhY2tQcmVmaXh9LXBlcnNvbmFsYCxcbiAgICB9KTtcbiAgICB0aGlzLnByb2plY3QuYWRkVGFzaygnZGVzdHJveTpwZXJzb25hbCcsIHtcbiAgICAgIGV4ZWM6IGBjZGsgZGVzdHJveSAke3RoaXMuc3RhY2tQcmVmaXh9LXBlcnNvbmFsYCxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIG1ldGhvZCBzZXRzIHVwIHRhc2tzIGZvciB0aGUgZmVhdHVyZSBkZXBsb3ltZW50IHN0YWdlLCBpbmNsdWRpbmcgZGVwbG95bWVudCwgY29tcGFyaW5nIGNoYW5nZXMgKGRpZmYpLFxuICAgKiBhbmQgZGVzdHJveWluZyB0aGUgc3RhY2sgd2hlbiBubyBsb25nZXIgbmVlZGVkLlxuICAgKi9cbiAgcHJvdGVjdGVkIGNyZWF0ZUZlYXR1cmVTdGFnZSgpIHtcbiAgICB0aGlzLnByb2plY3QuYWRkVGFzaygnZGVwbG95OmZlYXR1cmUnLCB7XG4gICAgICBleGVjOiBgY2RrIC0tcHJvZ3Jlc3MgZXZlbnRzIC0tcmVxdWlyZS1hcHByb3ZhbCBuZXZlciBkZXBsb3kgJHt0aGlzLnN0YWNrUHJlZml4fS1mZWF0dXJlYCxcbiAgICB9KTtcbiAgICB0aGlzLnByb2plY3QuYWRkVGFzaygnZGlmZjpmZWF0dXJlJywge1xuICAgICAgZXhlYzogYGNkayBkaWZmICR7dGhpcy5zdGFja1ByZWZpeH0tZmVhdHVyZWAsXG4gICAgfSk7XG4gICAgdGhpcy5wcm9qZWN0LmFkZFRhc2soJ2Rlc3Ryb3k6ZmVhdHVyZScsIHtcbiAgICAgIGV4ZWM6IGBjZGsgZGVzdHJveSAke3RoaXMuc3RhY2tQcmVmaXh9LWZlYXR1cmVgLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoaXMgbWV0aG9kIHNldHMgdXAgdGFza3MgZm9yIHRoZSBnZW5lcmFsIHBpcGVsaW5lIHN0YWdlcyAoZGV2LCBwcm9kKSwgaW5jbHVkaW5nIGRlcGxveW1lbnQgYW5kIGNvbXBhcmluZyBjaGFuZ2VzIChkaWZmKS5cbiAgICogQHBhcmFtIHtEZXBsb3lTdGFnZU9wdGlvbnN9IHN0YWdlIC0gVGhlIHN0YWdlIHRvIGNyZWF0ZVxuICAgKi9cbiAgcHJvdGVjdGVkIGNyZWF0ZVBpcGVsaW5lU3RhZ2Uoc3RhZ2U6IERlcGxveW1lbnRTdGFnZSkge1xuICAgIHRoaXMucHJvamVjdC5hZGRUYXNrKGBkZXBsb3k6JHtzdGFnZS5uYW1lfWAsIHtcbiAgICAgIGV4ZWM6IGBjZGsgLS1hcHAgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fSAtLXByb2dyZXNzIGV2ZW50cyAtLXJlcXVpcmUtYXBwcm92YWwgbmV2ZXIgZGVwbG95ICR7dGhpcy5zdGFja1ByZWZpeH0tJHtzdGFnZS5uYW1lfWAsXG4gICAgfSk7XG4gICAgdGhpcy5wcm9qZWN0LmFkZFRhc2soYGRpZmY6JHtzdGFnZS5uYW1lfWAsIHtcbiAgICAgIGV4ZWM6IGBjZGsgLS1hcHAgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fSBkaWZmICR7dGhpcy5zdGFja1ByZWZpeH0tJHtzdGFnZS5uYW1lfWAsXG4gICAgfSk7XG4gIH1cbn0iXX0=