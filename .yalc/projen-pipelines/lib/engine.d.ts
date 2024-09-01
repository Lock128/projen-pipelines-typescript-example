/**
 * The CI/CD tooling used to run your pipeline.
 * The component will render workflows for the given system
 */
export declare enum PipelineEngine {
    /** Create GitHub actions */
    GITHUB = 0,
    /** Create a .gitlab-ci.yaml file */
    GITLAB = 1,
    CODE_CATALYST = 2,
    /** Create bash scripts */
    BASH = 3
}
