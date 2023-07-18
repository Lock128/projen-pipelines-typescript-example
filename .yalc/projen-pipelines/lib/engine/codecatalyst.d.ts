import { awscdk } from 'projen';
import { AssetUploadStageOptions, BaseEngine, DeployStageOptions, SynthStageOptions } from './base';
import { CodeCatalyst } from './codecatalyst/codecatalyst';
import { CodeCatalystWorkflow } from './codecatalyst/workflow';
import { CDKPipeline, CDKPipelineOptions } from '../pipeline';
export interface CodeCatalystEngineConfig {
    readonly defaultAwsRoleArn?: string;
    readonly awsRoleArnForSynth?: string;
    readonly awsRoleArnForAssetPublishing?: string;
    readonly awsRoleArnForDeployment?: {
        [stage: string]: string;
    };
}
export declare class CodeCatalystEngine extends BaseEngine {
    readonly needsVersionedArtifacts: boolean;
    private deploymentWorkflow;
    private deploymentStages;
    readonly codecatalyst: CodeCatalyst | undefined;
    constructor(app: awscdk.AwsCdkTypeScriptApp, props: CDKPipelineOptions, pipeline: CDKPipeline);
    createSynth(options: SynthStageOptions): void;
    createAssetUpload(options: AssetUploadStageOptions): void;
    createDeployment(options: DeployStageOptions): void;
}
export { CodeCatalystWorkflow };
