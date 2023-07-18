import { awscdk } from 'projen';
import { AssetUploadStageOptions, BaseEngine, DeployStageOptions, SynthStageOptions } from './base';
import { CDKPipeline, CDKPipelineOptions } from '../pipeline';
export interface GithubEngineConfig {
    readonly defaultAwsRoleArn?: string;
    readonly awsRoleArnForSynth?: string;
    readonly awsRoleArnForAssetPublishing?: string;
    readonly awsRoleArnForDeployment?: {
        [stage: string]: string;
    };
}
export declare class GitHubEngine extends BaseEngine {
    readonly needsVersionedArtifacts: boolean;
    private deploymentWorkflow;
    private deploymentStages;
    constructor(app: awscdk.AwsCdkTypeScriptApp, props: CDKPipelineOptions, pipeline: CDKPipeline);
    createSynth(options: SynthStageOptions): void;
    createAssetUpload(options: AssetUploadStageOptions): void;
    createDeployment(options: DeployStageOptions): void;
}
