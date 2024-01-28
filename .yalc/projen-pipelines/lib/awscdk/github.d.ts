import { awscdk } from 'projen';
import { CDKPipeline, CDKPipelineOptions, DeploymentStage } from './base';
export interface GithubIamRoleConfig {
    readonly default?: string;
    readonly synth?: string;
    readonly assetPublishing?: string;
    readonly deployment?: {
        [stage: string]: string;
    };
}
export interface GithubCDKPipelineOptions extends CDKPipelineOptions {
    readonly iamRoleArns: GithubIamRoleConfig;
}
export declare class GithubCDKPipeline extends CDKPipeline {
    private options;
    readonly needsVersionedArtifacts: boolean;
    private deploymentWorkflow;
    private deploymentStages;
    constructor(app: awscdk.AwsCdkTypeScriptApp, options: GithubCDKPipelineOptions);
    private createSynth;
    createAssetUpload(): void;
    createDeployment(stage: DeploymentStage): void;
}
