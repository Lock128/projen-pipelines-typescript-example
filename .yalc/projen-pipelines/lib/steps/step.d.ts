import { Project } from 'projen';
import { JobPermissions, JobStep } from 'projen/lib/github/workflows-model';
import { Need } from 'projen/lib/gitlab';
/**
 * Configuration interface for a GitLab CI step.
 */
export interface GitlabStepConfig {
    /** List of job extensions related to the step. */
    readonly extensions: string[];
    /** Dependencies which need to be completed before this step. */
    readonly needs: Need[];
    /** Shell commands to execute in this step. */
    readonly commands: string[];
    /** Additional environment variables to set for this step. */
    readonly env: {
        [key: string]: string;
    };
}
/**
 * Configuration interface for a GitHub Actions step.
 */
export interface GithubStepConfig {
    /** Dependencies which need to be completed before this step. */
    readonly needs: string[];
    /** Commands wrapped as GitHub Action job steps. */
    readonly steps: JobStep[];
    /** Additional environment variables to set for this step. */
    readonly env: {
        [key: string]: string;
    };
    /** Additional job permissions needed */
    readonly permissions?: JobPermissions;
}
/**
 * Configuration interface for a bash script step.
 */
export interface BashStepConfig {
    /** Shell commands to execute. */
    readonly commands: string[];
}
/**
 * Abstract class defining the structure of a pipeline step.
 */
export declare abstract class PipelineStep {
    protected project: Project;
    /**
     * Initializes a new instance of a PipelineStep with a reference to a projen project.
     * @param project - The projen project reference.
     */
    constructor(project: Project);
    /**
     * Generates a configuration for a GitLab CI step. Should be implemented by subclasses.
     */
    toGitlab(): GitlabStepConfig;
    /**
     * Generates a configuration for a GitHub Actions step. Should be implemented by subclasses.
     */
    toGithub(): GithubStepConfig;
    /**
     * Generates a configuration for a bash script step. Should be implemented by subclasses.
     */
    toBash(): BashStepConfig;
}
/**
 * Concrete implementation of PipelineStep that executes simple commands.
 */
export declare class SimpleCommandStep extends PipelineStep {
    protected commands: string[];
    /**
     * Constructs a simple command step with a specified set of commands.
     * @param project - The projen project reference.
     * @param commands - Shell commands to execute.
     */
    constructor(project: Project, commands: string[]);
    /**
     * Converts the step into a GitLab CI configuration.
     */
    toGitlab(): GitlabStepConfig;
    /**
     * Converts the step into a Bash script configuration.
     */
    toBash(): BashStepConfig;
    /**
     * Converts the step into a GitHub Actions step configuration.
     */
    toGithub(): GithubStepConfig;
}
