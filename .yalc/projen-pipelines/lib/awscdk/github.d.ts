import { awscdk } from 'projen';
import { CDKPipeline, CDKPipelineOptions, DeploymentStage, IndependentStage } from './base';
import { PipelineEngine } from '../engine';
/**
 * Configuration interface for GitHub-specific IAM roles used in the CDK pipeline.
 */
export interface GithubIamRoleConfig {
    /** Default IAM role ARN used if no specific role is provided. */
    readonly default?: string;
    /** IAM role ARN for the synthesis step. */
    readonly synth?: string;
    /** IAM role ARN for the asset publishing step. */
    readonly assetPublishing?: string;
    /** IAM role ARN for the asset publishing step for a specific stage. */
    readonly assetPublishingPerStage?: {
        [stage: string]: string;
    };
    /** IAM role ARNs for different deployment stages. */
    readonly deployment?: {
        [stage: string]: string;
    };
}
/**
 * Extension of the base CDKPipeline options including specific configurations for GitHub.
 */
export interface GithubCDKPipelineOptions extends CDKPipelineOptions {
    /** IAM config for GitHub Actions */
    readonly iamRoleArns: GithubIamRoleConfig;
    /**
     * runner tags to use to select runners
     *
     * @default ['ubuntu-latest']
     */
    readonly runnerTags?: string[];
    /** use GitHub Packages to store vesioned artifacts of cloud assembly; also needed for manual approvals */
    readonly useGithubPackagesForAssembly?: boolean;
    /**
     * whether to use GitHub environments for deployment stages
     *
     * INFO: When using environments consider protection rules instead of using the manual option of projen-pipelines for stages
     *
     * @default false
     */
    readonly useGithubEnvironments?: boolean;
}
/**
 * Implements a CDK Pipeline configured specifically for GitHub workflows.
 */
export declare class GithubCDKPipeline extends CDKPipeline {
    private options;
    /** Indicates if versioned artifacts are needed based on manual approval requirements. */
    readonly needsVersionedArtifacts: boolean;
    /** The GitHub workflow associated with the pipeline. */
    private deploymentWorkflow;
    /** List of deployment stages for the pipeline. */
    private deploymentStages;
    protected useGithubPackages: boolean;
    /**
     * Constructs a new GithubCDKPipeline instance.
     * @param app - The CDK app associated with this pipeline.
     * @param options - Configuration options for the pipeline.
     */
    constructor(app: awscdk.AwsCdkTypeScriptApp, options: GithubCDKPipelineOptions);
    /** the type of engine this implementation of CDKPipeline is for */
    engineType(): PipelineEngine;
    /**
     * Creates a synthesis job for the pipeline using GitHub Actions.
     */
    private createSynth;
    /**
     * Creates a job to upload assets to AWS as part of the pipeline.
     */
    createAssetUpload(): void;
    /**
     * Creates a job to deploy the CDK application to AWS.
     * @param stage - The deployment stage to create.
     */
    createDeployment(stage: DeploymentStage): void;
    /**
     * Creates a job to deploy the CDK application to AWS.
     * @param stage - The independent stage to create.
     */
    createIndependentDeployment(stage: IndependentStage): void;
}
