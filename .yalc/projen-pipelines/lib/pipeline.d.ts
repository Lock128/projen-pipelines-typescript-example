import { Component, awscdk } from 'projen';
import { BaseEngine, CodeCatalystEngineConfig, GithubEngineConfig } from './engine';
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
 * The CI/CD tooling used to run your pipeline.
 * The component will render workflows for the given system
 */
export declare enum PipelineEngine {
    /** Create GitHub actions */
    GITHUB = 0,
    /** Create a .gitlab-ci.yaml file */
    GITLAB = 1,
    CODE_CATALYST = 2
}
/**
 * Describes the type of pipeline that will be created
 */
export declare enum DeploymentType {
    /** Deploy every commit as far as possible; hopefully into production */
    CONTINUOUS_DEPLOYMENT = 0,
    /** Build every commit and prepare all assets for a later deployment */
    CONTINUOUS_DELIVERY = 1
}
export interface DeploymentStage {
    readonly name: string;
    readonly env: Environment;
    readonly manualApproval?: boolean;
}
/**
 * The CDKPipelineOptions interface is designed to provide configuration
 * options for a CDK (Cloud Development Kit) pipeline. It allows the definition
 * of settings such as the stack prefix and package namespace to be used in the
 * AWS stack, along with the environments configuration to be used.
 */
export interface CDKPipelineOptions {
    /**
     * This field is used to define a prefix for the AWS Stack resources created
     * during the pipeline's operation.
     *
     * @default project name
     */
    readonly stackPrefix?: string;
    /**
     * This field determines the NPM namespace to be used when packaging CDK cloud
     * assemblies. A namespace helps group related resources together, providing
     * better organization and ease of management.
     */
    readonly pkgNamespace: string;
    readonly stages: DeploymentStage[];
    readonly personalStage?: {
        readonly env: Environment;
    };
    readonly featureStages?: {
        readonly env: Environment;
    };
    /**
     * This field specifies the type of pipeline to create. If set to CONTINUOUS_DEPLOYMENT,
     * every commit is deployed as far as possible, hopefully into production. If set to
     * CONTINUOUS_DELIVERY, every commit is built and all assets are prepared for a later deployment.
     *
     * @default CONTINUOUS_DELIVERY
     */
    readonly deploymentType?: DeploymentType;
    /**
     * This field determines the CI/CD tooling that will be used to run the pipeline. The component
     * will render workflows for the given system. Options include GitHub and GitLab.
     *
     * @default - tries to derive it from the projects configuration
     */
    readonly engine?: PipelineEngine;
    readonly githubConfig?: GithubEngineConfig;
    readonly codecatalystConfig?: CodeCatalystEngineConfig;
    readonly preInstallCommands?: string[];
    readonly preSynthCommands?: string[];
    readonly postSynthCommands?: string[];
}
/**
 * The CDKPipeline class extends the Component class and sets up the necessary configuration for deploying AWS CDK (Cloud Development Kit) applications across multiple stages.
 * It also manages tasks such as publishing CDK assets, bumping version based on git tags, and cleaning up conflicting tasks.
 */
export declare class CDKPipeline extends Component {
    private app;
    private props;
    readonly stackPrefix: string;
    readonly engine: BaseEngine;
    constructor(app: awscdk.AwsCdkTypeScriptApp, props: CDKPipelineOptions);
    private createSynthStage;
    /**
     * This method generates the entry point for the application, including interfaces and classes
     * necessary to set up the pipeline and define the AWS CDK stacks for different environments.
     */
    private createApplicationEntrypoint;
    /**
     * This method sets up tasks to publish CDK assets to all accounts and handle versioning, including bumping the version
     * based on the latest git tag and pushing the CDK assembly to the package repository.
     */
    private createReleaseTasks;
    /**
     * This method sets up tasks for the personal deployment stage, including deployment, watching for changes,
     * comparing changes (diff), and destroying the stack when no longer needed.
     */
    private createPersonalStage;
    /**
     * This method sets up tasks for the feature deployment stage, including deployment, comparing changes (diff),
     * and destroying the stack when no longer needed.
     */
    private createFeatureStage;
    /**
     * This method sets up tasks for the general pipeline stages (dev, prod), including deployment and comparing changes (diff).
     * @param {DeployStageOptions} stage - The stage to create
     */
    private createPipelineStage;
}
