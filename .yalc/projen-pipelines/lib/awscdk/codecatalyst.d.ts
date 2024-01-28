import { awscdk } from 'projen';
import { CDKPipeline, CDKPipelineOptions, DeploymentStage } from './base';
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
    private bp;
    constructor(app: awscdk.AwsCdkTypeScriptApp, options: CodeCatalystCDKPipelineOptions);
    private createSynth;
    createAssetUpload(): void;
    createDeployment(stage: DeploymentStage): void;
    createWorkflowForStage(stage: DeploymentStage): void;
}
