"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CDKPipeline = void 0;
const JSII_RTTI_SYMBOL_1 = Symbol.for("jsii.rtti");
const projen_1 = require("projen");
const common_1 = require("projen/lib/common");
const javascript_1 = require("projen/lib/javascript");
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
        this.project.gitignore.exclude('/cdk-outputs-*.json');
        this.stackPrefix = baseOptions.stackPrefix ?? app.name;
        this.branchName = baseOptions.branchName ?? 'main'; // TODO use defaultReleaseBranch of NodeProject
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
        for (const stage of (baseOptions.independentStages ?? [])) {
            this.createIndependentStage(stage);
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
            ...(this.baseOptions.preSynthCommands ?? []),
            'npx projen build',
            ...(this.baseOptions.postSynthCommands ?? []),
        ];
    }
    renderAssetUploadCommands(stageName) {
        return [
            `npx projen publish:assets${stageName ? `:${stageName}` : ''}`,
        ];
    }
    renderAssemblyUploadCommands() {
        return [
            'npx projen bump',
            'npx projen release:push-assembly',
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
    createSafeStageName(name) {
        // Remove non-alphanumeric characters and split into words
        const words = name.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/);
        // Capitalize the first letter of each word and join them
        return words.map((word) => {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join('');
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
      props.providePersonalStack(this, '${this.stackPrefix}-personal', { env: { account: '${this.baseOptions.personalStage.env.account}', region: '${this.baseOptions.personalStage.env.region}' }, stackName: \`${this.stackPrefix}-\${stageName}\`, stageName });
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
      props.provideFeatureStack(this, '${this.stackPrefix}-feature', { env: { account: '${this.baseOptions.featureStages.env.account}', region: '${this.baseOptions.featureStages.env.region}' }, stackName: \`${this.stackPrefix}-\${stageName}\`, stageName });
    }
`;
        }
        for (const stage of this.baseOptions.stages) {
            const nameUpperFirst = this.createSafeStageName(stage.name);
            propsCode += `  /** This function will be used to generate a ${stage.name} stack. */
  provide${nameUpperFirst}Stack: (app: App, stackId: string, props: PipelineAppStackProps) => Stack;
`;
            appCode += `    // If a function is provided for creating a ${stage.name} stack, it is called with necessary arguments.
    if (props.provide${nameUpperFirst}Stack) {
      props.provide${nameUpperFirst}Stack(this, '${this.stackPrefix}-${stage.name}', { env: { account: '${stage.env.account}', region: '${stage.env.region}' }, stackName: '${this.stackPrefix}-${stage.name}', stageName: '${stage.name}' });
    }
`;
        }
        for (const stage of (this.baseOptions.independentStages ?? [])) {
            const nameUpperFirst = this.createSafeStageName(stage.name);
            propsCode += `  /** This function will be used to generate a ${stage.name} stack. */
  provide${nameUpperFirst}Stack: (app: App, stackId: string, props: PipelineAppStackProps) => Stack;
`;
            appCode += `    // If a function is provided for creating a ${stage.name} stack, it is called with necessary arguments.
    if (props.provide${nameUpperFirst}Stack) {
      props.provide${nameUpperFirst}Stack(this, '${this.stackPrefix}-${stage.name}', { env: { account: '${stage.env.account}', region: '${stage.env.region}' }, stackName: '${this.stackPrefix}-${stage.name}', stageName: '${stage.name}' });
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
        const stages = [...this.baseOptions.stages, ...this.baseOptions.independentStages ?? []];
        // Task to publish the CDK assets to all accounts
        for (const stage of stages) {
            this.project.addTask(`publish:assets:${stage.name}`, {
                steps: [{
                        exec: `npx cdk-assets -p ${this.app.cdkConfig.cdkout}/${this.stackPrefix}-${stage.name}.assets.json publish`,
                    }],
            });
        }
        this.project.addTask('publish:assets', {
            steps: stages.map(stage => ({
                spawn: `publish:assets:${stage.name}`,
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
        const stackId = this.getCliStackPattern('personal');
        this.project.addTask('deploy:personal', {
            exec: `cdk deploy --outputs-file cdk-outputs-personal.json ${stackId}`,
        });
        this.project.addTask('watch:personal', {
            exec: `cdk deploy --outputs-file cdk-outputs-personal.json --watch --hotswap ${stackId}`,
        });
        this.project.addTask('diff:personal', {
            exec: `cdk diff ${stackId}`,
        });
        this.project.addTask('destroy:personal', {
            exec: `cdk destroy ${stackId}`,
        });
    }
    /**
     * This method sets up tasks for the feature deployment stage, including deployment, comparing changes (diff),
     * and destroying the stack when no longer needed.
     */
    createFeatureStage() {
        const stackId = this.getCliStackPattern('feature');
        this.project.addTask('deploy:feature', {
            exec: `cdk --outputs-file cdk-outputs-feature.json --progress events --require-approval never deploy ${stackId}`,
        });
        this.project.addTask('diff:feature', {
            exec: `cdk diff ${stackId}`,
        });
        this.project.addTask('destroy:feature', {
            exec: `cdk destroy ${stackId}`,
        });
        this.project.addTask('watch:feature', {
            exec: `cdk deploy --outputs-file cdk-outputs-feature.json --watch --hotswap ${stackId}`,
        });
    }
    /**
     * This method sets up tasks for the general pipeline stages (dev, prod), including deployment and comparing changes (diff).
     * @param {DeployStageOptions} stage - The stage to create
     */
    createPipelineStage(stage) {
        const stackId = this.getCliStackPattern(stage.name);
        this.project.addTask(`deploy:${stage.name}`, {
            exec: `cdk --app ${this.app.cdkConfig.cdkout} --outputs-file cdk-outputs-${stage.name}.json --progress events --require-approval never deploy ${stackId}`,
        });
        this.project.addTask(`diff:${stage.name}`, {
            exec: `cdk --app ${this.app.cdkConfig.cdkout} diff ${stackId}`,
        });
        if (stage.watchable) {
            this.project.addTask(`watch:${stage.name}`, {
                exec: `cdk deploy --outputs-file cdk-outputs-${stage.name}.json --watch --hotswap ${stackId}`,
            });
        }
    }
    /**
     * This method sets up tasks for the independent stages including deployment and comparing changes (diff).
     * @param {NamedStageOptions} stage - The stage to create
     */
    createIndependentStage(stage) {
        const stackId = this.getCliStackPattern(stage.name);
        this.project.addTask(`deploy:${stage.name}`, {
            exec: `cdk --app ${this.app.cdkConfig.cdkout} --outputs-file cdk-outputs-${stage.name}.json --progress events --require-approval never deploy ${stackId}`,
        });
        this.project.addTask(`diff:${stage.name}`, {
            exec: `cdk --app ${this.app.cdkConfig.cdkout} diff ${stackId}`,
        });
        if (stage.watchable) {
            this.project.addTask(`watch:${stage.name}`, {
                exec: `cdk deploy --outputs-file cdk-outputs-${stage.name}.json --watch --hotswap ${stackId}`,
            });
        }
    }
    getCliStackPattern(stage) {
        return this.baseOptions.deploySubStacks ? `${this.stackPrefix}-${stage} ${this.stackPrefix}-${stage}/*` : `${this.stackPrefix}-${stage}`;
    }
}
exports.CDKPipeline = CDKPipeline;
_a = JSII_RTTI_SYMBOL_1;
CDKPipeline[_a] = { fqn: "projen-pipelines.CDKPipeline", version: "0.0.0" };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hd3NjZGsvYmFzZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLG1DQUFxRDtBQUNyRCw4Q0FBa0Q7QUFDbEQsc0RBQTJEO0FBNkkzRDs7O0dBR0c7QUFDSCxNQUFzQixXQUFZLFNBQVEsa0JBQVM7SUFJakQsWUFBc0IsR0FBK0IsRUFBWSxXQUErQjtRQUM5RixLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFEUyxRQUFHLEdBQUgsR0FBRyxDQUE0QjtRQUFZLGdCQUFXLEdBQVgsV0FBVyxDQUFvQjtRQUc5RiwrQkFBK0I7UUFDL0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQ2pCLHlCQUF5QixFQUN6QixrQkFBa0IsRUFDbEIsWUFBWSxDQUNiLENBQUM7UUFDRixvQkFBb0I7UUFDcEIsS0FBSztRQUNMLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBRXRELElBQUksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDLFdBQVcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDO1FBQ3ZELElBQUksQ0FBQyxVQUFVLEdBQUcsV0FBVyxDQUFDLFVBQVUsSUFBSSxNQUFNLENBQUMsQ0FBQywrQ0FBK0M7UUFFbkcsd0RBQXdEO1FBQ3hELElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxXQUFXLENBQUMsVUFBVSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ3hGLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsRUFBRSxXQUFXLENBQUMsVUFBVSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBRS9GLDZEQUE2RDtRQUM3RCxJ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QUFTLENBQUMsTUFBTSxTQUFTLE9BQU8sRUFBRTtTQUMvRCxDQUFDLENBQUM7UUFDSCxJQUFJLEtBQUssQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNwQixJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEtBQUssQ0FBQyxJQUFJLEVBQUUsRUFBRTtnQkFDMUMsSUFBSSxFQUFFLHlDQUF5QyxLQUFLLENBQUMsSUFBSSwyQkFBMkIsT0FBTyxFQUFFO2FBQzlGLENBQUMsQ0FBQztRQUNMLENBQUM7SUFDSCxDQUFDO0lBRVMsa0JBQWtCLENBQUMsS0FBYTtRQUN4QyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxXQUFXLElBQUksS0FBSyxJQUFJLElBQUksQ0FBQyxXQUFXLElBQUksS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsSUFBSSxLQUFLLEVBQUUsQ0FBQztJQUMzSSxDQUFDOztBQTdWSCxrQ0E4VkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb25lbnQsIFRleHRGaWxlLCBhd3NjZGsgfSBmcm9tICdwcm9qZW4nO1xuaW1wb3J0IHsgUFJPSkVOX01BUktFUiB9IGZyb20gJ3Byb2plbi9saWIvY29tbW9uJztcbmltcG9ydCB7IE5vZGVQYWNrYWdlTWFuYWdlciB9IGZyb20gJ3Byb2plbi9saWIvamF2YXNjcmlwdCc7XG5pbXBvcnQgeyBQaXBlbGluZUVuZ2luZSB9IGZyb20gJy4uL2VuZ2luZSc7XG5pbXBvcnQgeyBQaXBlbGluZVN0ZXAgfSBmcm9tICcuLi9zdGVwcyc7XG5cbi8qKlxuICogVGhlIEVudmlyb25tZW50IGludGVyZmFjZSBpcyBkZXNpZ25lZCB0byBob2xkIEFXUyByZWxhdGVkIGluZm9ybWF0aW9uXG4gKiBmb3IgYSBzcGVjaWZpYyBkZXBsb3ltZW50IGVudmlyb25tZW50IHdpdGhpbiB5b3VyIGluZnJhc3RydWN0dXJlLlxuICogRWFjaCBlbnZpcm9ubWVudCByZXF1aXJlcyBhIHNwZWNpZmljIGFjY291bnQgYW5kIHJlZ2lvbiBmb3IgaXRzIHJlc291cmNlcy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBFbnZpcm9ubWVudCB7XG4gIC8qKlxuICAgKiBUaGUgQVdTIEFjY291bnQgSUQgYXNzb2NpYXRlZCB3aXRoIHRoZSBlbnZpcm9ubWVudC4gSXQncyBpbXBvcnRhbnQgYmVjYXVzZVxuICAgKiBkaWZmZXJlbnQgc2VydmljZXMgb3IgZmVhdHVyZXMgY291bGQgaGF2ZSBkaXN0aW5jdCBwZXJtaXNzaW9ucyBhbmQgc2V0dGluZ3NcbiAgICogaW4gZGlmZmVyZW50IGFjY291bnRzLlxuICAgKi9cbiAgcmVhZG9ubHkgYWNjb3VudDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBUaGUgQVdTIFJlZ2lvbiBmb3IgdGhlIGVudmlyb25tZW50LiBUaGlzIGRldGVybWluZXMgd2hlcmUgeW91ciByZXNvdXJjZXNcbiAgICogYXJlIGNyZWF0ZWQgYW5kIHdoZXJlIHlvdXIgYXBwbGljYXRpb24gd2lsbCBydW4uIEl0IGNhbiBhZmZlY3QgbGF0ZW5jeSxcbiAgICogYXZhaWxhYmlsaXR5LCBhbmQgcHJpY2luZy5cbiAgICovXG4gIHJlYWRvbmx5IHJlZ2lvbjogc3RyaW5nO1xufVxuXG4vLyAvKipcbi8vICAqIERlc2NyaWJlcyB0aGUgdHlwZSBvZiBwaXBlbGluZSB0aGF0IHdpbGwgYmUgY3JlYXRlZFxuLy8gICovXG4vLyBleHBvcnQgZW51bSBEZXBsb3ltZW50VHlwZSB7XG4vLyAgIC8qKiBEZXBsb3kgZXZlcnkgY29tbWl0IGFzIGZhciBhcyBwb3NzaWJsZTsgaG9wZWZ1bGx5IGludG8gcHJvZHVjdGlvbiAqL1xuLy8gICBDT05USU5VT1VTX0RFUExPWU1FTlQsXG4vLyAgIC8qKiBCdWlsZCBldmVyeSBjb21taXQgYW5kIHByZXBhcmUgYWxsIGFzc2V0cyBmb3IgYSBsYXRlciBkZXBsb3ltZW50ICovXG4vLyAgIENPTlRJTlVPVVNfREVMSVZFUlksXG4vLyB9XG5cbi8qKlxuICogT3B0aW9ucyBmb3Igc3RhZ2VzIHRoYXQgYXJlIHBhcnQgb2YgdGhlIHBpcGVsaW5lXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGVwbG95bWVudFN0YWdlIGV4dGVuZHMgTmFtZWRTdGFnZU9wdGlvbnMge1xuICByZWFkb25seSBtYW51YWxBcHByb3ZhbD86IGJvb2xlYW47XG59XG5cbi8qKlxuICogT3B0aW9ucyBmb3Igc3RhZ2VzIHRoYXQgYXJlIG5vdCBwYXJ0IG9mIHRoZSBwaXBlbGluZVxuICovXG5leHBvcnQgaW50ZXJmYWNlIEluZGVwZW5kZW50U3RhZ2UgZXh0ZW5kcyBOYW1lZFN0YWdlT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBUaGlzIHNwZWNpZmllcyB3aGV0aGVyIHRoZSBzdGFnZSBzaG91bGQgYmUgZGVwbG95ZWQgb24gcHVzaFxuICAgKlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgcmVhZG9ubHkgZGVwbG95T25QdXNoPzogYm9vbGVhbjtcblxuICByZWFkb25seSBwb3N0RGlmZlN0ZXBzPzogUGlwZWxpbmVTdGVwW107XG4gIHJlYWRvbmx5IHBvc3REZXBsb3lTdGVwcz86IFBpcGVsaW5lU3RlcFtdO1xufVxuXG4vKipcbiAqIE9wdGlvbnMgZm9yIGEgQ0RLIHN0YWdlIHdpdGggYSBuYW1lXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgTmFtZWRTdGFnZU9wdGlvbnMgZXh0ZW5kcyBTdGFnZU9wdGlvbnMge1xuICByZWFkb25seSBuYW1lOiBzdHJpbmc7XG4gIHJlYWRvbmx5IHdhdGNoYWJsZT86IGJvb2xlYW47XG59XG5cbi8qKlxuICogT3B0aW9ucyBmb3IgYSBDREsgc3RhZ2UgbGlrZSB0aGUgdGFyZ2V0IGVudmlyb25tZW50XG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3RhZ2VPcHRpb25zIHtcbiAgcmVhZG9ubHkgZW52OiBFbnZpcm9ubWVudDtcbn1cblxuLyoqXG4gKiBUaGUgQ0RLUGlwZWxpbmVPcHRpb25zIGludGVyZmFjZSBpcyBkZXNpZ25lZCB0byBwcm92aWRlIGNvbmZpZ3VyYXRpb25cbiAqIG9wdGlvbnMgZm9yIGEgQ0RLIChDbG91ZCBEZXZlbG9wbWVudCBLaXQpIHBpcGVsaW5lLiBJdCBhbGxvd3MgdGhlIGRlZmluaXRpb25cbiAqIG9mIHNldHRpbmdzIHN1Y2ggYXMgdGhlIHN0YWNrIHByZWZpeCBhbmQgcGFja2FnZSBuYW1lc3BhY2UgdG8gYmUgdXNlZCBpbiB0aGVcbiAqIEFXUyBzdGFjaywgYWxvbmcgd2l0aCB0aGUgZW52aXJvbm1lbnRzIGNvbmZpZ3VyYXRpb24gdG8gYmUgdXNlZC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDREtQaXBlbGluZU9wdGlvbnMge1xuXG4gIC8qKlxuICAgKiB0aGUgbmFtZSBvZiB0aGUgYnJhbmNoIHRvIGRlcGxveSBmcm9tXG4gICAqIEBkZWZhdWx0IG1haW5cbiAgICovXG4gIHJlYWRvbmx5IGJyYW5jaE5hbWU/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFRoaXMgZmllbGQgaXMgdXNlZCB0byBkZWZpbmUgYSBwcmVmaXggZm9yIHRoZSBBV1MgU3RhY2sgcmVzb3VyY2VzIGNyZWF0ZWRcbiAgICogZHVyaW5nIHRoZSBwaXBlbGluZSdzIG9wZXJhdGlvbi5cbiAgICpcbiAgICogQGRlZmF1bHQgcHJvamVjdCBuYW1lXG4gICAqL1xuICByZWFkb25seSBzdGFja1ByZWZpeD86IHN0cmluZztcblxuICAvKipcbiAgICogSWYgc2V0IHRvIHRydWUgYWxsIENESyBhY3Rpb25zIHdpbGwgYWxzbyBpbmNsdWRlIDxzdGFja05hbWU+LyogdG8gZGVwbG95L2RpZmYvZGVzdHJveSBzdWIgc3RhY2tzIG9mIHRoZSBtYWluIHN0YWNrLlxuICAgKiBZb3UgY2FuIHVzZSB0aGlzIHRvIGRlcGxveSBDRGsgYXBwbGljYXRpb25zIGNvbnRhaW5pbmcgbXVsdGlwbGUgc3RhY2tzLlxuICAgKlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgcmVhZG9ubHkgZGVwbG95U3ViU3RhY2tzPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogVGhpcyBmaWVsZCBkZXRlcm1pbmVzIHRoZSBOUE0gbmFtZXNwYWNlIHRvIGJlIHVzZWQgd2hlbiBwYWNrYWdpbmcgQ0RLIGNsb3VkXG4gICAqIGFzc2VtYmxpZXMuIEEgbmFtZXNwYWNlIGhlbHBzIGdyb3VwIHJlbGF0ZWQgcmVzb3VyY2VzIHRvZ2V0aGVyLCBwcm92aWRpbmdcbiAgICogYmV0dGVyIG9yZ2FuaXphdGlvbiBhbmQgZWFzZSBvZiBtYW5hZ2VtZW50LlxuICAgKi9cbiAgcmVhZG9ubHkgcGtnTmFtZXNwYWNlOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIFRoaXMgZmllbGQgc3BlY2lmaWVzIGEgbGlzdCBvZiBzdGFnZXMgdGhhdCBzaG91bGQgYmUgZGVwbG95ZWQgdXNpbmcgYSBDSS9DRCBwaXBlbGluZVxuICAgKi9cbiAgcmVhZG9ubHkgc3RhZ2VzOiBEZXBsb3ltZW50U3RhZ2VbXTtcblxuICAvKiogVGhpcyBzcGVjaWZpZXMgZGV0YWlscyBmb3IgaW5kZXBlbmRlbnQgc3RhZ2VzICovXG4gIHJlYWRvbmx5IGluZGVwZW5kZW50U3RhZ2VzPzogSW5kZXBlbmRlbnRTdGFnZVtdO1xuXG4gIC8qKiBUaGlzIHNwZWNpZmllcyBkZXRhaWxzIGZvciBhIHBlcnNvbmFsIHN0YWdlICovXG4gIHJlYWRvbmx5IHBlcnNvbmFsU3RhZ2U/OiBTdGFnZU9wdGlvbnM7XG5cbiAgLyoqIFRoaXMgc3BlY2lmaWVzIGRldGFpbHMgZm9yIGZlYXR1cmUgc3RhZ2VzICovXG4gIHJlYWRvbmx5IGZlYXR1cmVTdGFnZXM/OiBTdGFnZU9wdGlvbnM7XG5cbiAgLy8gLyoqXG4gIC8vICAqIFRoaXMgZmllbGQgc3BlY2lmaWVzIHRoZSB0eXBlIG9mIHBpcGVsaW5lIHRvIGNyZWF0ZS4gSWYgc2V0IHRvIENPTlRJTlVPVVNfREVQTE9ZTUVOVCxcbiAgLy8gICogZXZlcnkgY29tbWl0IGlzIGRlcGxveWVkIGFzIGZhciBhcyBwb3NzaWJsZSwgaG9wZWZ1bGx5IGludG8gcHJvZHVjdGlvbi4gSWYgc2V0IHRvXG4gIC8vICAqIENPTlRJTlVPVVNfREVMSVZFUlksIGV2ZXJ5IGNvbW1pdCBpcyBidWlsdCBhbmQgYWxsIGFzc2V0cyBhcmUgcHJlcGFyZWQgZm9yIGEgbGF0ZXIgZGVwbG95bWVudC5cbiAgLy8gICpcbiAgLy8gICogQGRlZmF1bHQgQ09OVElOVU9VU19ERUxJVkVSWVxuICAvLyAgKi9cbiAgLy8gcmVhZG9ubHkgZGVwbG95bWVudFR5cGU/OiBEZXBsb3ltZW50VHlwZTtcblxuICByZWFkb25seSBwcmVJbnN0YWxsQ29tbWFuZHM/OiBzdHJpbmdbXTtcbiAgcmVhZG9ubHkgcHJlU3ludGhDb21tYW5kcz86IHN0cmluZ1tdO1xuICByZWFkb25seSBwb3N0U3ludGhDb21tYW5kcz86IHN0cmluZ1tdO1xuXG4gIHJlYWRvbmx5IHByZUluc3RhbGxTdGVwcz86IFBpcGVsaW5lU3RlcFtdO1xuICByZWFkb25seSBwcmVTeW50aFN0ZXBzPzogUGlwZWxpbmVTdGVwW107XG4gIHJlYWRvbmx5IHBvc3RTeW50aFN0ZXBzPzogUGlwZWxpbmVTdGVwW107XG59XG5cbi8qKlxuICogVGhlIENES1BpcGVsaW5lIGNsYXNzIGV4dGVuZHMgdGhlIENvbXBvbmVudCBjbGFzcyBhbmQgc2V0cyB1cCB0aGUgbmVjZXNzYXJ5IGNvbmZpZ3VyYXRpb24gZm9yIGRlcGxveWluZyBBV1MgQ0RLIChDbG91ZCBEZXZlbG9wbWVudCBLaXQpIGFwcGxpY2F0aW9ucyBhY3Jvc3MgbXVsdGlwbGUgc3RhZ2VzLlxuICogSXQgYWxzbyBtYW5hZ2VzIHRhc2tzIHN1Y2ggYXMgcHVibGlzaGluZyBDREsgYXNzZXRzLCBidW1waW5nIHZlcnNpb24gYmFzZWQgb24gZ2l0IHRhZ3MsIGFuZCBjbGVhbmluZyB1cCBjb25mbGljdGluZyB0YXNrcy5cbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIENES1BpcGVsaW5lIGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgcHVibGljIHJlYWRvbmx5IHN0YWNrUHJlZml4OiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkb25seSBicmFuY2hOYW1lOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IocHJvdGVjdGVkIGFwcDogYXdzY2RrLkF3c0Nka1R5cGVTY3JpcHRBcHAsIHByb3RlY3RlZCBiYXNlT3B0aW9uczogQ0RLUGlwZWxpbmVPcHRpb25zKSB7XG4gICAgc3VwZXIoYXBwKTtcblxuICAgIC8vIEFkZCBkZXZlbG9wbWVudCBkZXBlbmRlbmNpZXNcbiAgICB0aGlzLmFwcC5hZGREZXZEZXBzKFxuICAgICAgJ0B0eXBlcy9zdGFuZGFyZC12ZXJzaW9uJyxcbiAgICAgICdzdGFuZGFyZC12ZXJzaW9uJyxcbiAgICAgICdjZGstYXNzZXRzJyxcbiAgICApO1xuICAgIC8vIHRoaXMuYXBwLmFkZERlcHMoXG4gICAgLy8gKTtcbiAgICB0aGlzLnByb2plY3QuZ2l0aWdub3JlLmV4Y2x1ZGUoJy9jZGstb3V0cHV0cy0qLmpzb24nKTtcblxuICAgIHRoaXMuc3RhY2tQcmVmaXggPSBiYXNlT3B0aW9ucy5zdGFja1ByZWZpeCA/PyBhcHAubmFtZTtcbiAgICB0aGlzLmJyYW5jaE5hbWUgPSBiYXNlT3B0aW9ucy5icmFuY2hOYW1lID8/ICdtYWluJzsgLy8gVE9ETyB1c2UgZGVmYXVsdFJlbGVhc2VCcmFuY2ggb2YgTm9kZVByb2plY3RcblxuICAgIC8vIFJlbW92ZXMgdGhlIGNvbXBpbGVkIGNsb3VkIGFzc2VtYmx5IGJlZm9yZSBlYWNoIHN5bnRoXG4gICAgdGhpcy5wcm9qZWN0LnRhc2tzLnRyeUZpbmQoJ3N5bnRoJyk/LnByZXBlbmRFeGVjKGBybSAtcmYgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fWApO1xuICAgIHRoaXMucHJvamVjdC50YXNrcy50cnlGaW5kKCdzeW50aDpzaWxlbnQnKT8ucHJlcGVuZEV4ZWMoYHJtIC1yZiAke3RoaXMuYXBwLmNka0NvbmZpZy5jZGtvdXR9YCk7XG5cbiAgICAvLyBSZW1vdmUgdGFza3MgdGhhdCBtaWdodCBjb25mbGljdCB3aXRoIHRoZSBwaXBlbGluZSBwcm9jZXNzXG4gICAgdGhpcy5wcm9qZWN0LnJlbW92ZVRhc2soJ2RlcGxveScpO1xuICAgIHRoaXMucHJvamVjdC5yZW1vdmVUYXNrKCdkaWZmJyk7XG4gICAgdGhpcy5wcm9qZWN0LnJlbW92ZVRhc2soJ2Rlc3Ryb3knKTtcbiAgICB0aGlzLnByb2plY3QucmVtb3ZlVGFzaygnd2F0Y2gnKTtcblxuICAgIC8vIENyZWF0ZXMgZGlmZmVyZW50IGRlcGxveW1lbnQgc3RhZ2VzXG4gICAgaWYgKGJhc2VPcHRpb25zLnBlcnNvbmFsU3RhZ2UpIHtcbiAgICAgIHRoaXMuY3JlYXRlUGVyc29uYWxTdGFnZSgpO1xuICAgIH1cbiAgICBpZiAoYmFzZU9wdGlvbnMuZmVhdHVyZVN0YWdlcykge1xuICAgICAgdGhpcy5jcmVhdGVGZWF0dXJlU3RhZ2UoKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBzdGFnZSBvZiBiYXNlT3B0aW9ucy5zdGFnZXMpIHtcbiAgICAgIHRoaXMuY3JlYXRlUGlwZWxpbmVTdGFnZShzdGFnZSk7XG4gICAgfVxuICAgIGZvciAoY29uc3Qgc3RhZ2Ugb2YgKGJhc2VPcHRpb25zLmluZGVwZW5kZW50U3RhZ2VzID8/IFtdKSkge1xuICAgICAgdGhpcy5jcmVhdGVJbmRlcGVuZGVudFN0YWdlKHN0YWdlKTtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGVzIHRhc2tzIHRvIGhhbmRsZSB0aGUgcmVsZWFzZSBwcm9jZXNzXG4gICAgdGhpcy5jcmVhdGVSZWxlYXNlVGFza3MoKTtcblxuICAgIC8vIENyZWF0ZXMgYSBzcGVjaWFsaXplZCBDREsgQXBwIGNsYXNzXG4gICAgdGhpcy5jcmVhdGVBcHBsaWNhdGlvbkVudHJ5cG9pbnQoKTtcblxuICB9XG5cbiAgcHVibGljIGFic3RyYWN0IGVuZ2luZVR5cGUoKTogUGlwZWxpbmVFbmdpbmU7XG5cbiAgcHJvdGVjdGVkIHJlbmRlckluc3RhbGxDb21tYW5kcygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIC4uLih0aGlzLmJhc2VPcHRpb25zLnByZUluc3RhbGxDb21tYW5kcyA/PyBbXSksXG4gICAgICBgbnB4IHByb2plbiAke3RoaXMuYXBwLnBhY2thZ2UuaW5zdGFsbENpVGFzay5uYW1lfWAsXG4gICAgXTtcbiAgfVxuXG4gIHByb3RlY3RlZCByZW5kZXJJbnN0YWxsUGFja2FnZUNvbW1hbmRzKHBhY2thZ2VOYW1lOiBzdHJpbmcsIHJ1blByZUluc3RhbGxDb21tYW5kczogYm9vbGVhbiA9IGZhbHNlKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IGNvbW1hbmRzID0gcnVuUHJlSW5zdGFsbENvbW1hbmRzID8gdGhpcy5iYXNlT3B0aW9ucy5wcmVJbnN0YWxsQ29tbWFuZHMgPz8gW10gOiBbXTtcblxuICAgIHN3aXRjaCAodGhpcy5hcHAucGFja2FnZS5wYWNrYWdlTWFuYWdlcikge1xuICAgICAgY2FzZSBOb2RlUGFja2FnZU1hbmFnZXIuWUFSTjpcbiAgICAgIGNhc2UgTm9kZVBhY2thZ2VNYW5hZ2VyLllBUk4yOlxuICAgICAgY2FzZSBOb2RlUGFja2FnZU1hbmFnZXIuWUFSTl9CRVJSWTpcbiAgICAgIGNhc2UgTm9kZVBhY2thZ2VNYW5hZ2VyLllBUk5fQ0xBU1NJQzpcbiAgICAgICAgY29tbWFuZHMucHVzaChgeWFybiBhZGQgJHtwYWNrYWdlTmFtZX1gKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIE5vZGVQYWNrYWdlTWFuYWdlci5OUE06XG4gICAgICAgIGNvbW1hbmRzLnB1c2goYG5wbSBpbnN0YWxsICR7cGFja2FnZU5hbWV9YCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBpbnN0YWxsIHNjcmlwdHMgZm9yIHBhY2thZ2VNYW5hZ2VyOiAnICsgdGhpcy5hcHAucGFja2FnZS5wYWNrYWdlTWFuYWdlcik7XG4gICAgfVxuICAgIHJldHVybiBjb21tYW5kcztcbiAgfVxuXG4gIHByb3RlY3RlZCByZW5kZXJTeW50aENvbW1hbmRzKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gW1xuICAgICAgLi4uKHRoaXMuYmFzZU9wdGlvbnMucHJlU3ludGhDb21tYW5kcyA/PyBbXSksXG4gICAgICAnbnB4IHByb2plbiBidWlsZCcsXG4gICAgICAuLi4odGhpcy5iYXNlT3B0aW9ucy5wb3N0U3ludGhDb21tYW5kcyA/PyBbXSksXG4gICAgXTtcbiAgfVxuXG4gIHByb3RlY3RlZCByZW5kZXJBc3NldFVwbG9hZENvbW1hbmRzKHN0YWdlTmFtZT86IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gW1xuICAgICAgYG5weCBwcm9qZW4gcHVibGlzaDphc3NldHMke3N0YWdlTmFtZSA/IGA6JHtzdGFnZU5hbWV9YCA6ICcnfWAsXG4gICAgXTtcbiAgfVxuXG4gIHByb3RlY3RlZCByZW5kZXJBc3NlbWJseVVwbG9hZENvbW1hbmRzKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gW1xuICAgICAgJ25weCBwcm9qZW4gYnVtcCcsXG4gICAgICAnbnB4IHByb2plbiByZWxlYXNlOnB1c2gtYXNzZW1ibHknLFxuICAgIF07XG4gIH1cblxuICBwcm90ZWN0ZWQgcmVuZGVyRGVwbG95Q29tbWFuZHMoc3RhZ2VOYW1lOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIGBucHggcHJvamVuIGRlcGxveToke3N0YWdlTmFtZX1gLFxuICAgIF07XG4gIH1cblxuICBwcm90ZWN0ZWQgcmVuZGVyRGlmZkNvbW1hbmRzKHN0YWdlTmFtZTogc3RyaW5nKTogc3RyaW5nW10ge1xuICAgIHJldHVybiBbXG4gICAgICBgbnB4IHByb2plbiBkaWZmOiR7c3RhZ2VOYW1lfWAsXG4gICAgXTtcbiAgfVxuXG4gIHByb3RlY3RlZCBjcmVhdGVTYWZlU3RhZ2VOYW1lKG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgLy8gUmVtb3ZlIG5vbi1hbHBoYW51bWVyaWMgY2hhcmFjdGVycyBhbmQgc3BsaXQgaW50byB3b3Jkc1xuICAgIGNvbnN0IHdvcmRzID0gbmFtZS5yZXBsYWNlKC9bXmEtekEtWjAtOV0rL2csICcgJykudHJpbSgpLnNwbGl0KC9cXHMrLyk7XG5cbiAgICAvLyBDYXBpdGFsaXplIHRoZSBmaXJzdCBsZXR0ZXIgb2YgZWFjaCB3b3JkIGFuZCBqb2luIHRoZW1cbiAgICByZXR1cm4gd29yZHMubWFwKCh3b3JkKSA9PiB7XG4gICAgICByZXR1cm4gd29yZC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHdvcmQuc2xpY2UoMSkudG9Mb3dlckNhc2UoKTtcbiAgICB9KS5qb2luKCcnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIG1ldGhvZCBnZW5lcmF0ZXMgdGhlIGVudHJ5IHBvaW50IGZvciB0aGUgYXBwbGljYXRpb24sIGluY2x1ZGluZyBpbnRlcmZhY2VzIGFuZCBjbGFzc2VzXG4gICAqIG5lY2Vzc2FyeSB0byBzZXQgdXAgdGhlIHBpcGVsaW5lIGFuZCBkZWZpbmUgdGhlIEFXUyBDREsgc3RhY2tzIGZvciBkaWZmZXJlbnQgZW52aXJvbm1lbnRzLlxuICAgKi9cbiAgcHJvdGVjdGVkIGNyZWF0ZUFwcGxpY2F0aW9uRW50cnlwb2ludCgpIHtcbiAgICBsZXQgcHJvcHNDb2RlID0gJyc7XG4gICAgbGV0IGFwcENvZGUgPSAnJztcblxuICAgIGlmICh0aGlzLmJhc2VPcHRpb25zLnBlcnNvbmFsU3RhZ2UpIHtcbiAgICAgIHByb3BzQ29kZSArPSBgICAvKiogVGhpcyBmdW5jdGlvbiB3aWxsIGJlIHVzZWQgdG8gZ2VuZXJhdGUgYSBwZXJzb25hbCBzdGFjay4gKi9cbiAgcHJvdmlkZVBlcnNvbmFsU3RhY2s6IChhcHA6IEFwcCwgc3RhY2tJZDogc3RyaW5nLCBwcm9wczogUGlwZWxpbmVBcHBTdGFja1Byb3BzKSA9PiBTdGFjaztcbmA7XG4gICAgICBhcHBDb2RlICs9IGAgICAgLy8gSWYgdGhlIGVudmlyb25tZW50IHZhcmlhYmxlIFVTRVIgaXMgc2V0IGFuZCBhIGZ1bmN0aW9uIGlzIHByb3ZpZGVkIGZvciBjcmVhdGluZyBhIHBlcnNvbmFsIHN0YWNrLCBpdCBpcyBjYWxsZWQgd2l0aCBuZWNlc3NhcnkgYXJndW1lbnRzLlxuICAgIGlmIChwcm9wcy5wcm92aWRlUGVyc29uYWxTdGFjayAmJiBwcm9jZXNzLmVudi5VU0VSKSB7XG4gICAgICBjb25zdCBzdGFnZU5hbWUgPSAncGVyc29uYWwtJyArIHByb2Nlc3MuZW52LlVTRVIudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9cXFxcXFwvL2csICctJyk7XG4gICAgICBwcm9wcy5wcm92aWRlUGVyc29uYWxTdGFjayh0aGlzLCAnJHt0aGlzLnN0YWNrUHJlZml4fS1wZXJzb25hbCcsIHsgZW52OiB7IGFjY291bnQ6ICcke3RoaXMuYmFzZU9wdGlvbnMucGVyc29uYWxTdGFnZS5lbnYuYWNjb3VudH0nLCByZWdpb246ICcke3RoaXMuYmFzZU9wdGlvbnMucGVyc29uYWxTdGFnZS5lbnYucmVnaW9ufScgfSwgc3RhY2tOYW1lOiBcXGAke3RoaXMuc3RhY2tQcmVmaXh9LVxcJHtzdGFnZU5hbWV9XFxgLCBzdGFnZU5hbWUgfSk7XG4gICAgfVxuYDtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5iYXNlT3B0aW9ucy5mZWF0dXJlU3RhZ2VzKSB7XG4gICAgICBwcm9wc0NvZGUgKz0gYCAgLyoqIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSB1c2VkIHRvIGdlbmVyYXRlIGEgZmVhdHVyZSBzdGFjay4gKi9cbiAgcHJvdmlkZUZlYXR1cmVTdGFjazogKGFwcDogQXBwLCBzdGFja0lkOiBzdHJpbmcsIHByb3BzOiBQaXBlbGluZUFwcFN0YWNrUHJvcHMpID0+IFN0YWNrO1xuYDtcbiAgICAgIGFwcENvZGUgKz0gYCAgICAvLyBJZiB0aGUgZW52aXJvbm1lbnQgdmFyaWFibGUgQlJBTkNIIGlzIHNldCBhbmQgYSBmdW5jdGlvbiBpcyBwcm92aWRlZCBmb3IgY3JlYXRpbmcgYSBmZWF0dXJlIHN0YWNrLCBpdCBpcyBjYWxsZWQgd2l0aCBuZWNlc3NhcnkgYXJndW1lbnRzLlxuICAgIGlmIChwcm9wcy5wcm92aWRlRmVhdHVyZVN0YWNrICYmIHByb2Nlc3MuZW52LkJSQU5DSCkge1xuICAgICAgY29uc3Qgc3RhZ2VOYW1lID0gJ2ZlYXR1cmUtJyArIHByb2Nlc3MuZW52LkJSQU5DSC50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1xcXFxcXC8vZywgJy0nKTtcbiAgICAgIHByb3BzLnByb3ZpZGVGZWF0dXJlU3RhY2sodGhpcywgJyR7dGhpcy5zdGFja1ByZWZpeH0tZmVhdHVyZScsIHsgZW52OiB7IGFjY291bnQ6ICcke3RoaXMuYmFzZU9wdGlvbnMuZmVhdHVyZVN0YWdlcy5lbnYuYWNjb3VudH0nLCByZWdpb246ICcke3RoaXMuYmFzZU9wdGlvbnMuZmVhdHVyZVN0YWdlcy5lbnYucmVnaW9ufScgfSwgc3RhY2tOYW1lOiBcXGAke3RoaXMuc3RhY2tQcmVmaXh9LVxcJHtzdGFnZU5hbWV9XFxgLCBzdGFnZU5hbWUgfSk7XG4gICAgfVxuYDtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHN0YWdlIG9mIHRoaXMuYmFzZU9wdGlvbnMuc3RhZ2VzKSB7XG4gICAgICBjb25zdCBuYW1lVXBwZXJGaXJzdCA9IHRoaXMuY3JlYXRlU2FmZVN0YWdlTmFtZShzdGFnZS5uYW1lKTtcblxuICAgICAgcHJvcHNDb2RlICs9IGAgIC8qKiBUaGlzIGZ1bmN0aW9uIHdpbGwgYmUgdXNlZCB0byBnZW5lcmF0ZSBhICR7c3RhZ2UubmFtZX0gc3RhY2suICovXG4gIHByb3ZpZGUke25hbWVVcHBlckZpcnN0fVN0YWNrOiAoYXBwOiBBcHAsIHN0YWNrSWQ6IHN0cmluZywgcHJvcHM6IFBpcGVsaW5lQXBwU3RhY2tQcm9wcykgPT4gU3RhY2s7XG5gO1xuICAgICAgYXBwQ29kZSArPSBgICAgIC8vIElmIGEgZnVuY3Rpb24gaXMgcHJvdmlkZWQgZm9yIGNyZWF0aW5nIGEgJHtzdGFnZS5uYW1lfSBzdGFjaywgaXQgaXMgY2FsbGVkIHdpdGggbmVjZXNzYXJ5IGFyZ3VtZW50cy5cbiAgICBpZiAocHJvcHMucHJvdmlkZSR7bmFtZVVwcGVyRmlyc3R9U3RhY2spIHtcbiAgICAgIHByb3BzLnByb3ZpZGUke25hbWVVcHBlckZpcnN0fVN0YWNrKHRoaXMsICcke3RoaXMuc3RhY2tQcmVmaXh9LSR7c3RhZ2UubmFtZX0nLCB7IGVudjogeyBhY2NvdW50OiAnJHtzdGFnZS5lbnYuYWNjb3VudH0nLCByZWdpb246ICcke3N0YWdlLmVudi5yZWdpb259JyB9LCBzdGFja05hbWU6ICcke3RoaXMuc3RhY2tQcmVmaXh9LSR7c3RhZ2UubmFtZX0nLCBzdGFnZU5hbWU6ICcke3N0YWdlLm5hbWV9JyB9KTtcbiAgICB9XG5gO1xuICAgIH1cblxuICAgIGZvciAoY29uc3Qgc3RhZ2Ugb2YgKHRoaXMuYmFzZU9wdGlvbnMuaW5kZXBlbmRlbnRTdGFnZXMgPz8gW10pKSB7XG4gICAgICBjb25zdCBuYW1lVXBwZXJGaXJzdCA9IHRoaXMuY3JlYXRlU2FmZVN0YWdlTmFtZShzdGFnZS5uYW1lKTtcblxuICAgICAgcHJvcHNDb2RlICs9IGAgIC8qKiBUaGlzIGZ1bmN0aW9uIHdpbGwgYmUgdXNlZCB0byBnZW5lcmF0ZSBhICR7c3RhZ2UubmFtZX0gc3RhY2suICovXG4gIHByb3ZpZGUke25hbWVVcHBlckZpcnN0fVN0YWNrOiAoYXBwOiBBcHAsIHN0YWNrSWQ6IHN0cmluZywgcHJvcHM6IFBpcGVsaW5lQXBwU3RhY2tQcm9wcykgPT4gU3RhY2s7XG5gO1xuICAgICAgYXBwQ29kZSArPSBgICAgIC8vIElmIGEgZnVuY3Rpb24gaXMgcHJvdmlkZWQgZm9yIGNyZWF0aW5nIGEgJHtzdGFnZS5uYW1lfSBzdGFjaywgaXQgaXMgY2FsbGVkIHdpdGggbmVjZXNzYXJ5IGFyZ3VtZW50cy5cbiAgICBpZiAocHJvcHMucHJvdmlkZSR7bmFtZVVwcGVyRmlyc3R9U3RhY2spIHtcbiAgICAgIHByb3BzLnByb3ZpZGUke25hbWVVcHBlckZpcnN0fVN0YWNrKHRoaXMsICcke3RoaXMuc3RhY2tQcmVmaXh9LSR7c3RhZ2UubmFtZX0nLCB7IGVudjogeyBhY2NvdW50OiAnJHtzdGFnZS5lbnYuYWNjb3VudH0nLCByZWdpb246ICcke3N0YWdlLmVudi5yZWdpb259JyB9LCBzdGFja05hbWU6ICcke3RoaXMuc3RhY2tQcmVmaXh9LSR7c3RhZ2UubmFtZX0nLCBzdGFnZU5hbWU6ICcke3N0YWdlLm5hbWV9JyB9KTtcbiAgICB9XG5gO1xuICAgIH1cblxuICAgIGNvbnN0IGFwcEZpbGUgPSBuZXcgVGV4dEZpbGUodGhpcy5wcm9qZWN0LCBgJHt0aGlzLmFwcC5zcmNkaXJ9L2FwcC50c2ApO1xuICAgIGFwcEZpbGUuYWRkTGluZShgLy8gJHtQUk9KRU5fTUFSS0VSfVxuLyogZXNsaW50LWRpc2FibGUgKi9cbmltcG9ydCB7IEFwcCwgQXBwUHJvcHMsIFN0YWNrLCBTdGFja1Byb3BzIH0gZnJvbSAnYXdzLWNkay1saWInO1xuXG4vKipcbiAqIFBpcGVsaW5lQXBwUHJvcHMgaXMgYW4gZXh0ZW5zaW9uIG9mIEFwcFByb3BzLCB3aGljaCBpcyBwYXJ0IG9mIHRoZSBBV1MgQ0RLIGNvcmUuXG4gKiBJdCBpbmNsdWRlcyBvcHRpb25hbCBmdW5jdGlvbnMgdG8gcHJvdmlkZSBBV1MgU3RhY2tzIGZvciBkaWZmZXJlbnQgc3RhZ2VzLlxuICpcbiAqIFVzZSB0aGVzZSBmdW5jdGlvbnMgdG8gaW5zdGFudGlhdGUgeW91ciBhcHBsaWNhdGlvbiBzdGFja3Mgd2l0aCB0aGUgcGFyYW1ldGVycyBmb3JcbiAqIGVhY2ggc3RhZ2VcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQaXBlbGluZUFwcFByb3BzIGV4dGVuZHMgQXBwUHJvcHMge1xuJHtwcm9wc0NvZGV9XG59XG5cbi8qKlxuICogUGlwZWxpbmVBcHBTdGFja1Byb3BzIGlzIGFuIGV4dGVuc2lvbiBvZiBTdGFja1Byb3BzLCB3aGljaCBpcyBwYXJ0IG9mIHRoZSBBV1MgQ0RLIGNvcmUuXG4gKiBJdCBpbmNsdWRlcyBhbiBhZGRpdGlvbmFsIHByb3BlcnR5IHRvIHNwZWNpZnkgdGhlIHN0YWdlIG5hbWUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGlwZWxpbmVBcHBTdGFja1Byb3BzIGV4dGVuZHMgU3RhY2tQcm9wcyB7XG4gIHN0YWdlTmFtZTogc3RyaW5nO1xufVxuXG4vKipcbiAqIFRoZSBQaXBlbGluZUFwcCBjbGFzcyBleHRlbmRzIHRoZSBBcHAgY2xhc3MgZnJvbSBBV1MgQ0RLIGFuZCBvdmVycmlkZXMgdGhlIGNvbnN0cnVjdG9yIHRvIHN1cHBvcnRcbiAqIGRpZmZlcmVudCBzdGFnZXMgb2YgdGhlIGFwcGxpY2F0aW9uIChkZXZlbG9wbWVudCwgcHJvZHVjdGlvbiwgcGVyc29uYWwsIGZlYXR1cmUpIGJ5IGludm9raW5nIHRoZSBwcm92aWRlZFxuICogc3RhY2stcHJvdmlkaW5nIGZ1bmN0aW9ucyBmcm9tIHRoZSBwcm9wcy5cbiAqL1xuZXhwb3J0IGNsYXNzIFBpcGVsaW5lQXBwIGV4dGVuZHMgQXBwIHtcbiAgY29uc3RydWN0b3IocHJvcHM6IFBpcGVsaW5lQXBwUHJvcHMpIHtcbiAgICBzdXBlcihwcm9wcyk7XG5cbiR7YXBwQ29kZX1cblxuICB9XG59XG5gKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIG1ldGhvZCBzZXRzIHVwIHRhc2tzIHRvIHB1Ymxpc2ggQ0RLIGFzc2V0cyB0byBhbGwgYWNjb3VudHMgYW5kIGhhbmRsZSB2ZXJzaW9uaW5nLCBpbmNsdWRpbmcgYnVtcGluZyB0aGUgdmVyc2lvblxuICAgKiBiYXNlZCBvbiB0aGUgbGF0ZXN0IGdpdCB0YWcgYW5kIHB1c2hpbmcgdGhlIENESyBhc3NlbWJseSB0byB0aGUgcGFja2FnZSByZXBvc2l0b3J5LlxuICAgKi9cbiAgcHJvdGVjdGVkIGNyZWF0ZVJlbGVhc2VUYXNrcygpIHtcbiAgICBjb25zdCBzdGFnZXMgPSBbLi4udGhpcy5iYXNlT3B0aW9ucy5zdGFnZXMsIC4uLnRoaXMuYmFzZU9wdGlvbnMuaW5kZXBlbmRlbnRTdGFnZXMgPz8gW11dO1xuICAgIC8vIFRhc2sgdG8gcHVibGlzaCB0aGUgQ0RLIGFzc2V0cyB0byBhbGwgYWNjb3VudHNcbiAgICBmb3IgKGNvbnN0IHN0YWdlIG9mIHN0YWdlcykge1xuICAgICAgdGhpcy5wcm9qZWN0LmFkZFRhc2soYHB1Ymxpc2g6YXNzZXRzOiR7c3RhZ2UubmFtZX1gLCB7XG4gICAgICAgIHN0ZXBzOiBbe1xuICAgICAgICAgIGV4ZWM6IGBucHggY2RrLWFzc2V0cyAtcCAke3RoaXMuYXBwLmNka0NvbmZpZy5jZGtvdXR9LyR7dGhpcy5zdGFja1ByZWZpeH0tJHtzdGFnZS5uYW1lfS5hc3NldHMuanNvbiBwdWJsaXNoYCxcbiAgICAgICAgfV0sXG4gICAgICB9KTtcbiAgICB9XG4gICAgdGhpcy5wcm9qZWN0LmFkZFRhc2soJ3B1Ymxpc2g6YXNzZXRzJywge1xuICAgICAgc3RlcHM6IHN0YWdlcy5tYXAoc3RhZ2UgPT4gKHtcbiAgICAgICAgc3Bhd246IGBwdWJsaXNoOmFzc2V0czoke3N0YWdlLm5hbWV9YCxcbiAgICAgIH0pKSxcbiAgICB9KTtcblxuICAgIHRoaXMucHJvamVjdC5hZGRUYXNrKCdidW1wJywge1xuICAgICAgZGVzY3JpcHRpb246ICdCdW1wcyB2ZXJzaW9uIGJhc2VkIG9uIGxhdGVzdCBnaXQgdGFnJyxcbiAgICAgIHN0ZXBzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBleGVjOiAncGlwZWxpbmVzLXJlbGVhc2UgYnVtcCcsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBleGVjOiAnZ2l0IHB1c2ggLS10YWdzJyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gICAgdGhpcy5wcm9qZWN0LmFkZFRhc2soJ3JlbGVhc2U6cHVzaC1hc3NlbWJseScsIHtcbiAgICAgIHN0ZXBzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBleGVjOiBgcGlwZWxpbmVzLXJlbGVhc2UgY3JlYXRlLW1hbmlmZXN0IFwiJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fVwiICBcIiR7dGhpcy5iYXNlT3B0aW9ucy5wa2dOYW1lc3BhY2V9XCJgLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgY3dkOiB0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0LFxuICAgICAgICAgIGV4ZWM6ICducG0gdmVyc2lvbiAtLW5vLWdpdC10YWctdmVyc2lvbiBmcm9tLWdpdCcsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBjd2Q6IHRoaXMuYXBwLmNka0NvbmZpZy5jZGtvdXQsXG4gICAgICAgICAgZXhlYzogJ25wbSBwdWJsaXNoJyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBtZXRob2Qgc2V0cyB1cCB0YXNrcyBmb3IgdGhlIHBlcnNvbmFsIGRlcGxveW1lbnQgc3RhZ2UsIGluY2x1ZGluZyBkZXBsb3ltZW50LCB3YXRjaGluZyBmb3IgY2hhbmdlcyxcbiAgICogY29tcGFyaW5nIGNoYW5nZXMgKGRpZmYpLCBhbmQgZGVzdHJveWluZyB0aGUgc3RhY2sgd2hlbiBubyBsb25nZXIgbmVlZGVkLlxuICAgKi9cbiAgcHJvdGVjdGVkIGNyZWF0ZVBlcnNvbmFsU3RhZ2UoKSB7XG4gICAgY29uc3Qgc3RhY2tJZCA9IHRoaXMuZ2V0Q2xpU3RhY2tQYXR0ZXJuKCdwZXJzb25hbCcpO1xuICAgIHRoaXMucHJvamVjdC5hZGRUYXNrKCdkZXBsb3k6cGVyc29uYWwnLCB7XG4gICAgICBleGVjOiBgY2RrIGRlcGxveSAtLW91dHB1dHMtZmlsZSBjZGstb3V0cHV0cy1wZXJzb25hbC5qc29uICR7c3RhY2tJZH1gLFxuICAgIH0pO1xuICAgIHRoaXMucHJvamVjdC5hZGRUYXNrKCd3YXRjaDpwZXJzb25hbCcsIHtcbiAgICAgIGV4ZWM6IGBjZGsgZGVwbG95IC0tb3V0cHV0cy1maWxlIGNkay1vdXRwdXRzLXBlcnNvbmFsLmpzb24gLS13YXRjaCAtLWhvdHN3YXAgJHtzdGFja0lkfWAsXG4gICAgfSk7XG4gICAgdGhpcy5wcm9qZWN0LmFkZFRhc2soJ2RpZmY6cGVyc29uYWwnLCB7XG4gICAgICBleGVjOiBgY2RrIGRpZmYgJHtzdGFja0lkfWAsXG4gICAgfSk7XG4gICAgdGhpcy5wcm9qZWN0LmFkZFRhc2soJ2Rlc3Ryb3k6cGVyc29uYWwnLCB7XG4gICAgICBleGVjOiBgY2RrIGRlc3Ryb3kgJHtzdGFja0lkfWAsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBtZXRob2Qgc2V0cyB1cCB0YXNrcyBmb3IgdGhlIGZlYXR1cmUgZGVwbG95bWVudCBzdGFnZSwgaW5jbHVkaW5nIGRlcGxveW1lbnQsIGNvbXBhcmluZyBjaGFuZ2VzIChkaWZmKSxcbiAgICogYW5kIGRlc3Ryb3lpbmcgdGhlIHN0YWNrIHdoZW4gbm8gbG9uZ2VyIG5lZWRlZC5cbiAgICovXG4gIHByb3RlY3RlZCBjcmVhdGVGZWF0dXJlU3RhZ2UoKSB7XG4gICAgY29uc3Qgc3RhY2tJZCA9IHRoaXMuZ2V0Q2xpU3RhY2tQYXR0ZXJuKCdmZWF0dXJlJyk7XG4gICAgdGhpcy5wcm9qZWN0LmFkZFRhc2soJ2RlcGxveTpmZWF0dXJlJywge1xuICAgICAgZXhlYzogYGNkayAtLW91dHB1dHMtZmlsZSBjZGstb3V0cHV0cy1mZWF0dXJlLmpzb24gLS1wcm9ncmVzcyBldmVudHMgLS1yZXF1aXJlLWFwcHJvdmFsIG5ldmVyIGRlcGxveSAke3N0YWNrSWR9YCxcbiAgICB9KTtcbiAgICB0aGlzLnByb2plY3QuYWRkVGFzaygnZGlmZjpmZWF0dXJlJywge1xuICAgICAgZXhlYzogYGNkayBkaWZmICR7c3RhY2tJZH1gLFxuICAgIH0pO1xuICAgIHRoaXMucHJvamVjdC5hZGRUYXNrKCdkZXN0cm95OmZlYXR1cmUnLCB7XG4gICAgICBleGVjOiBgY2RrIGRlc3Ryb3kgJHtzdGFja0lkfWAsXG4gICAgfSk7XG4gICAgdGhpcy5wcm9qZWN0LmFkZFRhc2soJ3dhdGNoOmZlYXR1cmUnLCB7XG4gICAgICBleGVjOiBgY2RrIGRlcGxveSAtLW91dHB1dHMtZmlsZSBjZGstb3V0cHV0cy1mZWF0dXJlLmpzb24gLS13YXRjaCAtLWhvdHN3YXAgJHtzdGFja0lkfWAsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBtZXRob2Qgc2V0cyB1cCB0YXNrcyBmb3IgdGhlIGdlbmVyYWwgcGlwZWxpbmUgc3RhZ2VzIChkZXYsIHByb2QpLCBpbmNsdWRpbmcgZGVwbG95bWVudCBhbmQgY29tcGFyaW5nIGNoYW5nZXMgKGRpZmYpLlxuICAgKiBAcGFyYW0ge0RlcGxveVN0YWdlT3B0aW9uc30gc3RhZ2UgLSBUaGUgc3RhZ2UgdG8gY3JlYXRlXG4gICAqL1xuICBwcm90ZWN0ZWQgY3JlYXRlUGlwZWxpbmVTdGFnZShzdGFnZTogRGVwbG95bWVudFN0YWdlKSB7XG4gICAgY29uc3Qgc3RhY2tJZCA9IHRoaXMuZ2V0Q2xpU3RhY2tQYXR0ZXJuKHN0YWdlLm5hbWUpO1xuICAgIHRoaXMucHJvamVjdC5hZGRUYXNrKGBkZXBsb3k6JHtzdGFnZS5uYW1lfWAsIHtcbiAgICAgIGV4ZWM6IGBjZGsgLS1hcHAgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fSAtLW91dHB1dHMtZmlsZSBjZGstb3V0cHV0cy0ke3N0YWdlLm5hbWV9Lmpzb24gLS1wcm9ncmVzcyBldmVudHMgLS1yZXF1aXJlLWFwcHJvdmFsIG5ldmVyIGRlcGxveSAke3N0YWNrSWR9YCxcbiAgICB9KTtcbiAgICB0aGlzLnByb2plY3QuYWRkVGFzayhgZGlmZjoke3N0YWdlLm5hbWV9YCwge1xuICAgICAgZXhlYzogYGNkayAtLWFwcCAke3RoaXMuYXBwLmNka0NvbmZpZy5jZGtvdXR9IGRpZmYgJHtzdGFja0lkfWAsXG4gICAgfSk7XG4gICAgaWYgKHN0YWdlLndhdGNoYWJsZSkge1xuICAgICAgdGhpcy5wcm9qZWN0LmFkZFRhc2soYHdhdGNoOiR7c3RhZ2UubmFtZX1gLCB7XG4gICAgICAgIGV4ZWM6IGBjZGsgZGVwbG95IC0tb3V0cHV0cy1maWxlIGNkay1vdXRwdXRzLSR7c3RhZ2UubmFtZX0uanNvbiAtLXdhdGNoIC0taG90c3dhcCAke3N0YWNrSWR9YCxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUaGlzIG1ldGhvZCBzZXRzIHVwIHRhc2tzIGZvciB0aGUgaW5kZXBlbmRlbnQgc3RhZ2VzIGluY2x1ZGluZyBkZXBsb3ltZW50IGFuZCBjb21wYXJpbmcgY2hhbmdlcyAoZGlmZikuXG4gICAqIEBwYXJhbSB7TmFtZWRTdGFnZU9wdGlvbnN9IHN0YWdlIC0gVGhlIHN0YWdlIHRvIGNyZWF0ZVxuICAgKi9cbiAgcHJvdGVjdGVkIGNyZWF0ZUluZGVwZW5kZW50U3RhZ2Uoc3RhZ2U6IEluZGVwZW5kZW50U3RhZ2UpIHtcbiAgICBjb25zdCBzdGFja0lkID0gdGhpcy5nZXRDbGlTdGFja1BhdHRlcm4oc3RhZ2UubmFtZSk7XG4gICAgdGhpcy5wcm9qZWN0LmFkZFRhc2soYGRlcGxveToke3N0YWdlLm5hbWV9YCwge1xuICAgICAgZXhlYzogYGNkayAtLWFwcCAke3RoaXMuYXBwLmNka0NvbmZpZy5jZGtvdXR9IC0tb3V0cHV0cy1maWxlIGNkay1vdXRwdXRzLSR7c3RhZ2UubmFtZX0uanNvbiAtLXByb2dyZXNzIGV2ZW50cyAtLXJlcXVpcmUtYXBwcm92YWwgbmV2ZXIgZGVwbG95ICR7c3RhY2tJZH1gLFxuICAgIH0pO1xuICAgIHRoaXMucHJvamVjdC5hZGRUYXNrKGBkaWZmOiR7c3RhZ2UubmFtZX1gLCB7XG4gICAgICBleGVjOiBgY2RrIC0tYXBwICR7dGhpcy5hcHAuY2RrQ29uZmlnLmNka291dH0gZGlmZiAke3N0YWNrSWR9YCxcbiAgICB9KTtcbiAgICBpZiAoc3RhZ2Uud2F0Y2hhYmxlKSB7XG4gICAgICB0aGlzLnByb2plY3QuYWRkVGFzayhgd2F0Y2g6JHtzdGFnZS5uYW1lfWAsIHtcbiAgICAgICAgZXhlYzogYGNkayBkZXBsb3kgLS1vdXRwdXRzLWZpbGUgY2RrLW91dHB1dHMtJHtzdGFnZS5uYW1lfS5qc29uIC0td2F0Y2ggLS1ob3Rzd2FwICR7c3RhY2tJZH1gLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIGdldENsaVN0YWNrUGF0dGVybihzdGFnZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuYmFzZU9wdGlvbnMuZGVwbG95U3ViU3RhY2tzID8gYCR7dGhpcy5zdGFja1ByZWZpeH0tJHtzdGFnZX0gJHt0aGlzLnN0YWNrUHJlZml4fS0ke3N0YWdlfS8qYCA6IGAke3RoaXMuc3RhY2tQcmVmaXh9LSR7c3RhZ2V9YDtcbiAgfVxufSJdfQ==