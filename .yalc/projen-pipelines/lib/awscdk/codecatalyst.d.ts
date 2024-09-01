import { awscdk } from 'projen';
import { CDKPipeline, CDKPipelineOptions, DeploymentStage } from './base';
import { PipelineEngine } from '../engine';
export interface CodeCatalystIamRoleConfig {
    readonly default?: string;
    readonly synth?: string;
    readonly assetPublishing?: string;
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
    private deploymentStages;
    private readonly bp;
    constructor(app: awscdk.AwsCdkTypeScriptApp, options: CodeCatalystCDKPipelineOptions);
    /** the type of engine this implementation of CDKPipeline is for */
    engineType(): PipelineEngine;
    private createSynth;
    createAssetUpload(): void;
    createDeployment(stage: DeploymentStage): void;
    createWorkflowForStage(stage: DeploymentStage): void;
}
