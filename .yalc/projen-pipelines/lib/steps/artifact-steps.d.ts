import { Project } from 'projen';
import { CodeCatalystStepConfig, GithubStepConfig, GitlabStepConfig, PipelineStep } from './step';
export interface DownloadArtifactStepConfig {
    readonly name: string;
    readonly path: string;
}
export declare class DownloadArtifactStep extends PipelineStep {
    private readonly config;
    constructor(project: Project, config: DownloadArtifactStepConfig);
    toGitlab(): GitlabStepConfig;
    toGithub(): GithubStepConfig;
    /**
     * Converts the step into a CodeCatalyst Actions step configuration.
     */
    toCodeCatalyst(): CodeCatalystStepConfig;
}
export interface UploadArtifactStepConfig {
    readonly name: string;
    readonly path: string;
}
export declare class UploadArtifactStep extends PipelineStep {
    private readonly config;
    constructor(project: Project, config: UploadArtifactStepConfig);
    toGithub(): GithubStepConfig;
    /**
     * Converts the step into a CodeCatalyst Actions step configuration.
     */
    toCodeCatalyst(): CodeCatalystStepConfig;
}
