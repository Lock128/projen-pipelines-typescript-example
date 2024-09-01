import { Component, awscdk } from 'projen';
import { PipelineEngine } from '../engine';
import { PipelineStep } from '../steps';
/**
 * The Environment interface is designed to hold AWS related information
 * for a specific deployment environment within your infrastructure.
 * Each environment requires a specific account and region for its resources.
 */
export interface Environment {
    /**
     * The AWS Account ID associated with the environment. It's important because
     * different services or features could have distinct permissions and settings
     * in different accounts.
     */
    readonly account: string;
    /**
     * The AWS Region for the environment. This determines where your resources
     * are created and where your application will run. It can affect latency,
     * availability, and pricing.
     */
    readonly region: string;
}
/**
 * Options for stages that are part of the pipeline
 */
export interface DeploymentStage extends NamedStageOptions {
    readonly manualApproval?: boolean;
}
/**
 * Options for stages that are not part of the pipeline
 */
export interface IndependentStage extends NamedStageOptions {
    /**
     * This specifies whether the stage should be deployed on push
     *
     * @default false
     */
    readonly deployOnPush?: boolean;
    readonly postDiffSteps?: PipelineStep[];
    readonly postDeploySteps?: PipelineStep[];
}
/**
 * Options for a CDK stage with a name
 */
export interface NamedStageOptions extends StageOptions {
    readonly name: string;
    readonly watchable?: boolean;
}
/**
 * Options for a CDK stage like the target environment
 */
export interface StageOptions {
    readonly env: Environment;
}
/**
 * The CDKPipelineOptions interface is designed to provide configuration
 * options for a CDK (Cloud Development Kit) pipeline. It allows the definition
 * of settings such as the stack prefix and package namespace to be used in the
 * AWS stack, along with the environments configuration to be used.
 */
export interface CDKPipelineOptions {
    /**
     * the name of the branch to deploy from
     * @default main
     */
    readonly branchName?: string;
    /**
     * This field is used to define a prefix for the AWS Stack resources created
     * during the pipeline's operation.
     *
     * @default project name
     */
    readonly stackPrefix?: string;
    /**
     * If set to true all CDK actions will also include <stackName>/* to deploy/diff/destroy sub stacks of the main stack.
     * You can use this to deploy CDk applications containing multiple stacks.
     *
     * @default false
     */
    readonly deploySubStacks?: boolean;
    /**
     * This field determines the NPM namespace to be used when packaging CDK cloud
     * assemblies. A namespace helps group related resources together, providing
     * better organization and ease of management.
     */
    readonly pkgNamespace: string;
    /**
     * This field specifies a list of stages that should be deployed using a CI/CD pipeline
     */
    readonly stages: DeploymentStage[];
    /** This specifies details for independent stages */
    readonly independentStages?: IndependentStage[];
    /** This specifies details for a personal stage */
    readonly personalStage?: StageOptions;
    /** This specifies details for feature stages */
    readonly featureStages?: StageOptions;
    readonly preInstallCommands?: string[];
    readonly preSynthCommands?: string[];
    readonly postSynthCommands?: string[];
    readonly preInstallSteps?: PipelineStep[];
    readonly preSynthSteps?: PipelineStep[];
    readonly postSynthSteps?: PipelineStep[];
}
/**
 * The CDKPipeline class extends the Component class and sets up the necessary configuration for deploying AWS CDK (Cloud Development Kit) applications across multiple stages.
 * It also manages tasks such as publishing CDK assets, bumping version based on git tags, and cleaning up conflicting tasks.
 */
export declare abstract class CDKPipeline extends Component {
    protected app: awscdk.AwsCdkTypeScriptApp;
    protected baseOptions: CDKPipelineOptions;
    readonly stackPrefix: string;
    readonly branchName: string;
    constructor(app: awscdk.AwsCdkTypeScriptApp, baseOptions: CDKPipelineOptions);
    abstract engineType(): PipelineEngine;
    protected renderInstallCommands(): string[];
    protected renderInstallPackageCommands(packageName: string, runPreInstallCommands?: boolean): string[];
    protected renderSynthCommands(): string[];
    protected renderAssetUploadCommands(stageName?: string): string[];
    protected renderAssemblyUploadCommands(): string[];
    protected renderDeployCommands(stageName: string): string[];
    protected renderDiffCommands(stageName: string): string[];
    protected createSafeStageName(name: string): string;
    /**
     * This method generates the entry point for the application, including interfaces and classes
     * necessary to set up the pipeline and define the AWS CDK stacks for different environments.
     */
    protected createApplicationEntrypoint(): void;
    /**
     * This method sets up tasks to publish CDK assets to all accounts and handle versioning, including bumping the version
     * based on the latest git tag and pushing the CDK assembly to the package repository.
     */
    protected createReleaseTasks(): void;
    /**
     * This method sets up tasks for the personal deployment stage, including deployment, watching for changes,
     * comparing changes (diff), and destroying the stack when no longer needed.
     */
    protected createPersonalStage(): void;
    /**
     * This method sets up tasks for the feature deployment stage, including deployment, comparing changes (diff),
     * and destroying the stack when no longer needed.
     */
    protected createFeatureStage(): void;
    /**
     * This method sets up tasks for the general pipeline stages (dev, prod), including deployment and comparing changes (diff).
     * @param {DeployStageOptions} stage - The stage to create
     */
    protected createPipelineStage(stage: DeploymentStage): void;
    /**
     * This method sets up tasks for the independent stages including deployment and comparing changes (diff).
     * @param {NamedStageOptions} stage - The stage to create
     */
    protected createIndependentStage(stage: IndependentStage): void;
    protected getCliStackPattern(stage: string): string;
}
