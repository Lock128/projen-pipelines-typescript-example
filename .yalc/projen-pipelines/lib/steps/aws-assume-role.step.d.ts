import { Project } from 'projen';
import { GithubStepConfig, GitlabStepConfig, PipelineStep } from './step';
/**
 * Configuration for an AWS AssumeRoleStep
 */
export interface AwsAssumeRoleStepConfig {
    /** The ARN of the role to assume */
    readonly roleArn: string;
    /** An identifier for the assumed role session */
    readonly sessionName?: string;
    /** The AWS region that should be set */
    readonly region?: string;
}
/**
 * A step that assumes a role in AWS
 */
export declare class AwsAssumeRoleStep extends PipelineStep {
    private readonly config;
    constructor(project: Project, config: AwsAssumeRoleStepConfig);
    toGitlab(): GitlabStepConfig;
    toGithub(): GithubStepConfig;
}
