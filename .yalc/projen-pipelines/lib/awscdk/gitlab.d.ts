import { awscdk, gitlab } from 'projen';
import { CDKPipeline, CDKPipelineOptions, DeploymentStage, IndependentStage } from './base';
import { PipelineEngine } from '../engine';
/**
 * Configuration for IAM roles used within the GitLab CI/CD pipeline for various stages.
 * Allows specifying different IAM roles for synthesis, asset publishing, and deployment stages,
 * providing granular control over permissions.
 */
export interface GitlabIamRoleConfig {
    /** Default IAM role ARN used if specific stage role is not provided. */
    readonly default?: string;
    /** IAM role ARN for the synthesis stage. */
    readonly synth?: string;
    /** IAM role ARN for the asset publishing step. */
    readonly assetPublishing?: string;
    /** IAM role ARN for the asset publishing step for a specific stage. */
    readonly assetPublishingPerStage?: {
        [stage: string]: string;
    };
    /** A map of stage names to IAM role ARNs for the diff operation. */
    readonly diff?: {
        [stage: string]: string;
    };
    /** A map of stage names to IAM role ARNs for the deployment operation. */
    readonly deployment?: {
        [stage: string]: string;
    };
}
/**
 * Configuration for GitLab runner tags used within the CI/CD pipeline for various stages.
 * This allows for specifying different runners based on the tags for different stages of the pipeline.
 */
export interface GitlabRunnerTags {
    /** Default runner tags used if specific stage tags are not provided. */
    readonly default?: string[];
    /** Runner tags for the synthesis stage. */
    readonly synth?: string[];
    /** Runner tags for the asset publishing stage. */
    readonly assetPublishing?: string[];
    /** A map of stage names to runner tags for the diff operation. */
    readonly diff?: {
        [stage: string]: string[];
    };
    /** A map of stage names to runner tags for the deployment operation. */
    readonly deployment?: {
        [stage: string]: string[];
    };
}
/**
 * Options for configuring the GitLab CDK pipeline, extending the base CDK pipeline options.
 */
export interface GitlabCDKPipelineOptions extends CDKPipelineOptions {
    /** IAM role ARNs configuration for the pipeline. */
    readonly iamRoleArns: GitlabIamRoleConfig;
    /** Runner tags configuration for the pipeline. */
    readonly runnerTags?: GitlabRunnerTags;
    /** The Docker image to use for running the pipeline jobs. */
    readonly image?: string;
}
/**
 * The GitlabCDKPipeline class extends CDKPipeline to provide a way to configure and execute
 * AWS CDK deployment pipelines within GitLab CI/CD environments. It integrates IAM role management,
 * runner configuration, and defines stages and jobs for the deployment workflow.
 */
export declare class GitlabCDKPipeline extends CDKPipeline {
    private options;
    /** Indicates if versioned artifacts are required. Currently set to false  */
    readonly needsVersionedArtifacts: boolean;
    /** The Docker image used for pipeline jobs. Defaults to a specified image or a default value. */
    readonly jobImage: string;
    /** GitLab CI/CD configuration object. */
    readonly config: gitlab.GitlabConfiguration;
    /** List of deployment stages as strings. */
    private deploymentStages;
    /**
     * Constructs an instance of GitlabCDKPipeline, initializing the GitLab CI/CD configuration
     * and setting up the necessary stages and jobs for AWS CDK deployment.
     *
     * @param {awscdk.AwsCdkTypeScriptApp} app - The AWS CDK app associated with the pipeline.
     * @param {GitlabCDKPipelineOptions} options - Configuration options for the pipeline.
     */
    constructor(app: awscdk.AwsCdkTypeScriptApp, options: GitlabCDKPipelineOptions);
    /**
     * Sets up base job snippets for artifact handling and AWS configuration.
     * This method defines reusable job configurations to be extended by specific pipeline jobs,
     * facilitating artifact caching and AWS authentication setup.
     */
    protected setupSnippets(): void;
    /**
     * Creates the 'synth' stage of the pipeline to synthesize AWS CDK applications.
     * This method configures the job to execute CDK synthesis, applying the appropriate IAM role
     * for AWS commands and specifying runner tags for job execution. The synthesized outputs are
     * configured to be cached as artifacts.
     */
    protected createSynth(): void;
    /**
     * Sets up the asset publishing stage of the pipeline.
     * This method configures a job to upload synthesized assets to AWS, handling IAM role
     * authentication and specifying runner tags. It depends on the successful completion
     * of the 'synth' stage, ensuring assets are only published after successful synthesis.
     */
    protected createAssetUpload(): void;
    /**
     * Dynamically creates deployment stages based on the deployment configuration.
     * For each provided deployment stage, this method sets up jobs for 'diff' and 'deploy' actions,
     * applying the correct IAM roles and runner tags. It supports conditional manual approval for
     * deployment stages, providing flexibility in the deployment workflow.
     *
     * @param {DeploymentStage} stage - The deployment stage configuration to set up.
     */
    protected createDeployment(stage: DeploymentStage): void;
    /**
     * Creates a job to deploy the CDK application to AWS.
     * @param stage - The independent stage to create.
     */
    createIndependentDeployment(stage: IndependentStage): void;
    engineType(): PipelineEngine;
}
