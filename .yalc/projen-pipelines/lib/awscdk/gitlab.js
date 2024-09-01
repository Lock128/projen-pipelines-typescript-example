"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitlabCDKPipeline = void 0;
const JSII_RTTI_SYMBOL_1 = Symbol.for("jsii.rtti");
const projen_1 = require("projen");
const base_1 = require("./base");
const engine_1 = require("../engine");
const steps_1 = require("../steps");
const aws_assume_role_step_1 = require("../steps/aws-assume-role.step");
/**
 * The GitlabCDKPipeline class extends CDKPipeline to provide a way to configure and execute
 * AWS CDK deployment pipelines within GitLab CI/CD environments. It integrates IAM role management,
 * runner configuration, and defines stages and jobs for the deployment workflow.
 */
class GitlabCDKPipeline extends base_1.CDKPipeline {
    /**
     * Constructs an instance of GitlabCDKPipeline, initializing the GitLab CI/CD configuration
     * and setting up the necessary stages and jobs for AWS CDK deployment.
     *
     * @param {awscdk.AwsCdkTypeScriptApp} app - The AWS CDK app associated with the pipeline.
     * @param {GitlabCDKPipelineOptions} options - Configuration options for the pipeline.
     */
    constructor(app, options) {
        super(app, options);
        this.options = options;
        /** List of deployment stages as strings. */
        this.deploymentStages = [];
        // TODO use existing config if possible
        this.config = new projen_1.gitlab.GitlabConfiguration(app, {
            stages: [],
            jobs: {},
        });
        this.needsVersionedArtifacts = false; // options.publishedCloudAssemblies ?? false;
        this.jobImage = options.image ?? 'image: jsii/superchain:1-buster-slim-node18';
        this.setupSnippets();
        this.createSynth();
        this.createAssetUpload();
        for (const stage of options.stages) {
            this.createDeployment(stage);
        }
        for (const stage of (options.independentStages ?? [])) {
            this.createIndependentDeployment(stage);
        }
    }
    /**
     * Sets up base job snippets for artifact handling and AWS configuration.
     * This method defines reusable job configurations to be extended by specific pipeline jobs,
     * facilitating artifact caching and AWS authentication setup.
     */
    setupSnippets() {
        this.config.addJobs({
            '.artifacts_cdk': {
                artifacts: {
                    when: projen_1.gitlab.CacheWhen.ON_SUCCESS,
                    expireIn: '30 days',
                    name: 'CDK Assembly - $CI_JOB_NAME-$CI_COMMIT_REF_SLUG',
                    untracked: false,
                    paths: ['cdk.out'],
                },
            },
            '.artifacts_cdkdeploy': {
                artifacts: {
                    when: projen_1.gitlab.CacheWhen.ON_SUCCESS,
                    expireIn: '30 days',
                    name: 'CDK Outputs - $CI_JOB_NAME-$CI_COMMIT_REF_SLUG',
                    untracked: false,
                    paths: ['cdk-outputs-*.json'],
                },
            },
            '.aws_base': {
                image: { name: this.jobImage },
                idTokens: {
                    AWS_TOKEN: {
                        aud: 'https://sts.amazonaws.com',
                    },
                },
                variables: {
                    CI: 'true',
                    // NPM_REGISTRY: 'xxx'
                },
                beforeScript: [
                    `check_variables_defined() {
  for var in "$@"; do
    if [ -z "$(eval "echo \\$$var")" ]; then
      log_fatal "\${var} not defined";
    fi
  done
}

awslogin() {
  roleArn=\${1: -\${AWS_ROLE_ARN}}
  sessionName=\${2:-GitLabRunner-\${CI_PROJECT_ID}-\${CI_PIPELINE_ID}}
  check_variables_defined roleArn AWS_TOKEN
  export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" $(aws sts assume-role-with-web-identity --role-arn \${roleArn} --role-session-name "\${sessionName}" --web-identity-token \${AWS_TOKEN} --duration-seconds 3600 --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' --output text))
  # TODO CODE ARTIFACT
}
`,
                ],
            },
        });
    }
    /**
     * Creates the 'synth' stage of the pipeline to synthesize AWS CDK applications.
     * This method configures the job to execute CDK synthesis, applying the appropriate IAM role
     * for AWS commands and specifying runner tags for job execution. The synthesized outputs are
     * configured to be cached as artifacts.
     */
    createSynth() {
        const steps = [];
        if (this.options.iamRoleArns?.synth) {
            steps.push(new aws_assume_role_step_1.AwsAssumeRoleStep(this.project, {
                roleArn: this.options.iamRoleArns.synth,
            }));
        }
        steps.push(...this.options.preInstallSteps ?? []);
        steps.push(new steps_1.SimpleCommandStep(this.project, this.renderInstallCommands()));
        steps.push(...this.options.preSynthSteps ?? []);
        steps.push(new steps_1.SimpleCommandStep(this.project, this.renderSynthCommands()));
        steps.push(...this.options.postSynthSteps ?? []);
        const gitlabSteps = steps.map(s => s.toGitlab());
        this.config.addStages('synth');
        this.config.addJobs({
            synth: {
                extends: ['.aws_base', '.artifacts_cdk', ...gitlabSteps.flatMap(s => s.extensions)],
                needs: gitlabSteps.flatMap(s => s.needs),
                stage: 'synth',
                tags: this.options.runnerTags?.synth ?? this.options.runnerTags?.default,
                script: gitlabSteps.flatMap(s => s.commands),
                variables: gitlabSteps.reduce((acc, step) => ({ ...acc, ...step.env }), {}),
            },
        });
    }
    /**
     * Sets up the asset publishing stage of the pipeline.
     * This method configures a job to upload synthesized assets to AWS, handling IAM role
     * authentication and specifying runner tags. It depends on the successful completion
     * of the 'synth' stage, ensuring assets are only published after successful synthesis.
     */
    createAssetUpload() {
        const steps = [];
        const globalPublishRole = this.options.iamRoleArns.assetPublishing ?? this.options.iamRoleArns.default;
        if (globalPublishRole) {
            steps.push(new aws_assume_role_step_1.AwsAssumeRoleStep(this.project, {
                roleArn: globalPublishRole,
            }));
        }
        steps.push(...this.options.preInstallSteps ?? []);
        steps.push(new steps_1.SimpleCommandStep(this.project, this.renderInstallCommands()));
        if (this.options.iamRoleArns.assetPublishingPerStage) {
            const stages = [...this.options.stages, ...this.options.independentStages ?? []];
            for (const stage of stages) {
                steps.push(new aws_assume_role_step_1.AwsAssumeRoleStep(this.project, {
                    roleArn: this.options.iamRoleArns.assetPublishingPerStage[stage.name] ?? globalPublishRole,
                }));
                steps.push(new steps_1.SimpleCommandStep(this.project, this.renderAssetUploadCommands(stage.name)));
            }
        }
        else {
            steps.push(new steps_1.SimpleCommandStep(this.project, this.renderAssetUploadCommands()));
        }
        if (this.needsVersionedArtifacts) {
            steps.push(new steps_1.SimpleCommandStep(this.project, this.renderAssemblyUploadCommands()));
        }
        const gitlabSteps = steps.map(s => s.toGitlab());
        this.config.addStages('publish_assets');
        this.config.addJobs({
            publish_assets: {
                extends: ['.aws_base', ...gitlabSteps.flatMap(s => s.extensions)],
                stage: 'publish_assets',
                tags: this.options.runnerTags?.assetPublishing ?? this.options.runnerTags?.default,
                needs: [{ job: 'synth', artifacts: true }, ...gitlabSteps.flatMap(s => s.needs)],
                script: gitlabSteps.flatMap(s => s.commands),
                variables: gitlabSteps.reduce((acc, step) => ({ ...acc, ...step.env }), {}),
            },
        });
    }
    /**
     * Dynamically creates deployment stages based on the deployment configuration.
     * For each provided deployment stage, this method sets up jobs for 'diff' and 'deploy' actions,
     * applying the correct IAM roles and runner tags. It supports conditional manual approval for
     * deployment stages, providing flexibility in the deployment workflow.
     *
     * @param {DeploymentStage} stage - The deployment stage configuration to set up.
     */
    createDeployment(stage) {
        const diffSteps = [
            new aws_assume_role_step_1.AwsAssumeRoleStep(this.project, {
                roleArn: this.options.iamRoleArns?.diff?.[stage.name]
                    ?? this.options.iamRoleArns?.deployment?.[stage.name]
                    ?? this.options.iamRoleArns?.default,
            }),
            ...this.options.preInstallSteps ?? [],
            new steps_1.SimpleCommandStep(this.project, this.renderInstallCommands()),
            new steps_1.SimpleCommandStep(this.project, this.renderDiffCommands(stage.name)),
        ].map(s => s.toGitlab());
        const deploySteps = [
            new aws_assume_role_step_1.AwsAssumeRoleStep(this.project, {
                roleArn: this.options.iamRoleArns?.deployment?.[stage.name] ?? this.options.iamRoleArns?.default,
            }),
            ...this.options.preInstallSteps ?? [],
            new steps_1.SimpleCommandStep(this.project, this.renderInstallCommands()),
            new steps_1.SimpleCommandStep(this.project, this.renderDeployCommands(stage.name)),
        ].map(s => s.toGitlab());
        this.config.addStages(stage.name);
        this.config.addJobs({
            [`diff-${stage.name}`]: {
                extends: ['.aws_base', ...diffSteps.flatMap(s => s.extensions)],
                stage: stage.name,
                tags: this.options.runnerTags?.diff?.[stage.name] ?? this.options.runnerTags?.deployment?.[stage.name] ?? this.options.runnerTags?.default,
                only: {
                    refs: [this.branchName],
                },
                needs: [
                    { job: 'synth', artifacts: true },
                    { job: 'publish_assets' },
                    ...diffSteps.flatMap(s => s.needs),
                ],
                script: diffSteps.flatMap(s => s.commands),
                variables: diffSteps.reduce((acc, step) => ({ ...acc, ...step.env }), {}),
            },
            [`deploy-${stage.name}`]: {
                extends: ['.aws_base', '.artifacts_cdkdeploy', ...deploySteps.flatMap(s => s.extensions)],
                stage: stage.name,
                tags: this.options.runnerTags?.deployment?.[stage.name] ?? this.options.runnerTags?.default,
                ...stage.manualApproval && {
                    when: projen_1.gitlab.JobWhen.MANUAL,
                },
                only: {
                    refs: [this.branchName],
                },
                needs: [
                    { job: 'synth', artifacts: true },
                    { job: 'publish_assets' },
                    { job: `diff-${stage.name}` },
                    ...deploySteps.flatMap(s => s.needs),
                ],
                script: deploySteps.flatMap(s => s.commands),
                variables: deploySteps.reduce((acc, step) => ({ ...acc, ...step.env }), {}),
            },
        });
        this.deploymentStages.push(stage.name);
    }
    /**
     * Creates a job to deploy the CDK application to AWS.
     * @param stage - The independent stage to create.
     */
    createIndependentDeployment(stage) {
        const steps = [
            new aws_assume_role_step_1.AwsAssumeRoleStep(this.project, {
                roleArn: this.options.iamRoleArns?.deployment?.[stage.name] ?? this.options.iamRoleArns?.default,
                region: stage.env.region,
            }),
            ...this.options.preInstallSteps ?? [],
            new steps_1.SimpleCommandStep(this.project, this.renderInstallCommands()),
            ...this.options.preSynthSteps ?? [],
            new steps_1.SimpleCommandStep(this.project, this.renderSynthCommands()),
            ...this.options.postSynthSteps ?? [],
            new steps_1.SimpleCommandStep(this.project, this.renderDiffCommands(stage.name)),
            ...stage.postDiffSteps ?? [],
            new steps_1.SimpleCommandStep(this.project, this.renderDeployCommands(stage.name)),
            ...stage.postDeploySteps ?? [],
        ].map(s => s.toGitlab());
        this.config.addStages(stage.name);
        this.config.addJobs({
            [`deploy-${stage.name}`]: {
                extends: ['.aws_base', '.artifacts_cdkdeploy', ...steps.flatMap(s => s.extensions)],
                stage: stage.name,
                tags: this.options.runnerTags?.deployment?.[stage.name] ?? this.options.runnerTags?.default,
                ...stage.deployOnPush && {
                    only: {
                        refs: [this.branchName],
                    },
                },
                ...!stage.deployOnPush && {
                    when: projen_1.gitlab.JobWhen.MANUAL,
                },
                needs: steps.flatMap(s => s.needs),
                script: steps.flatMap(s => s.commands),
                variables: steps.reduce((acc, step) => ({ ...acc, ...step.env }), {}),
            },
        });
    }
    engineType() {
        return engine_1.PipelineEngine.GITLAB;
    }
}
exports.GitlabCDKPipeline = GitlabCDKPipeline;
_a = JSII_RTTI_SYMBOL_1;
GitlabCDKPipeline[_a] = { fqn: "projen-pipelines.GitlabCDKPipeline", version: "0.0.0" };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0bGFiLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2F3c2Nkay9naXRsYWIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxtQ0FBd0M7QUFDeEMsaUNBQTRGO0FBQzVGLHNDQUEyQztBQUMzQyxvQ0FBMkQ7QUFDM0Qsd0VBQWtFO0FBcURsRTs7OztHQUlHO0FBQ0gsTUFBYSxpQkFBa0IsU0FBUSxrQkFBVztJQWNoRDs7Ozs7O09BTUc7SUFDSCxZQUFZLEdBQStCLEVBQVUsT0FBaUM7UUFDcEYsS0FBSyxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUQrQixZQUFPLEdBQVAsT0FBTyxDQUEwQjtRQVZ0Riw0Q0FBNEM7UUFDcEMscUJBQWdCLEdBQWEsRUFBRSxDQUFDO1FBWXRDLHVDQUF1QztRQUN2QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksZUFBTSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsRUFBRTtZQUNoRCxNQUFNLEVBQUUsRUFBRTtZQUNWLElBQUksRUFBRSxFQUFFO1NBQ1QsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHVCQUF1QixHQUFHLEtBQUssQ0FBQyxDQUFDLDZDQUE2QztRQUNuRixJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxLQUFLLElBQUksNkNBQTZDLENBQUM7UUFFL0UsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBRXJCLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUVuQixJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUV6QixLQUFLLE1BQU0sS0FBSyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNuQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDL0IsQ0FBQztRQUVELEtBQUssTUFBTSxLQUFLLElBQUksQ0FBQyxPQUFPLENBQUMsaUJBQWlCLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQztZQUN0RCxJQUFJLENB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SSxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2FBQ3RFO1NBQ0YsQ0FBQyxDQUFDO0lBRUwsQ0FBQztJQUVNLFVBQVU7UUFDZixPQUFPLHVCQUFjLENBQUMsTUFBTSxDQUFDO0lBQy9CLENBQUM7O0FBdFRILDhDQXdUQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGF3c2NkaywgZ2l0bGFiIH0gZnJvbSAncHJvamVuJztcbmltcG9ydCB7IENES1BpcGVsaW5lLCBDREtQaXBlbGluZU9wdGlvbnMsIERlcGxveW1lbnRTdGFnZSwgSW5kZXBlbmRlbnRTdGFnZSB9IGZyb20gJy4vYmFzZSc7XG5pbXBvcnQgeyBQaXBlbGluZUVuZ2luZSB9IGZyb20gJy4uL2VuZ2luZSc7XG5pbXBvcnQgeyBQaXBlbGluZVN0ZXAsIFNpbXBsZUNvbW1hbmRTdGVwIH0gZnJvbSAnLi4vc3RlcHMnO1xuaW1wb3J0IHsgQXdzQXNzdW1lUm9sZVN0ZXAgfSBmcm9tICcuLi9zdGVwcy9hd3MtYXNzdW1lLXJvbGUuc3RlcCc7XG5cbi8qKlxuICogQ29uZmlndXJhdGlvbiBmb3IgSUFNIHJvbGVzIHVzZWQgd2l0aGluIHRoZSBHaXRMYWIgQ0kvQ0QgcGlwZWxpbmUgZm9yIHZhcmlvdXMgc3RhZ2VzLlxuICogQWxsb3dzIHNwZWNpZnlpbmcgZGlmZmVyZW50IElBTSByb2xlcyBmb3Igc3ludGhlc2lzLCBhc3NldCBwdWJsaXNoaW5nLCBhbmQgZGVwbG95bWVudCBzdGFnZXMsXG4gKiBwcm92aWRpbmcgZ3JhbnVsYXIgY29udHJvbCBvdmVyIHBlcm1pc3Npb25zLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEdpdGxhYklhbVJvbGVDb25maWcge1xuICAvKiogRGVmYXVsdCBJQU0gcm9sZSBBUk4gdXNlZCBpZiBzcGVjaWZpYyBzdGFnZSByb2xlIGlzIG5vdCBwcm92aWRlZC4gKi9cbiAgcmVhZG9ubHkgZGVmYXVsdD86IHN0cmluZztcbiAgLyoqIElBTSByb2xlIEFSTiBmb3IgdGhlIHN5bnRoZXNpcyBzdGFnZS4gKi9cbiAgcmVhZG9ubHkgc3ludGg/OiBzdHJpbmc7XG4gIC8qKiBJQU0gcm9sZSBBUk4gZm9yIHRoZSBhc3NldCBwdWJsaXNoaW5nIHN0ZXAuICovXG4gIHJlYWRvbmx5IGFzc2V0UHVibGlzaGluZz86IHN0cmluZztcbiAgLyoqIElBTSByb2xlIEFSTiBmb3IgdGhlIGFzc2V0IHB1Ymxpc2hpbmcgc3RlcCBmb3IgYSBzcGVjaWZpYyBzdGFnZS4gKi9cbiAgcmVhZG9ubHkgYXNzZXRQdWJsaXNoaW5nUGVyU3RhZ2U/OiB7IFtzdGFnZTogc3RyaW5nXTogc3RyaW5nIH07XG4gIC8qKiBBIG1hcCBvZiBzdGFnZSBuYW1lcyB0byBJQU0gcm9sZSBBUk5zIGZvciB0aGUgZGlmZiBvcGVyYXRpb24uICovXG4gIHJlYWRvbmx5IGRpZmY/OiB7IFtzdGFnZTogc3RyaW5nXTogc3RyaW5nIH07XG4gIC8qKiBBIG1hcCBvZiBzdGFnZSBuYW1lcyB0byBJQU0gcm9sZSBBUk5zIGZvciB0aGUgZGVwbG95bWVudCBvcGVyYXRpb24uICovXG4gIHJlYWRvbmx5IGRlcGxveW1lbnQ/OiB7IFtzdGFnZTogc3RyaW5nXTogc3RyaW5nIH07XG59XG5cbi8qKlxuICogQ29uZmlndXJhdGlvbiBmb3IgR2l0TGFiIHJ1bm5lciB0YWdzIHVzZWQgd2l0aGluIHRoZSBDSS9DRCBwaXBlbGluZSBmb3IgdmFyaW91cyBzdGFnZXMuXG4gKiBUaGlzIGFsbG93cyBmb3Igc3BlY2lmeWluZyBkaWZmZXJlbnQgcnVubmVycyBiYXNlZCBvbiB0aGUgdGFncyBmb3IgZGlmZmVyZW50IHN0YWdlcyBvZiB0aGUgcGlwZWxpbmUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgR2l0bGFiUnVubmVyVGFncyB7XG4gIC8qKiBEZWZhdWx0IHJ1bm5lciB0YWdzIHVzZWQgaWYgc3BlY2lmaWMgc3RhZ2UgdGFncyBhcmUgbm90IHByb3ZpZGVkLiAqL1xuICByZWFkb25seSBkZWZhdWx0Pzogc3RyaW5nW107XG4gIC8qKiBSdW5uZXIgdGFncyBmb3IgdGhlIHN5bnRoZXNpcyBzdGFnZS4gKi9cbiAgcmVhZG9ubHkgc3ludGg/OiBzdHJpbmdbXTtcbiAgLyoqIFJ1bm5lciB0YWdzIGZvciB0aGUgYXNzZXQgcHVibGlzaGluZyBzdGFnZS4gKi9cbiAgcmVhZG9ubHkgYXNzZXRQdWJsaXNoaW5nPzogc3RyaW5nW107XG4gIC8qKiBBIG1hcCBvZiBzdGFnZSBuYW1lcyB0byBydW5uZXIgdGFncyBmb3IgdGhlIGRpZmYgb3BlcmF0aW9uLiAqL1xuICByZWFkb25seSBkaWZmPzogeyBbc3RhZ2U6IHN0cmluZ106IHN0cmluZ1tdIH07XG4gIC8qKiBBIG1hcCBvZiBzdGFnZSBuYW1lcyB0byBydW5uZXIgdGFncyBmb3IgdGhlIGRlcGxveW1lbnQgb3BlcmF0aW9uLiAqL1xuICByZWFkb25seSBkZXBsb3ltZW50PzogeyBbc3RhZ2U6IHN0cmluZ106IHN0cmluZ1tdIH07XG59XG5cbi8qKlxuICogT3B0aW9ucyBmb3IgY29uZmlndXJpbmcgdGhlIEdpdExhYiBDREsgcGlwZWxpbmUsIGV4dGVuZGluZyB0aGUgYmFzZSBDREsgcGlwZWxpbmUgb3B0aW9ucy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBHaXRsYWJDREtQaXBlbGluZU9wdGlvbnMgZXh0ZW5kcyBDREtQaXBlbGluZU9wdGlvbnMge1xuICAvKiogSUFNIHJvbGUgQVJOcyBjb25maWd1cmF0aW9uIGZvciB0aGUgcGlwZWxpbmUuICovXG4gIHJlYWRvbmx5IGlhbVJvbGVBcm5zOiBHaXRsYWJJYW1Sb2xlQ29uZmlnO1xuICAvKiogUnVubmVyIHRhZ3MgY29uZmlndXJhdGlvbiBmb3IgdGhlIHBpcGVsaW5lLiAqL1xuICByZWFkb25seSBydW5uZXJUYWdzPzogR2l0bGFiUnVubmVyVGFncztcbiAgLyoqIFRoZSBEb2NrZXIgaW1hZ2UgdG8gdXNlIGZvciBydW5uaW5nIHRoZSBwaXBlbGluZSBqb2JzLiAqL1xuICByZWFkb25seSBpbWFnZT86IHN0cmluZztcblxuICAvLyByZWFkb25seSBwdWJsaXNoZWRDbG91ZEFzc2VtYmxpZXM/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIFRoZSBHaXRsYWJDREtQaXBlbGluZSBjbGFzcyBleHRlbmRzIENES1BpcGVsaW5lIHRvIHByb3ZpZGUgYSB3YXkgdG8gY29uZmlndXJlIGFuZCBleGVjdXRlXG4gKiBBV1MgQ0RLIGRlcGxveW1lbnQgcGlwZWxpbmVzIHdpdGhpbiBHaXRMYWIgQ0kvQ0QgZW52aXJvbm1lbnRzLiBJdCBpbnRlZ3JhdGVzIElBTSByb2xlIG1hbmFnZW1lbnQsXG4gKiBydW5uZXIgY29uZmlndXJhdGlvbiwgYW5kIGRlZmluZXMgc3RhZ2VzIGFuZCBqb2JzIGZvciB0aGUgZGVwbG95bWVudCB3b3JrZmxvdy5cbiAqL1xuZXhwb3J0IGNsYXNzIEdpdGxhYkNES1BpcGVsaW5lIGV4dGVuZHMgQ0RLUGlwZWxpbmUge1xuXG4gIC8qKiBJbmRpY2F0ZXMgaWYgdmVyc2lvbmVkIGFydGlmYWN0cyBhcmUgcmVxdWlyZWQuIEN1cnJlbnRseSBzZXQgdG8gZmFsc2UgICovXG4gIHB1YmxpYyByZWFkb25seSBuZWVkc1ZlcnNpb25lZEFydGlmYWN0czogYm9vbGVhbjtcblxuICAvKiogVGhlIERvY2tlciBpbWFnZSB1c2VkIGZvciBwaXBlbGluZSBqb2JzLiBEZWZhdWx0cyB0byBhIHNwZWNpZmllZCBpbWFnZSBvciBhIGRlZmF1bHQgdmFsdWUuICovXG4gIHB1YmxpYyByZWFkb25seSBqb2JJbWFnZTogc3RyaW5nO1xuXG4gIC8qKiBHaXRMYWIgQ0kvQ0QgY29uZmlndXJhdGlvbiBvYmplY3QuICovXG4gIHB1YmxpYyByZWFkb25seSBjb25maWc6IGdpdGxhYi5HaXRsYWJDb25maWd1cmF0aW9uO1xuXG4gIC8qKiBMaXN0IG9mIGRlcGxveW1lbnQgc3RhZ2VzIGFzIHN0cmluZ3MuICovXG4gIHByaXZhdGUgZGVwbG95bWVudFN0YWdlczogc3RyaW5nW10gPSBbXTtcblxuICAvKipcbiAgICogQ29uc3RydWN0cyBhbiBpbnN0YW5jZSBvZiBHaXRsYWJDREtQaXBlbGluZSwgaW5pdGlhbGl6aW5nIHRoZSBHaXRMYWIgQ0kvQ0QgY29uZmlndXJhdGlvblxuICAgKiBhbmQgc2V0dGluZyB1cCB0aGUgbmVjZXNzYXJ5IHN0YWdlcyBhbmQgam9icyBmb3IgQVdTIENESyBkZXBsb3ltZW50LlxuICAgKlxuICAgKiBAcGFyYW0ge2F3c2Nkay5Bd3NDZGtUeXBlU2NyaXB0QXBwfSBhcHAgLSBUaGUgQVdTIENESyBhcHAgYXNzb2NpYXRlZCB3aXRoIHRoZSBwaXBlbGluZS5cbiAgICogQHBhcmFtIHtHaXRsYWJDREtQaXBlbGluZU9wdGlvbnN9IG9wdGlvbnMgLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBwaXBlbGluZS5cbiAgICovXG4gIGNvbnN0cnVjdG9yKGFwcDogYXdzY2RrLkF3c0Nka1R5cGVTY3JpcHRBcHAsIHByaXZhdGUgb3B0aW9uczogR2l0bGFiQ0RLUGlwZWxpbmVPcHRpb25zKSB7XG4gICAgc3VwZXIoYXBwLCBvcHRpb25zKTtcblxuICAgIC8vIFRPRE8gdXNlIGV4aXN0aW5nIGNvbmZpZyBpZiBwb3NzaWJsZVxuICAgIHRoaXMuY29uZmlnID0gbmV3IGdpdGxhYi5HaXRsYWJDb25maWd1cmF0aW9uKGFwcCwge1xuICAgICAgc3RhZ2VzOiBbXSxcbiAgICAgIGpvYnM6IHt9LFxuICAgIH0pO1xuXG4gICAgdGhpcy5uZWVkc1ZlcnNpb25lZEFydGlmYWN0cyA9IGZhbHNlOyAvLyBvcHRpb25zLnB1Ymxpc2hlZENsb3VkQXNzZW1ibGllcyA/PyBmYWxzZTtcbiAgICB0aGlzLmpvYkltYWdlID0gb3B0aW9ucy5pbWFnZSA/PyAnaW1hZ2U6IGpzaWkvc3VwZXJjaGFpbjoxLWJ1c3Rlci1zbGltLW5vZGUxOCc7XG5cbiAgICB0aGlzLnNldHVwU25pcHBldHMoKTtcblxuICAgIHRoaXMuY3JlYXRlU3ludGgoKTtcblxuICAgIHRoaXMuY3JlYXRlQXNzZXRVcGxvYWQoKTtcblxuICAgIGZvciAoY29uc3Qgc3RhZ2Ugb2Ygb3B0aW9ucy5zdGFnZXMpIHtcbiAgICAgIHRoaXMuY3JlYXRlRGVwbG95bWVudChzdGFnZSk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBzdGFnZSBvZiAob3B0aW9ucy5pbmRlcGVuZGVudFN0YWdlcyA/PyBbXSkpIHtcbiAgICAgIHRoaXMuY3JlYXRlSW5kZXBlbmRlbnREZXBsb3ltZW50KHN0YWdlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB1cCBiYXNlIGpvYiBzbmlwcGV0cyBmb3IgYXJ0aWZhY3QgaGFuZGxpbmcgYW5kIEFXUyBjb25maWd1cmF0aW9uLlxuICAgKiBUaGlzIG1ldGhvZCBkZWZpbmVzIHJldXNhYmxlIGpvYiBjb25maWd1cmF0aW9ucyB0byBiZSBleHRlbmRlZCBieSBzcGVjaWZpYyBwaXBlbGluZSBqb2JzLFxuICAgKiBmYWNpbGl0YXRpbmcgYXJ0aWZhY3QgY2FjaGluZyBhbmQgQVdTIGF1dGhlbnRpY2F0aW9uIHNldHVwLlxuICAgKi9cbiAgcHJvdGVjdGVkIHNldHVwU25pcHBldHMoKSB7XG4gICAgdGhpcy5jb25maWcuYWRkSm9icyh7XG4gICAgICAnLmFydGlmYWN0c19jZGsnOiB7XG4gICAgICAgIGFydGlmYWN0czoge1xuICAgICAgICAgIHdoZW46IGdpdGxhYi5DYWNoZVdoZW4uT05fU1VDQ0VTUyxcbiAgICAgICAgICBleHBpcmVJbjogJzMwIGRheXMnLFxuICAgICAgICAgIG5hbWU6ICdDREsgQXNzZW1ibHkgLSAkQ0lfSk9CX05BTUUtJENJX0NPTU1JVF9SRUZfU0xVRycsXG4gICAgICAgICAgdW50cmFja2VkOiBmYWxzZSxcbiAgICAgICAgICBwYXRoczogWydjZGsub3V0J10sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgJy5hcnRpZmFjdHNfY2RrZGVwbG95Jzoge1xuICAgICAgICBhcnRpZmFjdHM6IHtcbiAgICAgICAgICB3aGVuOiBnaXRsYWIuQ2FjaGVXaGVuLk9OX1NVQ0NFU1MsXG4gICAgICAgICAgZXhwaXJlSW46ICczMCBkYXlzJyxcbiAgICAgICAgICBuYW1lOiAnQ0RLIE91dHB1dHMgLSAkQ0lfSk9CX05BTUUtJENJX0NPTU1JVF9SRUZfU0xVRycsXG4gICAgICAgICAgdW50cmFja2VkOiBmYWxzZSxcbiAgICAgICAgICBwYXRoczogWydjZGstb3V0cHV0cy0qLmpzb24nXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICAnLmF3c19iYXNlJzoge1xuICAgICAgICBpbWFnZTogeyBuYW1lOiB0aGlzLmpvYkltYWdlIH0sXG4gICAgICAgIGlkVG9rZW5zOiB7XG4gICAgICAgICAgQVdTX1RPS0VOOiB7XG4gICAgICAgICAgICBhdWQ6ICdodHRwczovL3N0cy5hbWF6b25hd3MuY29tJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICB2YXJpYWJsZXM6IHtcbiAgICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICAgIC8vIE5QTV9SRUdJU1RSWTogJ3h4eCdcbiAgICAgICAgfSxcbiAgICAgICAgYmVmb3JlU2NyaXB0OiBbXG4gICAgICAgICAgYGNoZWNrX3ZhcmlhYmxlc19kZWZpbmVkKCkge1xuICBmb3IgdmFyIGluIFwiJEBcIjsgZG9cbiAgICBpZiBbIC16IFwiJChldmFsIFwiZWNobyBcXFxcJCR2YXJcIilcIiBdOyB0aGVuXG4gICAgICBsb2dfZmF0YWwgXCJcXCR7dmFyfSBub3QgZGVmaW5lZFwiO1xuICAgIGZpXG4gIGRvbmVcbn1cblxuYXdzbG9naW4oKSB7XG4gIHJvbGVBcm49XFwkezE6IC1cXCR7QVdTX1JPTEVfQVJOfX1cbiAgc2Vzc2lvbk5hbWU9XFwkezI6LUdpdExhYlJ1bm5lci1cXCR7Q0lfUFJPSkVDVF9JRH0tXFwke0NJX1BJUEVMSU5FX0lEfX1cbiAgY2hlY2tfdmFyaWFibGVzX2RlZmluZWQgcm9sZUFybiBBV1NfVE9LRU5cbiAgZXhwb3J0ICQocHJpbnRmIFwiQVdTX0FDQ0VTU19LRVlfSUQ9JXMgQVdTX1NFQ1JFVF9BQ0NFU1NfS0VZPSVzIEFXU19TRVNTSU9OX1RPS0VOPSVzXCIgJChhd3Mgc3RzIGFzc3VtZS1yb2xlLXdpdGgtd2ViLWlkZW50aXR5IC0tcm9sZS1hcm4gXFwke3JvbGVBcm59IC0tcm9sZS1zZXNzaW9uLW5hbWUgXCJcXCR7c2Vzc2lvbk5hbWV9XCIgLS13ZWItaWRlbnRpdHktdG9rZW4gXFwke0FXU19UT0tFTn0gLS1kdXJhdGlvbi1zZWNvbmRzIDM2MDAgLS1xdWVyeSAnQ3JlZGVudGlhbHMuW0FjY2Vzc0tleUlkLFNlY3JldEFjY2Vzc0tleSxTZXNzaW9uVG9rZW5dJyAtLW91dHB1dCB0ZXh0KSlcbiAgIyBUT0RPIENPREUgQVJUSUZBQ1Rcbn1cbmAsXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgdGhlICdzeW50aCcgc3RhZ2Ugb2YgdGhlIHBpcGVsaW5lIHRvIHN5bnRoZXNpemUgQVdTIENESyBhcHBsaWNhdGlvbnMuXG4gICAqIFRoaXMgbWV0aG9kIGNvbmZpZ3VyZXMgdGhlIGpvYiB0byBleGVjdXRlIENESyBzeW50aGVzaXMsIGFwcGx5aW5nIHRoZSBhcHByb3ByaWF0ZSBJQU0gcm9sZVxuICAgKiBmb3IgQVdTIGNvbW1hbmRzIGFuZCBzcGVjaWZ5aW5nIHJ1bm5lciB0YWdzIGZvciBqb2IgZXhlY3V0aW9uLiBUaGUgc3ludGhlc2l6ZWQgb3V0cHV0cyBhcmVcbiAgICogY29uZmlndXJlZCB0byBiZSBjYWNoZWQgYXMgYXJ0aWZhY3RzLlxuICAgKi9cbiAgcHJvdGVjdGVkIGNyZWF0ZVN5bnRoKCk6IHZvaWQge1xuICAgIGNvbnN0IHN0ZXBzOiBQaXBlbGluZVN0ZXBbXSA9IFtdO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucz8uc3ludGgpIHtcbiAgICAgIHN0ZXBzLnB1c2gobmV3IEF3c0Fzc3VtZVJvbGVTdGVwKHRoaXMucHJvamVjdCwge1xuICAgICAgICByb2xlQXJuOiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnMuc3ludGgsXG4gICAgICB9KSk7XG4gICAgfVxuICAgIHN0ZXBzLnB1c2goLi4udGhpcy5vcHRpb25zLnByZUluc3RhbGxTdGVwcyA/PyBbXSk7XG4gICAgc3RlcHMucHVzaChuZXcgU2ltcGxlQ29tbWFuZFN0ZXAodGhpcy5wcm9qZWN0LCB0aGlzLnJlbmRlckluc3RhbGxDb21tYW5kcygpKSk7XG5cbiAgICBzdGVwcy5wdXNoKC4uLnRoaXMub3B0aW9ucy5wcmVTeW50aFN0ZXBzID8/IFtdKTtcbiAgICBzdGVwcy5wdXNoKG5ldyBTaW1wbGVDb21tYW5kU3RlcCh0aGlzLnByb2plY3QsIHRoaXMucmVuZGVyU3ludGhDb21tYW5kcygpKSk7XG4gICAgc3RlcHMucHVzaCguLi50aGlzLm9wdGlvbnMucG9zdFN5bnRoU3RlcHMgPz8gW10pO1xuXG4gICAgY29uc3QgZ2l0bGFiU3RlcHMgPSBzdGVwcy5tYXAocyA9PiBzLnRvR2l0bGFiKCkpO1xuXG4gICAgdGhpcy5jb25maWcuYWRkU3RhZ2VzKCdzeW50aCcpO1xuICAgIHRoaXMuY29uZmlnLmFkZEpvYnMoe1xuICAgICAgc3ludGg6IHtcbiAgICAgICAgZXh0ZW5kczogWycuYXdzX2Jhc2UnLCAnLmFydGlmYWN0c19jZGsnLCAuLi5naXRsYWJTdGVwcy5mbGF0TWFwKHMgPT4gcy5leHRlbnNpb25zKV0sXG4gICAgICAgIG5lZWRzOiBnaXRsYWJTdGVwcy5mbGF0TWFwKHMgPT4gcy5uZWVkcyksXG4gICAgICAgIHN0YWdlOiAnc3ludGgnLFxuICAgICAgICB0YWdzOiB0aGlzLm9wdGlvbnMucnVubmVyVGFncz8uc3ludGggPz8gdGhpcy5vcHRpb25zLnJ1bm5lclRhZ3M/LmRlZmF1bHQsXG4gICAgICAgIHNjcmlwdDogZ2l0bGFiU3RlcHMuZmxhdE1hcChzID0+IHMuY29tbWFuZHMpLFxuICAgICAgICB2YXJpYWJsZXM6IGdpdGxhYlN0ZXBzLnJlZHVjZSgoYWNjLCBzdGVwKSA9PiAoeyAuLi5hY2MsIC4uLnN0ZXAuZW52IH0pLCB7fSksXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdXAgdGhlIGFzc2V0IHB1Ymxpc2hpbmcgc3RhZ2Ugb2YgdGhlIHBpcGVsaW5lLlxuICAgKiBUaGlzIG1ldGhvZCBjb25maWd1cmVzIGEgam9iIHRvIHVwbG9hZCBzeW50aGVzaXplZCBhc3NldHMgdG8gQVdTLCBoYW5kbGluZyBJQU0gcm9sZVxuICAgKiBhdXRoZW50aWNhdGlvbiBhbmQgc3BlY2lmeWluZyBydW5uZXIgdGFncy4gSXQgZGVwZW5kcyBvbiB0aGUgc3VjY2Vzc2Z1bCBjb21wbGV0aW9uXG4gICAqIG9mIHRoZSAnc3ludGgnIHN0YWdlLCBlbnN1cmluZyBhc3NldHMgYXJlIG9ubHkgcHVibGlzaGVkIGFmdGVyIHN1Y2Nlc3NmdWwgc3ludGhlc2lzLlxuICAgKi9cbiAgcHJvdGVjdGVkIGNyZWF0ZUFzc2V0VXBsb2FkKCk6IHZvaWQge1xuICAgIGNvbnN0IHN0ZXBzID0gW107XG5cbiAgICBjb25zdCBnbG9iYWxQdWJsaXNoUm9sZSA9IHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucy5hc3NldFB1Ymxpc2hpbmcgPz8gdGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zLmRlZmF1bHQ7XG4gICAgaWYgKGdsb2JhbFB1Ymxpc2hSb2xlKSB7XG4gICAgICBzdGVwcy5wdXNoKG5ldyBBd3NBc3N1bWVSb2xlU3RlcCh0aGlzLnByb2plY3QsIHtcbiAgICAgICAgcm9sZUFybjogZ2xvYmFsUHVibGlzaFJvbGUsXG4gICAgICB9KSk7XG4gICAgfVxuICAgIHN0ZXBzLnB1c2goLi4udGhpcy5vcHRpb25zLnByZUluc3RhbGxTdGVwcyA/PyBbXSk7XG4gICAgc3RlcHMucHVzaChuZXcgU2ltcGxlQ29tbWFuZFN0ZXAodGhpcy5wcm9qZWN0LCB0aGlzLnJlbmRlckluc3RhbGxDb21tYW5kcygpKSk7XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zLmFzc2V0UHVibGlzaGluZ1BlclN0YWdlKSB7XG4gICAgICBjb25zdCBzdGFnZXMgPSBbLi4udGhpcy5vcHRpb25zLnN0YWdlcywgLi4udGhpcy5vcHRpb25zLmluZGVwZW5kZW50U3RhZ2VzID8/IFtdXTtcbiAgICAgIGZvciAoY29uc3Qgc3RhZ2Ugb2Ygc3RhZ2VzKSB7XG4gICAgICAgIHN0ZXBzLnB1c2gobmV3IEF3c0Fzc3VtZVJvbGVTdGVwKHRoaXMucHJvamVjdCwge1xuICAgICAgICAgIHJvbGVBcm46IHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucy5hc3NldFB1Ymxpc2hpbmdQZXJTdGFnZVtzdGFnZS5uYW1lXSA/PyBnbG9iYWxQdWJsaXNoUm9sZSxcbiAgICAgICAgfSkpO1xuICAgICAgICBzdGVwcy5wdXNoKG5ldyBTaW1wbGVDb21tYW5kU3RlcCh0aGlzLnByb2plY3QsIHRoaXMucmVuZGVyQXNzZXRVcGxvYWRDb21tYW5kcyhzdGFnZS5uYW1lKSkpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzdGVwcy5wdXNoKG5ldyBTaW1wbGVDb21tYW5kU3RlcCh0aGlzLnByb2plY3QsIHRoaXMucmVuZGVyQXNzZXRVcGxvYWRDb21tYW5kcygpKSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMubmVlZHNWZXJzaW9uZWRBcnRpZmFjdHMpIHtcbiAgICAgIHN0ZXBzLnB1c2gobmV3IFNpbXBsZUNvbW1hbmRTdGVwKHRoaXMucHJvamVjdCwgdGhpcy5yZW5kZXJBc3NlbWJseVVwbG9hZENvbW1hbmRzKCkpKTtcbiAgICB9XG5cbiAgICBjb25zdCBnaXRsYWJTdGVwcyA9IHN0ZXBzLm1hcChzID0+IHMudG9HaXRsYWIoKSk7XG5cbiAgICB0aGlzLmNvbmZpZy5hZGRTdGFnZXMoJ3B1Ymxpc2hfYXNzZXRzJyk7XG4gICAgdGhpcy5jb25maWcuYWRkSm9icyh7XG4gICAgICBwdWJsaXNoX2Fzc2V0czoge1xuICAgICAgICBleHRlbmRzOiBbJy5hd3NfYmFzZScsIC4uLmdpdGxhYlN0ZXBzLmZsYXRNYXAocyA9PiBzLmV4dGVuc2lvbnMpXSxcbiAgICAgICAgc3RhZ2U6ICdwdWJsaXNoX2Fzc2V0cycsXG4gICAgICAgIHRhZ3M6IHRoaXMub3B0aW9ucy5ydW5uZXJUYWdzPy5hc3NldFB1Ymxpc2hpbmcgPz8gdGhpcy5vcHRpb25zLnJ1bm5lclRhZ3M/LmRlZmF1bHQsXG4gICAgICAgIG5lZWRzOiBbeyBqb2I6ICdzeW50aCcsIGFydGlmYWN0czogdHJ1ZSB9LCAuLi5naXRsYWJTdGVwcy5mbGF0TWFwKHMgPT4gcy5uZWVkcyldLFxuICAgICAgICBzY3JpcHQ6IGdpdGxhYlN0ZXBzLmZsYXRNYXAocyA9PiBzLmNvbW1hbmRzKSxcbiAgICAgICAgdmFyaWFibGVzOiBnaXRsYWJTdGVwcy5yZWR1Y2UoKGFjYywgc3RlcCkgPT4gKHsgLi4uYWNjLCAuLi5zdGVwLmVudiB9KSwge30pLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEeW5hbWljYWxseSBjcmVhdGVzIGRlcGxveW1lbnQgc3RhZ2VzIGJhc2VkIG9uIHRoZSBkZXBsb3ltZW50IGNvbmZpZ3VyYXRpb24uXG4gICAqIEZvciBlYWNoIHByb3ZpZGVkIGRlcGxveW1lbnQgc3RhZ2UsIHRoaXMgbWV0aG9kIHNldHMgdXAgam9icyBmb3IgJ2RpZmYnIGFuZCAnZGVwbG95JyBhY3Rpb25zLFxuICAgKiBhcHBseWluZyB0aGUgY29ycmVjdCBJQU0gcm9sZXMgYW5kIHJ1bm5lciB0YWdzLiBJdCBzdXBwb3J0cyBjb25kaXRpb25hbCBtYW51YWwgYXBwcm92YWwgZm9yXG4gICAqIGRlcGxveW1lbnQgc3RhZ2VzLCBwcm92aWRpbmcgZmxleGliaWxpdHkgaW4gdGhlIGRlcGxveW1lbnQgd29ya2Zsb3cuXG4gICAqXG4gICAqIEBwYXJhbSB7RGVwbG95bWVudFN0YWdlfSBzdGFnZSAtIFRoZSBkZXBsb3ltZW50IHN0YWdlIGNvbmZpZ3VyYXRpb24gdG8gc2V0IHVwLlxuICAgKi9cbiAgcHJvdGVjdGVkIGNyZWF0ZURlcGxveW1lbnQoc3RhZ2U6IERlcGxveW1lbnRTdGFnZSk6IHZvaWQge1xuICAgIGNvbnN0IGRpZmZTdGVwcyA9IFtcbiAgICAgIG5ldyBBd3NBc3N1bWVSb2xlU3RlcCh0aGlzLnByb2plY3QsIHtcbiAgICAgICAgcm9sZUFybjogdGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zPy5kaWZmPy5bc3RhZ2UubmFtZV1cbiAgICAgICAgICA/PyB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LmRlcGxveW1lbnQ/LltzdGFnZS5uYW1lXVxuICAgICAgICAgID8/IHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucz8uZGVmYXVsdCEsXG4gICAgICB9KSxcbiAgICAgIC4uLnRoaXMub3B0aW9ucy5wcmVJbnN0YWxsU3RlcHMgPz8gW10sXG4gICAgICBuZXcgU2ltcGxlQ29tbWFuZFN0ZXAodGhpcy5wcm9qZWN0LCB0aGlzLnJlbmRlckluc3RhbGxDb21tYW5kcygpKSxcbiAgICAgIG5ldyBTaW1wbGVDb21tYW5kU3RlcCh0aGlzLnByb2plY3QsIHRoaXMucmVuZGVyRGlmZkNvbW1hbmRzKHN0YWdlLm5hbWUpKSxcbiAgICBdLm1hcChzID0+IHMudG9HaXRsYWIoKSk7XG5cblxuICAgIGNvbnN0IGRlcGxveVN0ZXBzID0gW1xuICAgICAgbmV3IEF3c0Fzc3VtZVJvbGVTdGVwKHRoaXMucHJvamVjdCwge1xuICAgICAgICByb2xlQXJuOiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LmRlcGxveW1lbnQ/LltzdGFnZS5uYW1lXSA/PyB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LmRlZmF1bHQhLFxuICAgICAgfSksXG4gICAgICAuLi50aGlzLm9wdGlvbnMucHJlSW5zdGFsbFN0ZXBzID8/IFtdLFxuICAgICAgbmV3IFNpbXBsZUNvbW1hbmRTdGVwKHRoaXMucHJvamVjdCwgdGhpcy5yZW5kZXJJbnN0YWxsQ29tbWFuZHMoKSksXG4gICAgICBuZXcgU2ltcGxlQ29tbWFuZFN0ZXAodGhpcy5wcm9qZWN0LCB0aGlzLnJlbmRlckRlcGxveUNvbW1hbmRzKHN0YWdlLm5hbWUpKSxcbiAgICBdLm1hcChzID0+IHMudG9HaXRsYWIoKSk7XG5cbiAgICB0aGlzLmNvbmZpZy5hZGRTdGFnZXMoc3RhZ2UubmFtZSk7XG4gICAgdGhpcy5jb25maWcuYWRkSm9icyh7XG4gICAgICBbYGRpZmYtJHtzdGFnZS5uYW1lfWBdOiB7XG4gICAgICAgIGV4dGVuZHM6IFsnLmF3c19iYXNlJywgLi4uZGlmZlN0ZXBzLmZsYXRNYXAocyA9PiBzLmV4dGVuc2lvbnMpXSxcbiAgICAgICAgc3RhZ2U6IHN0YWdlLm5hbWUsXG4gICAgICAgIHRhZ3M6IHRoaXMub3B0aW9ucy5ydW5uZXJUYWdzPy5kaWZmPy5bc3RhZ2UubmFtZV0gPz8gdGhpcy5vcHRpb25zLnJ1bm5lclRhZ3M/LmRlcGxveW1lbnQ/LltzdGFnZS5uYW1lXSA/PyB0aGlzLm9wdGlvbnMucnVubmVyVGFncz8uZGVmYXVsdCxcbiAgICAgICAgb25seToge1xuICAgICAgICAgIHJlZnM6IFt0aGlzLmJyYW5jaE5hbWVdLFxuICAgICAgICB9LFxuICAgICAgICBuZWVkczogW1xuICAgICAgICAgIHsgam9iOiAnc3ludGgnLCBhcnRpZmFjdHM6IHRydWUgfSxcbiAgICAgICAgICB7IGpvYjogJ3B1Ymxpc2hfYXNzZXRzJyB9LFxuICAgICAgICAgIC4uLmRpZmZTdGVwcy5mbGF0TWFwKHMgPT4gcy5uZWVkcyksXG4gICAgICAgIF0sXG4gICAgICAgIHNjcmlwdDogZGlmZlN0ZXBzLmZsYXRNYXAocyA9PiBzLmNvbW1hbmRzKSxcbiAgICAgICAgdmFyaWFibGVzOiBkaWZmU3RlcHMucmVkdWNlKChhY2MsIHN0ZXApID0+ICh7IC4uLmFjYywgLi4uc3RlcC5lbnYgfSksIHt9KSxcbiAgICAgIH0sXG4gICAgICBbYGRlcGxveS0ke3N0YWdlLm5hbWV9YF06IHtcbiAgICAgICAgZXh0ZW5kczogWycuYXdzX2Jhc2UnLCAnLmFydGlmYWN0c19jZGtkZXBsb3knLCAuLi5kZXBsb3lTdGVwcy5mbGF0TWFwKHMgPT4gcy5leHRlbnNpb25zKV0sXG4gICAgICAgIHN0YWdlOiBzdGFnZS5uYW1lLFxuICAgICAgICB0YWdzOiB0aGlzLm9wdGlvbnMucnVubmVyVGFncz8uZGVwbG95bWVudD8uW3N0YWdlLm5hbWVdID8/IHRoaXMub3B0aW9ucy5ydW5uZXJUYWdzPy5kZWZhdWx0LFxuICAgICAgICAuLi5zdGFnZS5tYW51YWxBcHByb3ZhbCAmJiB7XG4gICAgICAgICAgd2hlbjogZ2l0bGFiLkpvYldoZW4uTUFOVUFMLFxuICAgICAgICB9LFxuICAgICAgICBvbmx5OiB7XG4gICAgICAgICAgcmVmczogW3RoaXMuYnJhbmNoTmFtZV0sXG4gICAgICAgIH0sXG4gICAgICAgIG5lZWRzOiBbXG4gICAgICAgICAgeyBqb2I6ICdzeW50aCcsIGFydGlmYWN0czogdHJ1ZSB9LFxuICAgICAgICAgIHsgam9iOiAncHVibGlzaF9hc3NldHMnIH0sXG4gICAgICAgICAgeyBqb2I6IGBkaWZmLSR7c3RhZ2UubmFtZX1gIH0sXG4gICAgICAgICAgLi4uZGVwbG95U3RlcHMuZmxhdE1hcChzID0+IHMubmVlZHMpLFxuICAgICAgICBdLFxuICAgICAgICBzY3JpcHQ6IGRlcGxveVN0ZXBzLmZsYXRNYXAocyA9PiBzLmNvbW1hbmRzKSxcbiAgICAgICAgdmFyaWFibGVzOiBkZXBsb3lTdGVwcy5yZWR1Y2UoKGFjYywgc3RlcCkgPT4gKHsgLi4uYWNjLCAuLi5zdGVwLmVudiB9KSwge30pLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICB0aGlzLmRlcGxveW1lbnRTdGFnZXMucHVzaChzdGFnZS5uYW1lKTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBqb2IgdG8gZGVwbG95IHRoZSBDREsgYXBwbGljYXRpb24gdG8gQVdTLlxuICAgKiBAcGFyYW0gc3RhZ2UgLSBUaGUgaW5kZXBlbmRlbnQgc3RhZ2UgdG8gY3JlYXRlLlxuICAgKi9cbiAgcHVibGljIGNyZWF0ZUluZGVwZW5kZW50RGVwbG95bWVudChzdGFnZTogSW5kZXBlbmRlbnRTdGFnZSk6IHZvaWQge1xuICAgIGNvbnN0IHN0ZXBzID0gW1xuICAgICAgbmV3IEF3c0Fzc3VtZVJvbGVTdGVwKHRoaXMucHJvamVjdCwge1xuICAgICAgICByb2xlQXJuOiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LmRlcGxveW1lbnQ/LltzdGFnZS5uYW1lXSA/PyB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LmRlZmF1bHQhLFxuICAgICAgICByZWdpb246IHN0YWdlLmVudi5yZWdpb24sXG4gICAgICB9KSxcbiAgICAgIC4uLnRoaXMub3B0aW9ucy5wcmVJbnN0YWxsU3RlcHMgPz8gW10sXG4gICAgICBuZXcgU2ltcGxlQ29tbWFuZFN0ZXAodGhpcy5wcm9qZWN0LCB0aGlzLnJlbmRlckluc3RhbGxDb21tYW5kcygpKSxcblxuICAgICAgLi4udGhpcy5vcHRpb25zLnByZVN5bnRoU3RlcHMgPz8gW10sXG4gICAgICBuZXcgU2ltcGxlQ29tbWFuZFN0ZXAodGhpcy5wcm9qZWN0LCB0aGlzLnJlbmRlclN5bnRoQ29tbWFuZHMoKSksXG4gICAgICAuLi50aGlzLm9wdGlvbnMucG9zdFN5bnRoU3RlcHMgPz8gW10sXG5cbiAgICAgIG5ldyBTaW1wbGVDb21tYW5kU3RlcCh0aGlzLnByb2plY3QsIHRoaXMucmVuZGVyRGlmZkNvbW1hbmRzKHN0YWdlLm5hbWUpKSxcbiAgICAgIC4uLnN0YWdlLnBvc3REaWZmU3RlcHMgPz8gW10sXG5cbiAgICAgIG5ldyBTaW1wbGVDb21tYW5kU3RlcCh0aGlzLnByb2plY3QsIHRoaXMucmVuZGVyRGVwbG95Q29tbWFuZHMoc3RhZ2UubmFtZSkpLFxuICAgICAgLi4uc3RhZ2UucG9zdERlcGxveVN0ZXBzID8/IFtdLFxuICAgIF0ubWFwKHMgPT4gcy50b0dpdGxhYigpKTtcblxuICAgIHRoaXMuY29uZmlnLmFkZFN0YWdlcyhzdGFnZS5uYW1lKTtcbiAgICB0aGlzLmNvbmZpZy5hZGRKb2JzKHtcbiAgICAgIFtgZGVwbG95LSR7c3RhZ2UubmFtZX1gXToge1xuICAgICAgICBleHRlbmRzOiBbJy5hd3NfYmFzZScsICcuYXJ0aWZhY3RzX2Nka2RlcGxveScsIC4uLnN0ZXBzLmZsYXRNYXAocyA9PiBzLmV4dGVuc2lvbnMpXSxcbiAgICAgICAgc3RhZ2U6IHN0YWdlLm5hbWUsXG4gICAgICAgIHRhZ3M6IHRoaXMub3B0aW9ucy5ydW5uZXJUYWdzPy5kZXBsb3ltZW50Py5bc3RhZ2UubmFtZV0gPz8gdGhpcy5vcHRpb25zLnJ1bm5lclRhZ3M/LmRlZmF1bHQsXG4gICAgICAgIC4uLnN0YWdlLmRlcGxveU9uUHVzaCAmJiB7XG4gICAgICAgICAgb25seToge1xuICAgICAgICAgICAgcmVmczogW3RoaXMuYnJhbmNoTmFtZV0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgLi4uIXN0YWdlLmRlcGxveU9uUHVzaCAmJiB7XG4gICAgICAgICAgd2hlbjogZ2l0bGFiLkpvYldoZW4uTUFOVUFMLFxuICAgICAgICB9LFxuICAgICAgICBuZWVkczogc3RlcHMuZmxhdE1hcChzID0+IHMubmVlZHMpLFxuICAgICAgICBzY3JpcHQ6IHN0ZXBzLmZsYXRNYXAocyA9PiBzLmNvbW1hbmRzKSxcbiAgICAgICAgdmFyaWFibGVzOiBzdGVwcy5yZWR1Y2UoKGFjYywgc3RlcCkgPT4gKHsgLi4uYWNjLCAuLi5zdGVwLmVudiB9KSwge30pLFxuICAgICAgfSxcbiAgICB9KTtcblxuICB9XG5cbiAgcHVibGljIGVuZ2luZVR5cGUoKTogUGlwZWxpbmVFbmdpbmUge1xuICAgIHJldHVybiBQaXBlbGluZUVuZ2luZS5HSVRMQUI7XG4gIH1cblxufVxuXG4iXX0=