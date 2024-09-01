import { Project } from 'projen';
import { GithubStepConfig, PipelineStep } from './step';
export interface GithubPackagesLoginStepOptions {
    /**
     * Whether or not to grant the step write permissions to the registry.
     *
     * @default false
     */
    readonly write?: boolean;
}
export declare class GithubPackagesLoginStep extends PipelineStep {
    private options;
    constructor(project: Project, options: GithubPackagesLoginStepOptions);
    toGithub(): GithubStepConfig;
}
