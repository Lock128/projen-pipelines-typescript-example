import { awscdk } from 'projen';
import { CDKPipeline, CDKPipelineOptions, DeploymentStage } from './base';
import { PipelineEngine } from '../engine';
export interface CodeCatalystIamRoleConfig {
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
export interface CodeCatalystCDKPipelineOptions extends CDKPipelineOptions {
    readonly iamRoleArns: CodeCatalystIamRoleConfig;
}
export declare class CodeCatalystCDKPipeline extends CDKPipeline {
    private options;
    readonly needsVersionedArtifacts: boolean;
    private deploymentWorkflowBuilder;
    private environments;
    private deploymentStages;
    private readonly bp;
    constructor(app: awscdk.AwsCdkTypeScriptApp, options: CodeCatalystCDKPipelineOptions);
    createEnvironments(): void;
    /** the type of engine this implementation of CDKPipeline is for */
    engineType(): PipelineEngine;
    private createSynth;
    createAssetUpload(): void;
    createDeployment(stage: DeploymentStage): void;
    createIndependentDeployment(stage: DeploymentStage): void;
}
