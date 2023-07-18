"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CDKPipeline = exports.DeploymentType = exports.PipelineEngine = void 0;
const projen_1 = require("projen");
const common_1 = require("projen/lib/common");
const engine_1 = require("./engine");
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
    PipelineEngine[PipelineEngine["CODE_CATALYST"] = 2] = "CODE_CATALYST";
})(PipelineEngine || (exports.PipelineEngine = PipelineEngine = {}));
/**
 * Describes the type of pipeline that will be created
 */
var DeploymentType;
(function (DeploymentType) {
    /** Deploy every commit as far as possible; hopefully into production */
    DeploymentType[DeploymentType["CONTINUOUS_DEPLOYMENT"] = 0] = "CONTINUOUS_DEPLOYMENT";
    /** Build every commit and prepare all assets for a later deployment */
    DeploymentType[DeploymentType["CONTINUOUS_DELIVERY"] = 1] = "CONTINUOUS_DELIVERY";
})(DeploymentType || (exports.DeploymentType = DeploymentType = {}));
/**
 * The CDKPipeline class extends the Component class and sets up the necessary configuration for deploying AWS CDK (Cloud Development Kit) applications across multiple stages.
 * It also manages tasks such as publishing CDK assets, bumping version based on git tags, and cleaning up conflicting tasks.
 */
