import { awscdk, gitlab } from 'projen';
import { CDKPipeline, CDKPipelineOptions, DeploymentStage } from './base';
export interface GitlabIamRoleConfig {
    readonly default?: string;
    readonly synth?: string;
    readonly assetPublishing?: string;
    readonly deployment?: {
        [stage: string]: string;
    };
}
export interface GitlabCDKPipelineOptions extends CDKPipelineOptions {
    readonly iamRoleArns: GitlabIamRoleConfig;
    readonly image?: string;
}
export declare class GitlabCDKPipeline extends CDKPipeline {
    private options;
    readonly needsVersionedArtifacts: boolean;
    readonly jobImage: string;
    readonly config: gitlab.GitlabConfiguration;
    private deploymentStages;
    constructor(app: awscdk.AwsCdkTypeScriptApp, options: GitlabCDKPipelineOptions);
    protected setupSnippets(): void;
    protected createSynth(): void;
    protected createAssetUpload(): void;
    protected createDeployment(stage: DeploymentStage): void;
}
