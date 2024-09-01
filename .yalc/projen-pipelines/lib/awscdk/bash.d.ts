import { awscdk } from 'projen';
import { CDKPipeline, CDKPipelineOptions } from './base';
import { PipelineEngine } from '../engine';
export interface BashCDKPipelineOptions extends CDKPipelineOptions {
}
export declare class BashCDKPipeline extends CDKPipeline {
    constructor(app: awscdk.AwsCdkTypeScriptApp, options: BashCDKPipelineOptions);
    engineType(): PipelineEngine;
}