class CDKPipeline extends projen_1.Component {
    constructor(app, props) {
        var _a, _b, _c;
        super(app);
        this.app = app;
        this.props = props;
        // Add development dependencies
        this.app.addDevDeps('@types/standard-version', 'standard-version', 'cdk-assets');
        // this.app.addDeps(
        // );
        this.stackPrefix = (_a = props.stackPrefix) !== null && _a !== void 0 ? _a : app.name;
        // Create engine instance to use
        switch (props.engine) {
            case PipelineEngine.GITHUB:
                this.engine = new engine_1.GitHubEngine(app, props, this);
                break;
            case PipelineEngine.CODE_CATALYST:
                this.engine = new engine_1.CodeCatalystEngine(app, props, this);
                break;
            default:
                throw new Error('Invalid engine');
        }
        // Removes the compiled cloud assembly before each synth
        (_b = this.project.tasks.tryFind('synth')) === null || _b === void 0 ? void 0 : _b.prependExec(`rm -rf ${this.app.cdkConfig.cdkout}`);
        (_c = this.project.tasks.tryFind('synth:silent')) === null || _c === void 0 ? void 0 : _c.prependExec(`rm -rf ${this.app.cdkConfig.cdkout}`);
        // Remove tasks that might conflict with the pipeline process
        this.project.removeTask('deploy');
        this.project.removeTask('diff');
        this.project.removeTask('destroy');
        this.project.removeTask('watch');
        this.createSynthStage();
        // Creates different deployment stages
        if (props.personalStage) {
            this.createPersonalStage();
        }
        if (props.featureStages) {
            this.createFeatureStage();
        }
        for (const stage of props.stages) {
            this.createPipelineStage(stage);
        }
        // Creates tasks to handle the release process
        this.createReleaseTasks();
        // Creates a specialized CDK App class
        this.createApplicationEntrypoint();
    }
    createSynthStage() {
        var _a, _b, _c, _d;
        this.engine.createSynth({
            commands: [
                ...((_a = this.props.preInstallCommands) !== null && _a !== void 0 ? _a : []),
                `npx projen ${this.app.package.installCiTask.name}`,
                ...((_b = this.props.preSynthCommands) !== null && _b !== void 0 ? _b : []),
                'npx projen build',
                ...((_c = this.props.postSynthCommands) !== null && _c !== void 0 ? _c : []),
            ],
        });
        this.engine.createAssetUpload({
            commands: [
                ...((_d = this.props.preInstallCommands) !== null && _d !== void 0 ? _d : []),
                `npx projen ${this.app.package.installCiTask.name}`,
                'npx projen publish:assets',
                ...(this.engine.needsVersionedArtifacts ? [
                    'npx projen bump',
                    'npx projen release:push-assembly',
                ] : []),
            ],
        });
    }
    /**
     * This method generates the entry point for the application, including interfaces and classes
     * necessary to set up the pipeline and define the AWS CDK stacks for different environments.
     */
    createApplicationEntrypoint() {
        let propsCode = '';
        let appCode = '';
        if (this.props.personalStage) {
            propsCode += `  /** This function will be used to generate a personal stack. */
  providePersonalStack: (app: App, stackId: string, props: PipelineAppStackProps) => Stack;
`;
            appCode += `    // If the environment variable USER is set and a function is provided for creating a personal stack, it is called with necessary arguments.
    if (props.providePersonalStack && process.env.USER) {
      const stageName = 'personal-' + process.env.USER.toLowerCase().replace(/\\\//g, '-');
      props.providePersonalStack(this, '${this.stackPrefix}-personal', { env: ${JSON.stringify(this.props.personalStage.env)}, stackName: \`${this.stackPrefix}-\${stageName}\`, stageName });
    }
`;
        }
        if (this.props.featureStages) {
            propsCode += `  /** This function will be used to generate a feature stack. */
  provideFeatureStack: (app: App, stackId: string, props: PipelineAppStackProps) => Stack;
`;
            appCode += `    // If the environment variable BRANCH is set and a function is provided for creating a feature stack, it is called with necessary arguments.
    if (props.provideFeatureStack && process.env.BRANCH) {
      const stageName = 'feature-' + process.env.BRANCH.toLowerCase().replace(/\\\//g, '-');
      props.provideFeatureStack(this, '${this.stackPrefix}-feature', { env: ${JSON.stringify(this.props.featureStages.env)}, stackName: \`${this.stackPrefix}-\${stageName}\`, stageName });
    }
`;
        }
        for (const stage of this.props.stages) {
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
            steps: this.props.stages.map(stage => ({
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
                    exec: `pipelines-release create-manifest "${this.app.cdkConfig.cdkout}"  "${this.props.pkgNamespace}"`,
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
        var _a;
        this.project.addTask(`deploy:${stage.name}`, {
            exec: `cdk --app ${this.app.cdkConfig.cdkout} --progress events --require-approval never deploy ${this.stackPrefix}-${stage.name}`,
        });
        this.project.addTask(`diff:${stage.name}`, {
            exec: `cdk --app ${this.app.cdkConfig.cdkout} diff ${this.stackPrefix}-${stage.name}`,
        });
        this.engine.createDeployment({
            config: stage,
            installCommands: [
                ...((_a = this.props.preInstallCommands) !== null && _a !== void 0 ? _a : []),
                `npx projen ${this.app.package.installCiTask.name}`,
            ],
            deployCommands: [
                // TODO pre deploy steps
                `npx projen deploy:${stage.name}`,
                // TODO post deploy steps
            ],
        });
    }
}
exports.CDKPipeline = CDKPipeline;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZWxpbmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvcGlwZWxpbmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQXFEO0FBQ3JELDhDQUFrRDtBQUNsRCxxQ0FBc0g7QUF1QnRIOzs7R0FHRztBQUNILElBQVksY0FPWDtBQVBELFdBQVksY0FBYztJQUN4Qiw0QkFBNEI7SUFDNUIsdURBQU0sQ0FBQTtJQUNOLG9DQUFvQztJQUNwQyx1REFBTSxDQUFBO0lBQ04sMkNBQTJDO0lBQzNDLHFFQUFhLENBQUE7QUFDZixDQUFDLEVBUFcsY0FBYyw4QkFBZCxjQUFjLFFBT3pCO0FBRUQ7O0dBRUc7QUFDSCxJQUFZLGNBS1g7QUFMRCxXQUFZLGNBQWM7SUFDeEIsd0VBQXdFO0lBQ3hFLHFGQUFxQixDQUFBO0lBQ3JCLHVFQUF1RTtJQUN2RSxpRkFBbUIsQ0FBQTtBQUNyQixDQUFDLEVBTFcsY0FBYyw4QkFBZCxjQUFjLFFBS3pCO0FBb0VEOzs7R0FHRztBQUNILE1BQWEsV0FBWSxTQUFRLGtCQUFTO0lBS3hDLFlBQW9CLEdBQStCLEVBQVUsS0FBeUI7O1FBQ3BGLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQURPLFFBQUcsR0FBSCxHQUFHLENBQTRCO1FBQVUsVUFBSyxHQUFMLEtBQUssQ0FBb0I7UUFHcEYsK0JBQStCO1FBQy9CLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUNqQix5QkFBeUIsRUFDekIsa0JBQWtCLEVBQ2xCLFlBQVksQ0FDYixDQUFDO1FBQ0Ysb0JBQW9CO1FBQ3BCLEtBQUs7UUFFTCxJQUFJLENBQUMsV0FBVyxHQUFHLE1BQUEsS0FBSyxDQUFDLFdBQVcsbUNBQUksR0FBRyxDQUFDLElBQUksQ0FBQztRQUVqRCxnQ0FBZ0M7UUFDaEMsUUFBUSxLQUFLLENBQUMsTUFBTSxFQUFFO1lBQ3BCLEtBQUssY0FBYyxDQUFDLE1BQU07Z0JBQ3hCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxxQkFBWSxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ2pELE1BQU07WUFDUixLQUFLLGNBQWMsQ0FBQyxhQUFhO2dCQUMvQixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksMkJBQWtCLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDdkQsTUFBTTtZQUNSO2dCQUNFLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztTQUNyQztRQUVELHdEQUF3RDtRQUN4RCxNQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsMENBQUUsV0FBVyxDQUFDLFVBQVUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUN4RixNQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsMENBQUUsV0FBVyxDQUFDLFVBQVUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUUvRiw2REFBNkQ7UUFDN0QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDbEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDaEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDbkMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFakMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFFeEIsc0NBQXNDO1FBQ3RDLElBQUksS0FBSyxDQUFDLGFBQWEsRUFBRTtZQUN2QixJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztTQUM1QjtRQUNELElBQUksS0FBSyxDQUFDLGFBQWEsRUFBRTtZQUN2QixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztTQUMzQjtRQUNELEtBQUssTUFBTSxLQUFLLElBQUksS0FBSyxDQUFDLE1BQU0sRUFBRTtZQUNoQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDakM7UUFFRCw4Q0FBOEM7UUFDOUMsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFFMUIsc0NBQXNDO1FBQ3RDLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO0lBRXJDLENBQUM7SUFFTyxnQkFBZ0I7O1FBQ3RCLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDO1lBQ3RCLFFBQVEsRUFBRTtnQkFDUixHQUFHLENBQUMsTUFBQSxJQUFJLENBQUMsS0FBSyxDQUFDLGtCQUFrQixtQ0FBSSxFQUFFLENBQUM7Z0JBQ3hDLGNBQWMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRTtnQkFDbkQsR0FBRyxDQUFDLE1BQUEsSUFBSSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsbUNBQUksRUFBRSxDQUFDO2dCQUN0QyxrQkFBa0I7Z0JBQ2xCLEdBQUcsQ0FBQyxNQUFBLElBQUksQ0FBQyxLQUFLLENBQUMsaUJBQWlCLG1DQUFJLEVBQUUsQ0FBQzthQUN4QztTQUNGLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxNQUFNLENBQUMsaUJBQWlCLENBQUM7WUFDNUIsUUFBUSxFQUFFO2dCQUNSLEdBQUcsQ0FBQyxNQUFBLElBQUksQ0FBQyxLQUFLLENBQUMsa0JBQWtCLG1DQUFJLEVBQUUsQ0FBQztnQkFDeEMsY0FBYyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFO2dCQUNuRCwyQkFBMkI7Z0JBQzNCLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FBQztvQkFDeEMsaUJBQWlCO29CQUNqQixrQ0FBa0M7aUJBQ25DLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQzthQUNSO1NBQ0YsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7T0FHRztJQUNLLDJCQUEyQjtRQUNqQyxJQUFJLFNBQVMsR0FBRyxFQUFFLENBQUM7UUFDbkIsSUFBSSxPQUFPLEdBQUcsRUFBRSxDQUFDO1FBRWpCLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxhQUFhLEVBQUU7WUFDNUIsU0FBUyxJQUFJOztDQUVsQixDQUFDO1lBQ0ksT0FBTyxJQUFJOzs7MENBR3lCLElBQUksQ0FBQyxXQUFXLHNCQUFzQixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxDQUFDLFdBQVc7O0NBRTdKLENBQUM7U0FDRztRQUVELElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxhQUFhLEVBQUU7WUFDNUIsU0FBUyxJQUFJOztDQUVsQixDQUFDO1lBQ0ksT0FBTyxJQUFJOzs7eUNBR3dCLElBQUksQ0FBQyxXQUFXLHFCQUFxQixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxDQUFDLFdBQVc7O0NBRTNKLENBQUM7U0FDRztRQUVELEtBQUssTUFBTSxLQUFLLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUU7WUFDckMsTUFBTSxjQUFjLEdBQUcsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBRXpGLFNBQVMsSUFBSSxrREFBa0QsS0FBSyxDQUFDLElBQUk7V0FDcEUsY0FBYztDQUN4QixDQUFDO1lBQ0ksT0FBTyxJQUFJLG1EQUFtRCxLQUFLLENBQUMsSUFBSTt1QkFDdkQsY0FBYztxQkFDaEIsY0FBYyxnQkFBZ0IsSUFBSSxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsSUFBSSxhQUFhLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsSUFBSSxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsSUFBSSxrQkFBa0IsS0FBSyxDQUFDLElBQUk7O0NBRWpNLENBQUM7U0FDRztRQUVELE1BQU0sT0FBTyxHQUFHLElBQUksaUJBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLFNBQVMsQ0FBQyxDQUFDO1FBQ3hFLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxzQkFBYTs7Ozs7Ozs7Ozs7O0VBWXJDLFNBQVM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0VBb0JULE9BQU87Ozs7Q0FJUixDQUFDLENBQUM7SUFDRCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0ssa0JBQWtCO1FBQ3hCLGlEQUFpRDtRQUNqRCxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRTtZQUNyQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDckMsSUFBSSxFQUFFLHFCQUFxQixJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsSUFBSSxzQkFBc0I7YUFDN0csQ0FBQyxDQUFDO1NBQ0osQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFO1lBQzNCLFdBQVcsRUFBRSx1Q0FBdUM7WUFDcEQsS0FBSyxFQUFFO2dCQUNMO29CQUNFLElBQUksRUFBRSx3QkFBd0I7aUJBQy9CO2dCQUNEO29CQUNFLElBQUksRUFBRSxpQkFBaUI7aUJBQ3hCO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyx1QkFBdUIsRUFBRTtZQUM1QyxLQUFLLEVBQUU7Z0JBQ0w7b0JBQ0UsSUFBSSxFQUFFLHNDQUFzQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLEdBQUc7aUJBQ3ZHO2dCQUNEO29CQUNFLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNO29CQUM5QixJQUFJLEVBQUUsMkNBQTJDO2lCQUNsRDtnQkFDRDtvQkFDRSxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTTtvQkFDOUIsSUFBSSxFQUFFLGFBQWE7aUJBQ3BCO2FBQ0Y7U0FDRixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0ssbUJBQW1CO1FBQ3pCLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLGlCQUFpQixFQUFFO1lBQ3RDLElBQUksRUFBRSxjQUFjLElBQUksQ0FBQyxXQUFXLFdBQVc7U0FDaEQsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLEVBQUU7WUFDckMsSUFBSSxFQUFFLGdDQUFnQyxJQUFJLENBQUMsV0FBVyxXQUFXO1NBQ2xFLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLGVBQWUsRUFBRTtZQUNwQyxJQUFJLEVBQUUsWUFBWSxJQUFJLENBQUMsV0FBVyxXQUFXO1NBQzlDLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLGtCQUFrQixFQUFFO1lBQ3ZDLElBQUksRUFBRSxlQUFlLElBQUksQ0FBQyxXQUFXLFdBQVc7U0FDakQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7T0FHRztJQUNLLGtCQUFrQjtRQUN4QixJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRTtZQUNyQyxJQUFJLEVBQUUseURBQXlELElBQUksQ0FBQyxXQUFXLFVBQVU7U0FDMUYsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsY0FBYyxFQUFFO1lBQ25DLElBQUksRUFBRSxZQUFZLElBQUksQ0FBQyxXQUFXLFVBQVU7U0FDN0MsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsaUJBQWlCLEVBQUU7WUFDdEMsSUFBSSxFQUFFLGVBQWUsSUFBSSxDQUFDLFdBQVcsVUFBVTtTQUNoRCxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0ssbUJBQW1CLENBQUMsS0FBc0I7O1FBQ2hELElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsS0FBSyxDQUFDLElBQUksRUFBRSxFQUFFO1lBQzNDLElBQUksRUFBRSxhQUFhLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLE1BQU0sc0RBQXNELElBQUksQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDLElBQUksRUFBRTtTQUNuSSxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxRQUFRLEtBQUssQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUN6QyxJQUFJLEVBQUUsYUFBYSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxNQUFNLFNBQVMsSUFBSSxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFO1NBQ3RGLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7WUFDM0IsTUFBTSxFQUFFLEtBQUs7WUFDYixlQUFlLEVBQUU7Z0JBQ2YsR0FBRyxDQUFDLE1BQUEsSUFBSSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsbUNBQUksRUFBRSxDQUFDO2dCQUN4QyxjQUFjLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUU7YUFDcEQ7WUFDRCxjQUFjLEVBQUU7Z0JBQ2Qsd0JBQXdCO2dCQUN4QixxQkFBcUIsS0FBSyxDQUFDLElBQUksRUFBRTtnQkFDakMseUJBQXlCO2FBQzFCO1NBQ0YsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBOVFELGtDQThRQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbXBvbmVudCwgVGV4dEZpbGUsIGF3c2NkayB9IGZyb20gJ3Byb2plbic7XG5pbXBvcnQgeyBQUk9KRU5fTUFSS0VSIH0gZnJvbSAncHJvamVuL2xpYi9jb21tb24nO1xuaW1wb3J0IHsgQmFzZUVuZ2luZSwgQ29kZUNhdGFseXN0RW5naW5lLCBDb2RlQ2F0YWx5c3RFbmdpbmVDb25maWcsIEdpdEh1YkVuZ2luZSwgR2l0aHViRW5naW5lQ29uZmlnIH0gZnJvbSAnLi9lbmdpbmUnO1xuXG4vKipcbiAqIFRoZSBFbnZpcm9ubWVudCBpbnRlcmZhY2UgaXMgZGVzaWduZWQgdG8gaG9sZCBBV1MgcmVsYXRlZCBpbmZvcm1hdGlvblxuICogZm9yIGEgc3BlY2lmaWMgZGVwbG95bWVudCBlbnZpcm9ubWVudCB3aXRoaW4geW91ciBpbmZyYXN0cnVjdHVyZS5cbiAqIEVhY2ggZW52aXJvbm1lbnQgcmVxdWlyZXMgYSBzcGVjaWZpYyBhY2NvdW50IGFuZCByZWdpb24gZm9yIGl0cyByZXNvdXJjZXMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRW52aXJvbm1lbnQge1xuICAvKipcbiAgICogVGhlIEFXUyBBY2NvdW50IElEIGFzc29jaWF0ZWQgd2l0aCB0aGUgZW52aXJvbm1lbnQuIEl0J3MgaW1wb3J0YW50IGJlY2F1c2VcbiAgICogZGlmZmVyZW50IHNlcnZpY2VzIG9yIGZlYXR1cmVzIGNvdWxkIGhhdmUgZGlzdGluY3QgcGVybWlzc2lvbnMgYW5kIHNldHRpbmdzXG4gICAqIGluIGRpZmZlcmVudCBhY2NvdW50cy5cbiAgICovXG4gIHJlYWRvbmx5IGFjY291bnQ6IHN0cmluZztcblxuICAvKipcbiAgICogVGhlIEFXUyBSZWdpb24gZm9yIHRoZSBlbnZpcm9ubWVudC4gVGhpcyBkZXRlcm1pbmVzIHdoZXJlIHlvdXIgcmVzb3VyY2VzXG4gICAqIGFyZSBjcmVhdGVkIGFuZCB3aGVyZSB5b3VyIGFwcGxpY2F0aW9uIHdpbGwgcnVuLiBJdCBjYW4gYWZmZWN0IGxhdGVuY3ksXG4gICAqIGF2YWlsYWJpbGl0eSwgYW5kIHByaWNpbmcuXG4gICAqL1xuICByZWFkb25seSByZWdpb246IHN0cmluZztcbn1cblxuLyoqXG4gKiBUaGUgQ0kvQ0QgdG9vbGluZyB1c2VkIHRvIHJ1biB5b3VyIHBpcGVsaW5lLlxuICogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciB3b3JrZmxvd3MgZm9yIHRoZSBnaXZlbiBzeXN0ZW1cbiAqL1xuZXhwb3J0IGVudW0gUGlwZWxpbmVFbmdpbmUge1xuICAvKiogQ3JlYXRlIEdpdEh1YiBhY3Rpb25zICovXG4gIEdJVEhVQixcbiAgLyoqIENyZWF0ZSBhIC5naXRsYWItY2kueWFtbCBmaWxlICovXG4gIEdJVExBQixcbiAgLy8gLyoqIENyZWF0ZSBBV1MgQ29kZUNhdGFseXN0IHdvcmtmbG93cyAqL1xuICBDT0RFX0NBVEFMWVNULFxufVxuXG4vKipcbiAqIERlc2NyaWJlcyB0aGUgdHlwZSBvZiBwaXBlbGluZSB0aGF0IHdpbGwgYmUgY3JlYXRlZFxuICovXG5leHBvcnQgZW51bSBEZXBsb3ltZW50VHlwZSB7XG4gIC8qKiBEZXBsb3kgZXZlcnkgY29tbWl0IGFzIGZhciBhcyBwb3NzaWJsZTsgaG9wZWZ1bGx5IGludG8gcHJvZHVjdGlvbiAqL1xuICBDT05USU5VT1VTX0RFUExPWU1FTlQsXG4gIC8qKiBCdWlsZCBldmVyeSBjb21taXQgYW5kIHByZXBhcmUgYWxsIGFzc2V0cyBmb3IgYSBsYXRlciBkZXBsb3ltZW50ICovXG4gIENPTlRJTlVPVVNfREVMSVZFUlksXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGVwbG95bWVudFN0YWdlIHtcbiAgcmVhZG9ubHkgbmFtZTogc3RyaW5nO1xuICByZWFkb25seSBlbnY6IEVudmlyb25tZW50O1xuICByZWFkb25seSBtYW51YWxBcHByb3ZhbD86IGJvb2xlYW47XG59XG5cbi8qKlxuICogVGhlIENES1BpcGVsaW5lT3B0aW9ucyBpbnRlcmZhY2UgaXMgZGVzaWduZWQgdG8gcHJvdmlkZSBjb25maWd1cmF0aW9uXG4gKiBvcHRpb25zIGZvciBhIENESyAoQ2xvdWQgRGV2ZWxvcG1lbnQgS2l0KSBwaXBlbGluZS4gSXQgYWxsb3dzIHRoZSBkZWZpbml0aW9uXG4gKiBvZiBzZXR0aW5ncyBzdWNoIGFzIHRoZSBzdGFjayBwcmVmaXggYW5kIHBhY2thZ2UgbmFtZXNwYWNlIHRvIGJlIHVzZWQgaW4gdGhlXG4gKiBBV1Mgc3RhY2ssIGFsb25nIHdpdGggdGhlIGVudmlyb25tZW50cyBjb25maWd1cmF0aW9uIHRvIGJlIHVzZWQuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ0RLUGlwZWxpbmVPcHRpb25zIHtcblxuICAvKipcbiAgICogVGhpcyBmaWVsZCBpcyB1c2VkIHRvIGRlZmluZSBhIHByZWZpeCBmb3IgdGhlIEFXUyBTdGFjayByZXNvdXJjZXMgY3JlYXRlZFxuICAgKiBkdXJpbmcgdGhlIHBpcGVsaW5lJ3Mgb3BlcmF0aW9uLlxuICAgKlxuICAgKiBAZGVmYXVsdCBwcm9qZWN0IG5hbWVcbiAgICovXG4gIHJlYWRvbmx5IHN0YWNrUHJlZml4Pzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBUaGlzIGZpZWxkIGRldGVybWluZXMgdGhlIE5QTSBuYW1lc3BhY2UgdG8gYmUgdXNlZCB3aGVuIHBhY2thZ2luZyBDREsgY2xvdWRcbiAgICogYXNzZW1ibGllcy4gQSBuYW1lc3BhY2UgaGVscHMgZ3JvdXAgcmVsYXRlZCByZXNvdXJjZXMgdG9nZXRoZXIsIHByb3ZpZGluZ1xuICAgKiBiZXR0ZXIgb3JnYW5pemF0aW9uIGFuZCBlYXNlIG9mIG1hbmFnZW1lbnQuXG4gICAqL1xuICByZWFkb25seSBwa2dOYW1lc3BhY2U6IHN0cmluZztcblxuICByZWFkb25seSBzdGFnZXM6IERlcGxveW1lbnRTdGFnZVtdO1xuXG4gIHJlYWRvbmx5IHBlcnNvbmFsU3RhZ2U/OiB7XG4gICAgcmVhZG9ubHkgZW52OiBFbnZpcm9ubWVudDtcbiAgfTtcblxuICByZWFkb25seSBmZWF0dXJlU3RhZ2VzPzoge1xuICAgIHJlYWRvbmx5IGVudjogRW52aXJvbm1lbnQ7XG4gIH07XG5cbiAgLyoqXG4gICAqIFRoaXMgZmllbGQgc3BlY2lmaWVzIHRoZSB0eXBlIG9mIHBpcGVsaW5lIHRvIGNyZWF0ZS4gSWYgc2V0IHRvIENPTlRJTlVPVVNfREVQTE9ZTUVOVCxcbiAgICogZXZlcnkgY29tbWl0IGlzIGRlcGxveWVkIGFzIGZhciBhcyBwb3NzaWJsZSwgaG9wZWZ1bGx5IGludG8gcHJvZHVjdGlvbi4gSWYgc2V0IHRvXG4gICAqIENPTlRJTlVPVVNfREVMSVZFUlksIGV2ZXJ5IGNvbW1pdCBpcyBidWlsdCBhbmQgYWxsIGFzc2V0cyBhcmUgcHJlcGFyZWQgZm9yIGEgbGF0ZXIgZGVwbG95bWVudC5cbiAgICpcbiAgICogQGRlZmF1bHQgQ09OVElOVU9VU19ERUxJVkVSWVxuICAgKi9cbiAgcmVhZG9ubHkgZGVwbG95bWVudFR5cGU/OiBEZXBsb3ltZW50VHlwZTtcblxuICAvKipcbiAgICogVGhpcyBmaWVsZCBkZXRlcm1pbmVzIHRoZSBDSS9DRCB0b29saW5nIHRoYXQgd2lsbCBiZSB1c2VkIHRvIHJ1biB0aGUgcGlwZWxpbmUuIFRoZSBjb21wb25lbnRcbiAgICogd2lsbCByZW5kZXIgd29ya2Zsb3dzIGZvciB0aGUgZ2l2ZW4gc3lzdGVtLiBPcHRpb25zIGluY2x1ZGUgR2l0SHViIGFuZCBHaXRMYWIuXG4gICAqXG4gICAqIEBkZWZhdWx0IC0gdHJpZXMgdG8gZGVyaXZlIGl0IGZyb20gdGhlIHByb2plY3RzIGNvbmZpZ3VyYXRpb25cbiAgICovXG4gIHJlYWRvbmx5IGVuZ2luZT86IFBpcGVsaW5lRW5naW5lO1xuXG4gIHJlYWRvbmx5IGdpdGh1YkNvbmZpZz86IEdpdGh1YkVuZ2luZUNvbmZpZztcblxuICByZWFkb25seSBjb2RlY2F0YWx5c3RDb25maWc/OiBDb2RlQ2F0YWx5c3RFbmdpbmVDb25maWc7XG5cbiAgcmVhZG9ubHkgcHJlSW5zdGFsbENvbW1hbmRzPzogc3RyaW5nW107XG4gIHJlYWRvbmx5IHByZVN5bnRoQ29tbWFuZHM/OiBzdHJpbmdbXTtcbiAgcmVhZG9ubHkgcG9zdFN5bnRoQ29tbWFuZHM/OiBzdHJpbmdbXTtcblxufVxuXG4vKipcbiAqIFRoZSBDREtQaXBlbGluZSBjbGFzcyBleHRlbmRzIHRoZSBDb21wb25lbnQgY2xhc3MgYW5kIHNldHMgdXAgdGhlIG5lY2Vzc2FyeSBjb25maWd1cmF0aW9uIGZvciBkZXBsb3lpbmcgQVdTIENESyAoQ2xvdWQgRGV2ZWxvcG1lbnQgS2l0KSBhcHBsaWNhdGlvbnMgYWNyb3NzIG11bHRpcGxlIHN0YWdlcy5cbiAqIEl0IGFsc28gbWFuYWdlcyB0YXNrcyBzdWNoIGFzIHB1Ymxpc2hpbmcgQ0RLIGFzc2V0cywgYnVtcGluZyB2ZXJzaW9uIGJhc2VkIG9uIGdpdCB0YWdzLCBhbmQgY2xlYW5pbmcgdXAgY29uZmxpY3RpbmcgdGFza3MuXG4gKi9cbmV4cG9ydCBjbGFzcyBDREtQaXBlbGluZSBleHRlbmRzIENvbXBvbmVudCB7XG5cbiAgcHVibGljIHJlYWRvbmx5IHN0YWNrUHJlZml4OiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkb25seSBlbmdpbmU6IEJhc2VFbmdpbmU7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBhcHA6IGF3c2Nkay5Bd3NDZGtUeXBlU2NyaXB0QXBwLCBwcml2YXRlIHByb3BzOiBDREtQaXBlbGluZU9wdGlvbnMpIHtcbiAgICBzdXBlcihhcHApO1xuXG4gICAgLy8gQWRkIGRldmVsb3BtZW50IGRlcGVuZGVuY2llc1xuICAgIHRoaXMuYXBwLmFkZERldkRlcHMoXG4gICAgICAnQHR5cGVzL3N0YW5kYXJkLXZlcnNpb24nLFxuICAgICAgJ3N0YW5kYXJkLXZlcnNpb24nLFxuICAgICAgJ2Nkay1hc3NldHMnLFxuICAgICk7XG4gICAgLy8gdGhpcy5hcHAuYWRkRGVwcyhcbiAgICAvLyApO1xuXG4gICAgdGhpcy5zdGFja1ByZWZpeCA9IHByb3BzLnN0YWNrUHJlZml4ID8/IGFwcC5uYW1lO1xuXG4gICAgLy8gQ3JlYXRlIGVuZ2luZSBpbnN0YW5jZSB0byB1c2VcbiAgICBzd2l0Y2ggKHByb3BzLmVuZ2luZSkge1xuICAgICAgY2FzZSBQaXBlbGluZUVuZ2luZS5HSVRIVUI6XG4gICAgICAgIHRoaXMuZW5naW5lID0gbmV3IEdpdEh1YkVuZ2luZShhcHAsIHByb3BzLCB0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFBpcGVsaW5lRW5naW5lLkNPREVfQ0FUQUxZU1Q6XG4gICAgICAgIHRoaXMuZW5naW5lID0gbmV3IENvZGVDYXRhbHlzdEVuZ2luZShhcHAsIHByb3BzLCB0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgZW5naW5lJyk7XG4gICAgfVxuXG4gICAgLy8gUmVtb3ZlcyB0aGUgY29tcGlsZWQgY2xvdWQgYXNzZW1ibHkgYmVmb3JlIGVhY2ggc3ludGhcbiAgICB0aGlzLnByb2plY3QudGFza3MudHJ5RmluZCgnc3ludGgnKT8ucHJlcGVuZEV4ZWMoYHJtIC1yZiAke3RoaXMuYXBwLmNka0NvbmZpZy5jZGtvdXR9YCk7XG4gICAgdGhpcy5wcm9qZWN0LnRhc2tzLnRyeUZpbmQoJ3N5bnRoOnNpbGVudCcpPy5wcmVwZW5kRXhlYyhgcm0gLXJmICR7dGhpcy5hcHAuY2RrQ29uZmlnLmNka291dH1gKTtcblxuICAgIC8vIFJlbW92ZSB0YXNrcyB0aGF0IG1pZ2h0IGNvbmZsaWN0IHdpdGggdGhlIHBpcGVsaW5lIHByb2Nlc3NcbiAgICB0aGlzLnByb2plY3QucmVtb3ZlVGFzaygnZGVwbG95Jyk7XG4gICAgdGhpcy5wcm9qZWN0LnJlbW92ZVRhc2soJ2RpZmYnKTtcbiAgICB0aGlzLnByb2plY3QucmVtb3ZlVGFzaygnZGVzdHJveScpO1xuICAgIHRoaXMucHJvamVjdC5yZW1vdmVUYXNrKCd3YXRjaCcpO1xuXG4gICAgdGhpcy5jcmVhdGVTeW50aFN0YWdlKCk7XG5cbiAgICAvLyBDcmVhdGVzIGRpZmZlcmVudCBkZXBsb3ltZW50IHN0YWdlc1xuICAgIGlmIChwcm9wcy5wZXJzb25hbFN0YWdlKSB7XG4gICAgICB0aGlzLmNyZWF0ZVBlcnNvbmFsU3RhZ2UoKTtcbiAgICB9XG4gICAgaWYgKHByb3BzLmZlYXR1cmVTdGFnZXMpIHtcbiAgICAgIHRoaXMuY3JlYXRlRmVhdHVyZVN0YWdlKCk7XG4gICAgfVxuICAgIGZvciAoY29uc3Qgc3RhZ2Ugb2YgcHJvcHMuc3RhZ2VzKSB7XG4gICAgICB0aGlzLmNyZWF0ZVBpcGVsaW5lU3RhZ2Uoc3RhZ2UpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZXMgdGFza3MgdG8gaGFuZGxlIHRoZSByZWxlYXNlIHByb2Nlc3NcbiAgICB0aGlzLmNyZWF0ZVJlbGVhc2VUYXNrcygpO1xuXG4gICAgLy8gQ3JlYXRlcyBhIHNwZWNpYWxpemVkIENESyBBcHAgY2xhc3NcbiAgICB0aGlzLmNyZWF0ZUFwcGxpY2F0aW9uRW50cnlwb2ludCgpO1xuXG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVN5bnRoU3RhZ2UoKSB7XG4gICAgdGhpcy5lbmdpbmUuY3JlYXRlU3ludGgoe1xuICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgLi4uKHRoaXMucHJvcHMucHJlSW5zdGFsbENvbW1hbmRzID8/IFtdKSxcbiAgICAgICAgYG5weCBwcm9qZW4gJHt0aGlzLmFwcC5wYWNrYWdlLmluc3RhbGxDaVRhc2submFtZX1gLFxuICAgICAgICAuLi4odGhpcy5wcm9wcy5wcmVTeW50aENvbW1hbmRzID8/IFtdKSxcbiAgICAgICAgJ25weCBwcm9qZW4gYnVpbGQnLFxuICAgICAgICAuLi4odGhpcy5wcm9wcy5wb3N0U3ludGhDb21tYW5kcyA/PyBbXSksXG4gICAgICBdLFxuICAgIH0pO1xuICAgIHRoaXMuZW5naW5lLmNyZWF0ZUFzc2V0VXBsb2FkKHtcbiAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgIC4uLih0aGlzLnByb3BzLnByZUluc3RhbGxDb21tYW5kcyA/PyBbXSksXG4gICAgICAgIGBucHggcHJvamVuICR7dGhpcy5hcHAucGFja2FnZS5pbnN0YWxsQ2lUYXNrLm5hbWV9YCxcbiAgICAgICAgJ25weCBwcm9qZW4gcHVibGlzaDphc3NldHMnLFxuICAgICAgICAuLi4odGhpcy5lbmdpbmUubmVlZHNWZXJzaW9uZWRBcnRpZmFjdHMgPyBbXG4gICAgICAgICAgJ25weCBwcm9qZW4gYnVtcCcsXG4gICAgICAgICAgJ25weCBwcm9qZW4gcmVsZWFzZTpwdXNoLWFzc2VtYmx5JyxcbiAgICAgICAgXSA6IFtdKSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBtZXRob2QgZ2VuZXJhdGVzIHRoZSBlbnRyeSBwb2ludCBmb3IgdGhlIGFwcGxpY2F0aW9uLCBpbmNsdWRpbmcgaW50ZXJmYWNlcyBhbmQgY2xhc3Nlc1xuICAgKiBuZWNlc3NhcnkgdG8gc2V0IHVwIHRoZSBwaXBlbGluZSBhbmQgZGVmaW5lIHRoZSBBV1MgQ0RLIHN0YWNrcyBmb3IgZGlmZmVyZW50IGVudmlyb25tZW50cy5cbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQXBwbGljYXRpb25FbnRyeXBvaW50KCkge1xuICAgIGxldCBwcm9wc0NvZGUgPSAnJztcbiAgICBsZXQgYXBwQ29kZSA9ICcnO1xuXG4gICAgaWYgKHRoaXMucHJvcHMucGVyc29uYWxTdGFnZSkge1xuICAgICAgcHJvcHNDb2RlICs9IGAgIC8qKiBUaGlzIGZ1bmN0aW9uIHdpbGwgYmUgdXNlZCB0byBnZW5lcmF0ZSBhIHBlcnNvbmFsIHN0YWNrLiAqL1xuICBwcm92aWRlUGVyc29uYWxTdGFjazogKGFwcDogQXBwLCBzdGFja0lkOiBzdHJpbmcsIHByb3BzOiBQaXBlbGluZUFwcFN0YWNrUHJvcHMpID0+IFN0YWNrO1xuYDtcbiAgICAgIGFwcENvZGUgKz0gYCAgICAvLyBJZiB0aGUgZW52aXJvbm1lbnQgdmFyaWFibGUgVVNFUiBpcyBzZXQgYW5kIGEgZnVuY3Rpb24gaXMgcHJvdmlkZWQgZm9yIGNyZWF0aW5nIGEgcGVyc29uYWwgc3RhY2ssIGl0IGlzIGNhbGxlZCB3aXRoIG5lY2Vzc2FyeSBhcmd1bWVudHMuXG4gICAgaWYgKHByb3BzLnByb3ZpZGVQZXJzb25hbFN0YWNrICYmIHByb2Nlc3MuZW52LlVTRVIpIHtcbiAgICAgIGNvbnN0IHN0YWdlTmFtZSA9ICdwZXJzb25hbC0nICsgcHJvY2Vzcy5lbnYuVVNFUi50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1xcXFxcXC8vZywgJy0nKTtcbiAgICAgIHByb3BzLnByb3ZpZGVQZXJzb25hbFN0YWNrKHRoaXMsICcke3RoaXMuc3RhY2tQcmVmaXh9LXBlcnNvbmFsJywgeyBlbnY6ICR7SlNPTi5zdHJpbmdpZnkodGhpcy5wcm9wcy5wZXJzb25hbFN0YWdlLmVudil9LCBzdGFja05hbWU6IFxcYCR7dGhpcy5zdGFja1ByZWZpeH0tXFwke3N0YWdlTmFtZX1cXGAsIHN0YWdlTmFtZSB9KTtcbiAgICB9XG5gO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnByb3BzLmZlYXR1cmVTdGFnZXMpIHtcbiAgICAgIHByb3BzQ29kZSArPSBgICAvKiogVGhpcyBmdW5jdGlvbiB3aWxsIGJlIHVzZWQgdG8gZ2VuZXJhdGUgYSBmZWF0dXJlIHN0YWNrLiAqL1xuICBwcm92aWRlRmVhdHVyZVN0YWNrOiAoYXBwOiBBcHAsIHN0YWNrSWQ6IHN0cmluZywgcHJvcHM6IFBpcGVsaW5lQXBwU3RhY2tQcm9wcykgPT4gU3RhY2s7XG5gO1xuICAgICAgYXBwQ29kZSArPSBgICAgIC8vIElmIHRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZSBCUkFOQ0ggaXMgc2V0IGFuZCBhIGZ1bmN0aW9uIGlzIHByb3ZpZGVkIGZvciBjcmVhdGluZyBhIGZlYXR1cmUgc3RhY2ssIGl0IGlzIGNhbGxlZCB3aXRoIG5lY2Vzc2FyeSBhcmd1bWVudHMuXG4gICAgaWYgKHByb3BzLnByb3ZpZGVGZWF0dXJlU3RhY2sgJiYgcHJvY2Vzcy5lbnYuQlJBTkNIKSB7XG4gICAgICBjb25zdCBzdGFnZU5hbWUgPSAnZmVhdHVyZS0nICsgcHJvY2Vzcy5lbnYuQlJBTkNILnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvXFxcXFxcLy9nLCAnLScpO1xuICAgICAgcHJvcHMucHJvdmlkZUZlYXR1cmVTdGFjayh0aGlzLCAnJHt0aGlzLnN0YWNrUHJlZml4fS1mZWF0dXJlJywgeyBlbnY6ICR7SlNPTi5zdHJpbmdpZnkodGhpcy5wcm9wcy5mZWF0dXJlU3RhZ2VzLmVudil9LCBzdGFja05hbWU6IFxcYCR7dGhpcy5zdGFja1ByZWZpeH0tXFwke3N0YWdlTmFtZX1cXGAsIHN0YWdlTmFtZSB9KTtcbiAgICB9XG5gO1xuICAgIH1cblxuICAgIGZvciAoY29uc3Qgc3RhZ2Ugb2YgdGhpcy5wcm9wcy5zdGFnZXMpIHtcbiAgICAgIGNvbnN0IG5hbWVVcHBlckZpcnN0ID0gYCR7c3RhZ2UubmFtZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKX0ke3N0YWdlLm5hbWUuc3Vic3RyaW5nKDEpfWA7XG5cbiAgICAgIHByb3BzQ29kZSArPSBgICAvKiogVGhpcyBmdW5jdGlvbiB3aWxsIGJlIHVzZWQgdG8gZ2VuZXJhdGUgYSAke3N0YWdlLm5hbWV9IHN0YWNrLiAqL1xuICBwcm92aWRlJHtuYW1lVXBwZXJGaXJzdH1TdGFjazogKGFwcDogQXBwLCBzdGFja0lkOiBzdHJpbmcsIHByb3BzOiBQaXBlbGluZUFwcFN0YWNrUHJvcHMpID0+IFN0YWNrO1xuYDtcbiAgICAgIGFwcENvZGUgKz0gYCAgICAvLyBJZiBhIGZ1bmN0aW9uIGlzIHByb3ZpZGVkIGZvciBjcmVhdGluZyBhICR7c3RhZ2UubmFtZX0gc3RhY2ssIGl0IGlzIGNhbGxlZCB3aXRoIG5lY2Vzc2FyeSBhcmd1bWVudHMuXG4gICAgaWYgKHByb3BzLnByb3ZpZGUke25hbWVVcHBlckZpcnN0fVN0YWNrKSB7XG4gICAgICBwcm9wcy5wcm92aWRlJHtuYW1lVXBwZXJGaXJzdH1TdGFjayh0aGlzLCAnJHt0aGlzLnN0YWNrUHJlZml4fS0ke3N0YWdlLm5hbWV9JywgeyBlbnY6ICR7SlNPTi5zdHJpbmdpZnkoc3RhZ2UuZW52KX0sIHN0YWNrTmFtZTogJyR7dGhpcy5zdGFja1ByZWZpeH0tJHtzdGFnZS5uYW1lfScsIHN0YWdlTmFtZTogJyR7c3RhZ2UubmFtZX0nIH0pO1xuICAgIH1cbmA7XG4gICAgfVxuXG4gICAgY29uc3QgYXBwRmlsZSA9IG5ldyBUZXh0RmlsZSh0aGlzLnByb2plY3QsIGAke3RoaXMuYXBwLnNyY2Rpcn0vYXBwLnRzYCk7XG4gICAgYXBwRmlsZS5hZGRMaW5lKGAvLyAke1BST0pFTl9NQVJLRVJ9XG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuaW1wb3J0IHsgQXBwLCBBcHBQcm9wcywgU3RhY2ssIFN0YWNrUHJvcHMgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5cbi8qKlxuICogUGlwZWxpbmVBcHBQcm9wcyBpcyBhbiBleHRlbnNpb24gb2YgQXBwUHJvcHMsIHdoaWNoIGlzIHBhcnQgb2YgdGhlIEFXUyBDREsgY29yZS5cbiAqIEl0IGluY2x1ZGVzIG9wdGlvbmFsIGZ1bmN0aW9ucyB0byBwcm92aWRlIEFXUyBTdGFja3MgZm9yIGRpZmZlcmVudCBzdGFnZXMuXG4gKlxuICogVXNlIHRoZXNlIGZ1bmN0aW9ucyB0byBpbnN0YW50aWF0ZSB5b3VyIGFwcGxpY2F0aW9uIHN0YWNrcyB3aXRoIHRoZSBwYXJhbWV0ZXJzIGZvclxuICogZWFjaCBzdGFnZVxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBpcGVsaW5lQXBwUHJvcHMgZXh0ZW5kcyBBcHBQcm9wcyB7XG4ke3Byb3BzQ29kZX1cbn1cblxuLyoqXG4gKiBQaXBlbGluZUFwcFN0YWNrUHJvcHMgaXMgYW4gZXh0ZW5zaW9uIG9mIFN0YWNrUHJvcHMsIHdoaWNoIGlzIHBhcnQgb2YgdGhlIEFXUyBDREsgY29yZS5cbiAqIEl0IGluY2x1ZGVzIGFuIGFkZGl0aW9uYWwgcHJvcGVydHkgdG8gc3BlY2lmeSB0aGUgc3RhZ2UgbmFtZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQaXBlbGluZUFwcFN0YWNrUHJvcHMgZXh0ZW5kcyBTdGFja1Byb3BzIHtcbiAgc3RhZ2VOYW1lOiBzdHJpbmc7XG59XG5cbi8qKlxuICogVGhlIFBpcGVsaW5lQXBwIGNsYXNzIGV4dGVuZHMgdGhlIEFwcCBjbGFzcyBmcm9tIEFXUyBDREsgYW5kIG92ZXJyaWRlcyB0aGUgY29uc3RydWN0b3IgdG8gc3VwcG9ydFxuICogZGlmZmVyZW50IHN0YWdlcyBvZiB0aGUgYXBwbGljYXRpb24gKGRldmVsb3BtZW50LCBwcm9kdWN0aW9uLCBwZXJzb25hbCwgZmVhdHVyZSkgYnkgaW52b2tpbmcgdGhlIHByb3ZpZGVkXG4gKiBzdGFjay1wcm92aWRpbmcgZnVuY3Rpb25zIGZyb20gdGhlIHByb3BzLlxuICovXG5leHBvcnQgY2xhc3MgUGlwZWxpbmVBcHAgZXh0ZW5kcyBBcHAge1xuICBjb25zdHJ1Y3Rvcihwcm9wczogUGlwZWxpbmVBcHBQcm9wcykge1xuICAgIHN1cGVyKHByb3BzKTtcblxuJHthcHBDb2RlfVxuXG4gIH1cbn1cbmApO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoaXMgbWV0aG9kIHNldHMgdXAgdGFza3MgdG8gcHVibGlzaCBDREsgYXNzZXRzIHRvIGFsbCBhY2NvdW50cyBhbmQgaGFuZGxlIHZlcnNpb25pbmcsIGluY2x1ZGluZyBidW1waW5nIHRoZSB2ZXJzaW9uXG4gICAqIGJhc2VkIG9uIHRoZSBsYXRlc3QgZ2l0IHRhZyBhbmQgcHVzaGluZyB0aGUgQ0RLIGFzc2VtYmx5IHRvIHRoZSBwYWNrYWdlIHJlcG9zaXRvcnkuXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVJlbGVhc2VUYXNrcygpIHtcbiAgICAvLyBUYXNrIHRvIHB1Ymxpc2ggdGhlIENESyBhc3NldHMgdG8gYWxsIGFjY291bnRzXG4gICAgdGhpcy5wcm9qZWN0LmFkZFRhc2soJ3B1Ymxpc2g6YXNzZXRzJywge1xuICAgICAgc3RlcHM6IHRoaXMucHJvcHMuc3RhZ2VzLm1hcChzdGFnZSA9PiAoe1xuICAgICAgICBleGVjOiBgbnB4IGNkay1hc3NldHMgLXAgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fS8ke3RoaXMuc3RhY2tQcmVmaXh9LSR7c3RhZ2UubmFtZX0uYXNzZXRzLmpzb24gcHVibGlzaGAsXG4gICAgICB9KSksXG4gICAgfSk7XG5cbiAgICB0aGlzLnByb2plY3QuYWRkVGFzaygnYnVtcCcsIHtcbiAgICAgIGRlc2NyaXB0aW9uOiAnQnVtcHMgdmVyc2lvbiBiYXNlZCBvbiBsYXRlc3QgZ2l0IHRhZycsXG4gICAgICBzdGVwczogW1xuICAgICAgICB7XG4gICAgICAgICAgZXhlYzogJ3BpcGVsaW5lcy1yZWxlYXNlIGJ1bXAnLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgZXhlYzogJ2dpdCBwdXNoIC0tdGFncycsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuICAgIHRoaXMucHJvamVjdC5hZGRUYXNrKCdyZWxlYXNlOnB1c2gtYXNzZW1ibHknLCB7XG4gICAgICBzdGVwczogW1xuICAgICAgICB7XG4gICAgICAgICAgZXhlYzogYHBpcGVsaW5lcy1yZWxlYXNlIGNyZWF0ZS1tYW5pZmVzdCBcIiR7dGhpcy5hcHAuY2RrQ29uZmlnLmNka291dH1cIiAgXCIke3RoaXMucHJvcHMucGtnTmFtZXNwYWNlfVwiYCxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGN3ZDogdGhpcy5hcHAuY2RrQ29uZmlnLmNka291dCxcbiAgICAgICAgICBleGVjOiAnbnBtIHZlcnNpb24gLS1uby1naXQtdGFnLXZlcnNpb24gZnJvbS1naXQnLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgY3dkOiB0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0LFxuICAgICAgICAgIGV4ZWM6ICducG0gcHVibGlzaCcsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoaXMgbWV0aG9kIHNldHMgdXAgdGFza3MgZm9yIHRoZSBwZXJzb25hbCBkZXBsb3ltZW50IHN0YWdlLCBpbmNsdWRpbmcgZGVwbG95bWVudCwgd2F0Y2hpbmcgZm9yIGNoYW5nZXMsXG4gICAqIGNvbXBhcmluZyBjaGFuZ2VzIChkaWZmKSwgYW5kIGRlc3Ryb3lpbmcgdGhlIHN0YWNrIHdoZW4gbm8gbG9uZ2VyIG5lZWRlZC5cbiAgICovXG4gIHByaXZhdGUgY3JlYXRlUGVyc29uYWxTdGFnZSgpIHtcbiAgICB0aGlzLnByb2plY3QuYWRkVGFzaygnZGVwbG95OnBlcnNvbmFsJywge1xuICAgICAgZXhlYzogYGNkayBkZXBsb3kgJHt0aGlzLnN0YWNrUHJlZml4fS1wZXJzb25hbGAsXG4gICAgfSk7XG4gICAgdGhpcy5wcm9qZWN0LmFkZFRhc2soJ3dhdGNoOnBlcnNvbmFsJywge1xuICAgICAgZXhlYzogYGNkayBkZXBsb3kgLS13YXRjaCAtLWhvdHN3YXAgJHt0aGlzLnN0YWNrUHJlZml4fS1wZXJzb25hbGAsXG4gICAgfSk7XG4gICAgdGhpcy5wcm9qZWN0LmFkZFRhc2soJ2RpZmY6cGVyc29uYWwnLCB7XG4gICAgICBleGVjOiBgY2RrIGRpZmYgJHt0aGlzLnN0YWNrUHJlZml4fS1wZXJzb25hbGAsXG4gICAgfSk7XG4gICAgdGhpcy5wcm9qZWN0LmFkZFRhc2soJ2Rlc3Ryb3k6cGVyc29uYWwnLCB7XG4gICAgICBleGVjOiBgY2RrIGRlc3Ryb3kgJHt0aGlzLnN0YWNrUHJlZml4fS1wZXJzb25hbGAsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBtZXRob2Qgc2V0cyB1cCB0YXNrcyBmb3IgdGhlIGZlYXR1cmUgZGVwbG95bWVudCBzdGFnZSwgaW5jbHVkaW5nIGRlcGxveW1lbnQsIGNvbXBhcmluZyBjaGFuZ2VzIChkaWZmKSxcbiAgICogYW5kIGRlc3Ryb3lpbmcgdGhlIHN0YWNrIHdoZW4gbm8gbG9uZ2VyIG5lZWRlZC5cbiAgICovXG4gIHByaXZhdGUgY3JlYXRlRmVhdHVyZVN0YWdlKCkge1xuICAgIHRoaXMucHJvamVjdC5hZGRUYXNrKCdkZXBsb3k6ZmVhdHVyZScsIHtcbiAgICAgIGV4ZWM6IGBjZGsgLS1wcm9ncmVzcyBldmVudHMgLS1yZXF1aXJlLWFwcHJvdmFsIG5ldmVyIGRlcGxveSAke3RoaXMuc3RhY2tQcmVmaXh9LWZlYXR1cmVgLFxuICAgIH0pO1xuICAgIHRoaXMucHJvamVjdC5hZGRUYXNrKCdkaWZmOmZlYXR1cmUnLCB7XG4gICAgICBleGVjOiBgY2RrIGRpZmYgJHt0aGlzLnN0YWNrUHJlZml4fS1mZWF0dXJlYCxcbiAgICB9KTtcbiAgICB0aGlzLnByb2plY3QuYWRkVGFzaygnZGVzdHJveTpmZWF0dXJlJywge1xuICAgICAgZXhlYzogYGNkayBkZXN0cm95ICR7dGhpcy5zdGFja1ByZWZpeH0tZmVhdHVyZWAsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBtZXRob2Qgc2V0cyB1cCB0YXNrcyBmb3IgdGhlIGdlbmVyYWwgcGlwZWxpbmUgc3RhZ2VzIChkZXYsIHByb2QpLCBpbmNsdWRpbmcgZGVwbG95bWVudCBhbmQgY29tcGFyaW5nIGNoYW5nZXMgKGRpZmYpLlxuICAgKiBAcGFyYW0ge0RlcGxveVN0YWdlT3B0aW9uc30gc3RhZ2UgLSBUaGUgc3RhZ2UgdG8gY3JlYXRlXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZVBpcGVsaW5lU3RhZ2Uoc3RhZ2U6IERlcGxveW1lbnRTdGFnZSkge1xuICAgIHRoaXMucHJvamVjdC5hZGRUYXNrKGBkZXBsb3k6JHtzdGFnZS5uYW1lfWAsIHtcbiAgICAgIGV4ZWM6IGBjZGsgLS1hcHAgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fSAtLXByb2dyZXNzIGV2ZW50cyAtLXJlcXVpcmUtYXBwcm92YWwgbmV2ZXIgZGVwbG95ICR7dGhpcy5zdGFja1ByZWZpeH0tJHtzdGFnZS5uYW1lfWAsXG4gICAgfSk7XG4gICAgdGhpcy5wcm9qZWN0LmFkZFRhc2soYGRpZmY6JHtzdGFnZS5uYW1lfWAsIHtcbiAgICAgIGV4ZWM6IGBjZGsgLS1hcHAgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fSBkaWZmICR7dGhpcy5zdGFja1ByZWZpeH0tJHtzdGFnZS5uYW1lfWAsXG4gICAgfSk7XG5cbiAgICB0aGlzLmVuZ2luZS5jcmVhdGVEZXBsb3ltZW50KHtcbiAgICAgIGNvbmZpZzogc3RhZ2UsXG4gICAgICBpbnN0YWxsQ29tbWFuZHM6IFtcbiAgICAgICAgLi4uKHRoaXMucHJvcHMucHJlSW5zdGFsbENvbW1hbmRzID8/IFtdKSxcbiAgICAgICAgYG5weCBwcm9qZW4gJHt0aGlzLmFwcC5wYWNrYWdlLmluc3RhbGxDaVRhc2submFtZX1gLFxuICAgICAgXSxcbiAgICAgIGRlcGxveUNvbW1hbmRzOiBbXG4gICAgICAgIC8vIFRPRE8gcHJlIGRlcGxveSBzdGVwc1xuICAgICAgICBgbnB4IHByb2plbiBkZXBsb3k6JHtzdGFnZS5uYW1lfWAsXG4gICAgICAgIC8vIFRPRE8gcG9zdCBkZXBsb3kgc3RlcHNcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cbn0iXX0=