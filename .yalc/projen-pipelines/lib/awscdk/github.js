"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubCDKPipeline = void 0;
const JSII_RTTI_SYMBOL_1 = Symbol.for("jsii.rtti");
const workflows_model_1 = require("projen/lib/github/workflows-model");
const base_1 = require("./base");
const engine_1 = require("../engine");
const engines_1 = require("../engines");
const steps_1 = require("../steps");
const artifact_steps_1 = require("../steps/artifact-steps");
const aws_assume_role_step_1 = require("../steps/aws-assume-role.step");
const registries_1 = require("../steps/registries");
const DEFAULT_RUNNER_TAGS = ['ubuntu-latest'];
/**
 * Implements a CDK Pipeline configured specifically for GitHub workflows.
 */
class GithubCDKPipeline extends base_1.CDKPipeline {
    /**
     * Constructs a new GithubCDKPipeline instance.
     * @param app - The CDK app associated with this pipeline.
     * @param options - Configuration options for the pipeline.
     */
    constructor(app, options) {
        super(app, {
            ...options,
            ...options.useGithubPackagesForAssembly && {
                preInstallSteps: [
                    new registries_1.GithubPackagesLoginStep(app, { write: false }),
                    ...options.preInstallSteps ?? [],
                ],
            },
        });
        this.options = options;
        /** List of deployment stages for the pipeline. */
        this.deploymentStages = [];
        // Initialize the deployment workflow on GitHub.
        this.deploymentWorkflow = this.app.github.addWorkflow('deploy');
        this.deploymentWorkflow.on({
            push: {
                branches: [this.branchName],
            },
            workflowDispatch: {},
        });
        // Determine if versioned artifacts are necessary.
        this.needsVersionedArtifacts = options.stages.find(s => s.manualApproval === true) !== undefined;
        ;
        this.useGithubPackages = this.needsVersionedArtifacts && (options.useGithubPackagesForAssembly ?? false);
        if (this.useGithubPackages) {
            app.npmrc.addRegistry('https://npm.pkg.github.com', this.baseOptions.pkgNamespace);
            app.npmrc.addConfig('//npm.pkg.github.com/:_authToken', '${GITHUB_TOKEN}');
            app.npmrc.addConfig('//npm.pkg.github.com/:always-auth', 'true');
        }
        // Create jobs for synthesizing, asset uploading, and deployment.
        this.createSynth();
        this.createAssetUpload();
        for (const stage of options.stages) {
            this.createDeployment(stage);
        }
        for (const stage of (options.independentStages ?? [])) {
            this.createIndependentDeployment(stage);
        }
    }
    /** the type of engine this implementation of CDKPipeline is for */
    engineType() {
        return engine_1.PipelineEngine.GITHUB;
    }
    /**
     * Creates a synthesis job for the pipeline using GitHub Actions.
     */
    createSynth() {
        const steps = [];
        if (this.options.iamRoleArns?.synth) {
            steps.push(new aws_assume_role_step_1.AwsAssumeRoleStep(this.project, {
                roleArn: this.options.iamRoleArns.synth,
                sessionName: 'GitHubAction',
            }));
        }
        steps.push(...this.baseOptions.preInstallSteps ?? []);
        steps.push(new steps_1.SimpleCommandStep(this.project, this.renderInstallCommands()));
        steps.push(...this.baseOptions.preSynthSteps ?? []);
        steps.push(new steps_1.SimpleCommandStep(this.project, this.renderSynthCommands()));
        steps.push(...this.baseOptions.postSynthSteps ?? []);
        steps.push(new artifact_steps_1.UploadArtifactStep(this.project, {
            name: 'cloud-assembly',
            path: `${this.app.cdkConfig.cdkout}/`,
        }));
        const githubSteps = steps.map(s => s.toGithub());
        this.deploymentWorkflow.addJob('synth', {
            name: 'Synth CDK application',
            runsOn: this.options.runnerTags ?? DEFAULT_RUNNER_TAGS,
            env: {
                CI: 'true',
                ...githubSteps.reduce((acc, step) => ({ ...acc, ...step.env }), {}),
            },
            needs: [...githubSteps.flatMap(s => s.needs)],
            permissions: (0, engines_1.mergeJobPermissions)({
                idToken: workflows_model_1.JobPermission.WRITE,
                contents: workflows_model_1.JobPermission.READ,
            }, ...githubSteps.flatMap(s => s.permissions).filter(p => p != undefined)),
            steps: [
                {
                    name: 'Checkout',
                    uses: 'actions/checkout@v4',
                },
                ...githubSteps.flatMap(s => s.steps),
            ],
        });
    }
    /**
     * Creates a job to upload assets to AWS as part of the pipeline.
     */
    createAssetUpload() {
        const globalPublishRole = this.options.iamRoleArns.assetPublishing ?? this.options.iamRoleArns.default;
        const steps = [
            new steps_1.SimpleCommandStep(this.project, ['git config --global user.name "github-actions" && git config --global user.email "github-actions@github.com"']),
            new aws_assume_role_step_1.AwsAssumeRoleStep(this.project, {
                roleArn: globalPublishRole,
                region: 'us-east-1',
            }),
            new artifact_steps_1.DownloadArtifactStep(this.project, {
                name: 'cloud-assembly',
                path: `${this.app.cdkConfig.cdkout}/`,
            }),
            ...this.baseOptions.preInstallSteps ?? [],
            new steps_1.SimpleCommandStep(this.project, this.renderInstallCommands()),
        ];
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
        const ghSteps = steps.map(s => s.toGithub());
        this.deploymentWorkflow.addJob('assetUpload', {
            name: 'Publish assets to AWS',
            needs: ['synth', ...ghSteps.flatMap(s => s.needs)],
            runsOn: this.options.runnerTags ?? DEFAULT_RUNNER_TAGS,
            env: {
                CI: 'true',
                ...ghSteps.reduce((acc, step) => ({ ...acc, ...step.env }), {}),
            },
            permissions: (0, engines_1.mergeJobPermissions)({
                idToken: workflows_model_1.JobPermission.WRITE,
                contents: this.needsVersionedArtifacts ? workflows_model_1.JobPermission.WRITE : workflows_model_1.JobPermission.READ,
                ...this.useGithubPackages && {
                    packages: workflows_model_1.JobPermission.WRITE,
                },
            }, ...ghSteps.flatMap(s => s.permissions).filter(p => p != undefined)),
            steps: [
                {
                    name: 'Checkout',
                    uses: 'actions/checkout@v4',
                    with: {
                        'fetch-depth': 0,
                    },
                },
                ...ghSteps.flatMap(s => s.steps),
            ],
        });
    }
    /**
     * Creates a job to deploy the CDK application to AWS.
     * @param stage - The deployment stage to create.
     */
    createDeployment(stage) {
        if (stage.manualApproval === true) {
            const steps = [
                new aws_assume_role_step_1.AwsAssumeRoleStep(this.project, {
                    roleArn: this.options.iamRoleArns?.deployment?.[stage.name] ?? this.options.iamRoleArns?.default,
                    region: stage.env.region,
                }),
                ...this.baseOptions.preInstallSteps ?? [],
                new steps_1.SimpleCommandStep(this.project, this.renderInstallCommands()),
                new steps_1.SimpleCommandStep(this.project, this.renderInstallPackageCommands(`${this.baseOptions.pkgNamespace}/${this.app.name}@\${{github.event.inputs.version}}`)),
                new steps_1.SimpleCommandStep(this.project, [`mv ./node_modules/${this.baseOptions.pkgNamespace}/${this.app.name} ${this.app.cdkConfig.cdkout}`]),
                new steps_1.SimpleCommandStep(this.project, this.renderDeployCommands(stage.name)),
                new artifact_steps_1.UploadArtifactStep(this.project, {
                    name: `cdk-outputs-${stage.name}`,
                    path: `cdk-outputs-${stage.name}.json`,
                }),
            ].map(s => s.toGithub());
            // Create new workflow for deployment
            const stageWorkflow = this.app.github.addWorkflow(`release-${stage.name}`);
            stageWorkflow.on({
                workflowDispatch: {
                    inputs: {
                        version: {
                            description: 'Package version',
                            required: true,
                        },
                    },
                },
            });
            stageWorkflow.addJob('deploy', {
                name: `Release stage ${stage.name} to AWS`,
                needs: steps.flatMap(s => s.needs),
                runsOn: this.options.runnerTags ?? DEFAULT_RUNNER_TAGS,
                ...this.options.useGithubEnvironments && {
                    environment: stage.name,
                },
                env: {
                    CI: 'true',
                    ...steps.reduce((acc, step) => ({ ...acc, ...step.env }), {}),
                },
                permissions: (0, engines_1.mergeJobPermissions)({
                    idToken: workflows_model_1.JobPermission.WRITE,
                    contents: workflows_model_1.JobPermission.READ,
                }, ...steps.flatMap(s => s.permissions).filter(p => p != undefined)),
                steps: [
                    {
                        name: 'Checkout',
                        uses: 'actions/checkout@v4',
                    },
                    ...steps.flatMap(s => s.steps),
                ],
            });
        }
        else {
            const steps = [
                new aws_assume_role_step_1.AwsAssumeRoleStep(this.project, {
                    roleArn: this.options.iamRoleArns?.deployment?.[stage.name] ?? this.options.iamRoleArns?.default,
                    region: stage.env.region,
                }),
                new artifact_steps_1.DownloadArtifactStep(this.project, {
                    name: 'cloud-assembly',
                    path: `${this.app.cdkConfig.cdkout}/`,
                }),
                ...this.baseOptions.preInstallSteps ?? [],
                new steps_1.SimpleCommandStep(this.project, this.renderInstallCommands()),
                new steps_1.SimpleCommandStep(this.project, this.renderDeployCommands(stage.name)),
                new artifact_steps_1.UploadArtifactStep(this.project, {
                    name: `cdk-outputs-${stage.name}`,
                    path: `cdk-outputs-${stage.name}.json`,
                }),
            ].map(s => s.toGithub());
            // Add deployment to CI/CD workflow
            this.deploymentWorkflow.addJob(`deploy-${stage.name}`, {
                name: `Deploy stage ${stage.name} to AWS`,
                ...this.options.useGithubEnvironments && {
                    environment: stage.name,
                },
                needs: ['assetUpload', ...steps.flatMap(s => s.needs), ...(this.deploymentStages.length > 0 ? [`deploy-${this.deploymentStages.at(-1)}`] : [])],
                runsOn: this.options.runnerTags ?? DEFAULT_RUNNER_TAGS,
                env: {
                    CI: 'true',
                    ...steps.reduce((acc, step) => ({ ...acc, ...step.env }), {}),
                },
                permissions: (0, engines_1.mergeJobPermissions)({
                    idToken: workflows_model_1.JobPermission.WRITE,
                    contents: workflows_model_1.JobPermission.READ,
                }, ...steps.flatMap(s => s.permissions).filter(p => p != undefined)),
                steps: [
                    {
                        name: 'Checkout',
                        uses: 'actions/checkout@v4',
                    },
                    ...steps.flatMap(s => s.steps),
                ],
            });
            this.deploymentStages.push(stage.name);
        }
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
            ...this.baseOptions.preInstallSteps ?? [],
            new steps_1.SimpleCommandStep(this.project, this.renderInstallCommands()),
            ...this.baseOptions.preSynthSteps ?? [],
            new steps_1.SimpleCommandStep(this.project, this.renderSynthCommands()),
            ...this.baseOptions.postSynthSteps ?? [],
            new steps_1.SimpleCommandStep(this.project, this.renderDiffCommands(stage.name)),
            ...stage.postDiffSteps ?? [],
            new steps_1.SimpleCommandStep(this.project, this.renderDeployCommands(stage.name)),
            ...stage.postDeploySteps ?? [],
            new artifact_steps_1.UploadArtifactStep(this.project, {
                name: `cdk-outputs-${stage.name}`,
                path: `cdk-outputs-${stage.name}.json`,
            }),
        ].map(s => s.toGithub());
        // Create new workflow for deployment
        const stageWorkflow = this.app.github.addWorkflow(`deploy-${stage.name}`);
        stageWorkflow.on({
            workflowDispatch: {},
            ...stage.deployOnPush && {
                push: {
                    branches: [this.branchName],
                },
            },
        });
        stageWorkflow.addJob('deploy', {
            name: `Release stage ${stage.name} to AWS`,
            needs: steps.flatMap(s => s.needs),
            runsOn: this.options.runnerTags ?? DEFAULT_RUNNER_TAGS,
            ...this.options.useGithubEnvironments && {
                environment: stage.name,
            },
            env: {
                CI: 'true',
                ...steps.reduce((acc, step) => ({ ...acc, ...step.env }), {}),
            },
            permissions: (0, engines_1.mergeJobPermissions)({
                idToken: workflows_model_1.JobPermission.WRITE,
                contents: workflows_model_1.JobPermission.READ,
            }, ...steps.flatMap(s => s.permissions).filter(p => p != undefined)),
            steps: [
                {
                    name: 'Checkout',
                    uses: 'actions/checkout@v4',
                },
                ...steps.flatMap(s => s.steps),
            ],
        });
    }
}
exports.GithubCDKPipeline = GithubCDKPipeline;
_a = JSII_RTTI_SYMBOL_1;
GithubCDKPipeline[_a] = { fqn: "projen-pipelines.GithubCDKPipeline", version: "0.0.0" };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0aHViLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2F3c2Nkay9naXRodWIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFFQSx1RUFBa0Y7QUFDbEYsaUNBQTRGO0FBQzVGLHNDQUEyQztBQUMzQyx3Q0FBaUQ7QUFDakQsb0NBQTJEO0FBQzNELDREQUFtRjtBQUNuRix3RUFBa0U7QUFDbEUsb0RBQThEO0FBRTlELE1BQU0sbUJBQW1CLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztBQWdEOUM7O0dBRUc7QUFDSCxNQUFhLGlCQUFrQixTQUFRLGtCQUFXO0lBWWhEOzs7O09BSUc7SUFDSCxZQUFZLEdBQStCLEVBQVUsT0FBaUM7UUFDcEYsS0FBSyxDQUFDLEdBQUcsRUFBRTtZQUNULEdBQUcsT0FBTztZQUNWLEdBQUcsT0FBTyxDQUFDLDRCQUE0QixJQUFJO2dCQUN6QyxlQUFlLEVBQUU7b0JBQ2YsSUFBSSxvQ0FBdUIsQ0FBQyxHQUFHLEVBQUUsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLENBQUM7b0JBQ2xELEdBQUcsT0FBTyxDQUFDLGVBQWUsSUFBSSxFQUFFO2lCQUNqQzthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBVGdELFlBQU8sR0FBUCxPQUFPLENBQTBCO1FBVnRGLGtEQUFrRDtRQUMxQyxxQkFBZ0IsR0FBYSxFQUFFLENBQUM7UUFvQnRDLGdEQUFnRDtRQUNoRCxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFPLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ2pFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLENBQUM7WUFDekIsSUFBSSxFQUFFO2dCQUNKLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7YUFDNUI7WUFDRCxnQkFBZ0IsRUFBRSxFQUFFO1NBQ3JCLENBQUMsQ0FBQztRQUVILGtEQUFrRDtRQUNsRCxJQUFJLENBQUMsdUJBQXVC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STtnQkFDdkMsV0FBVyxFQUFFLEtBQUssQ0FBQyxJQUFJO2FBQ3hCO1lBQ0QsR0FBRyxFQUFFO2dCQUNILEVBQUUsRUFBRSxNQUFNO2dCQUNWLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQzthQUM5RDtZQUNELFdBQVcsRUFBRSxJQUFBLDZCQUFtQixFQUFDO2dCQUMvQixPQUFPLEVBQUUsK0JBQWEsQ0FBQyxLQUFLO2dCQUM1QixRQUFRLEVBQUUsK0JBQWEsQ0FBQyxJQUFJO2FBQzdCLEVBQUUsR0FBSSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxTQUFTLENBQXNCLENBQUM7WUFDMUYsS0FBSyxFQUFFO2dCQUNMO29CQUNFLElBQUksRUFBRSxVQUFVO29CQUNoQixJQUFJLEVBQUUscUJBQXFCO2lCQUM1QjtnQkFDRCxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO2FBQy9CO1NBQ0YsQ0FBQyxDQUFDO0lBRUwsQ0FBQzs7QUE3VkgsOENBOFZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgYXdzY2RrIH0gZnJvbSAncHJvamVuJztcbmltcG9ydCB7IEdpdGh1YldvcmtmbG93IH0gZnJvbSAncHJvamVuL2xpYi9naXRodWInO1xuaW1wb3J0IHsgSm9iUGVybWlzc2lvbiwgSm9iUGVybWlzc2lvbnMgfSBmcm9tICdwcm9qZW4vbGliL2dpdGh1Yi93b3JrZmxvd3MtbW9kZWwnO1xuaW1wb3J0IHsgQ0RLUGlwZWxpbmUsIENES1BpcGVsaW5lT3B0aW9ucywgRGVwbG95bWVudFN0YWdlLCBJbmRlcGVuZGVudFN0YWdlIH0gZnJvbSAnLi9iYXNlJztcbmltcG9ydCB7IFBpcGVsaW5lRW5naW5lIH0gZnJvbSAnLi4vZW5naW5lJztcbmltcG9ydCB7IG1lcmdlSm9iUGVybWlzc2lvbnMgfSBmcm9tICcuLi9lbmdpbmVzJztcbmltcG9ydCB7IFBpcGVsaW5lU3RlcCwgU2ltcGxlQ29tbWFuZFN0ZXAgfSBmcm9tICcuLi9zdGVwcyc7XG5pbXBvcnQgeyBEb3dubG9hZEFydGlmYWN0U3RlcCwgVXBsb2FkQXJ0aWZhY3RTdGVwIH0gZnJvbSAnLi4vc3RlcHMvYXJ0aWZhY3Qtc3RlcHMnO1xuaW1wb3J0IHsgQXdzQXNzdW1lUm9sZVN0ZXAgfSBmcm9tICcuLi9zdGVwcy9hd3MtYXNzdW1lLXJvbGUuc3RlcCc7XG5pbXBvcnQgeyBHaXRodWJQYWNrYWdlc0xvZ2luU3RlcCB9IGZyb20gJy4uL3N0ZXBzL3JlZ2lzdHJpZXMnO1xuXG5jb25zdCBERUZBVUxUX1JVTk5FUl9UQUdTID0gWyd1YnVudHUtbGF0ZXN0J107XG5cbi8qKlxuICogQ29uZmlndXJhdGlvbiBpbnRlcmZhY2UgZm9yIEdpdEh1Yi1zcGVjaWZpYyBJQU0gcm9sZXMgdXNlZCBpbiB0aGUgQ0RLIHBpcGVsaW5lLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEdpdGh1YklhbVJvbGVDb25maWcge1xuXG4gIC8qKiBEZWZhdWx0IElBTSByb2xlIEFSTiB1c2VkIGlmIG5vIHNwZWNpZmljIHJvbGUgaXMgcHJvdmlkZWQuICovXG4gIHJlYWRvbmx5IGRlZmF1bHQ/OiBzdHJpbmc7XG4gIC8qKiBJQU0gcm9sZSBBUk4gZm9yIHRoZSBzeW50aGVzaXMgc3RlcC4gKi9cbiAgcmVhZG9ubHkgc3ludGg/OiBzdHJpbmc7XG4gIC8qKiBJQU0gcm9sZSBBUk4gZm9yIHRoZSBhc3NldCBwdWJsaXNoaW5nIHN0ZXAuICovXG4gIHJlYWRvbmx5IGFzc2V0UHVibGlzaGluZz86IHN0cmluZztcbiAgLyoqIElBTSByb2xlIEFSTiBmb3IgdGhlIGFzc2V0IHB1Ymxpc2hpbmcgc3RlcCBmb3IgYSBzcGVjaWZpYyBzdGFnZS4gKi9cbiAgcmVhZG9ubHkgYXNzZXRQdWJsaXNoaW5nUGVyU3RhZ2U/OiB7IFtzdGFnZTogc3RyaW5nXTogc3RyaW5nIH07XG4gIC8qKiBJQU0gcm9sZSBBUk5zIGZvciBkaWZmZXJlbnQgZGVwbG95bWVudCBzdGFnZXMuICovXG4gIHJlYWRvbmx5IGRlcGxveW1lbnQ/OiB7IFtzdGFnZTogc3RyaW5nXTogc3RyaW5nIH07XG59XG5cbi8qKlxuICogRXh0ZW5zaW9uIG9mIHRoZSBiYXNlIENES1BpcGVsaW5lIG9wdGlvbnMgaW5jbHVkaW5nIHNwZWNpZmljIGNvbmZpZ3VyYXRpb25zIGZvciBHaXRIdWIuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgR2l0aHViQ0RLUGlwZWxpbmVPcHRpb25zIGV4dGVuZHMgQ0RLUGlwZWxpbmVPcHRpb25zIHtcblxuICAvKiogSUFNIGNvbmZpZyBmb3IgR2l0SHViIEFjdGlvbnMgKi9cbiAgcmVhZG9ubHkgaWFtUm9sZUFybnM6IEdpdGh1YklhbVJvbGVDb25maWc7XG5cbiAgLyoqXG4gICAqIHJ1bm5lciB0YWdzIHRvIHVzZSB0byBzZWxlY3QgcnVubmVyc1xuICAgKlxuICAgKiBAZGVmYXVsdCBbJ3VidW50dS1sYXRlc3QnXVxuICAgKi9cbiAgcmVhZG9ubHkgcnVubmVyVGFncz86IHN0cmluZ1tdO1xuXG4gIC8qKiB1c2UgR2l0SHViIFBhY2thZ2VzIHRvIHN0b3JlIHZlc2lvbmVkIGFydGlmYWN0cyBvZiBjbG91ZCBhc3NlbWJseTsgYWxzbyBuZWVkZWQgZm9yIG1hbnVhbCBhcHByb3ZhbHMgKi9cbiAgcmVhZG9ubHkgdXNlR2l0aHViUGFja2FnZXNGb3JBc3NlbWJseT86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIHdoZXRoZXIgdG8gdXNlIEdpdEh1YiBlbnZpcm9ubWVudHMgZm9yIGRlcGxveW1lbnQgc3RhZ2VzXG4gICAqXG4gICAqIElORk86IFdoZW4gdXNpbmcgZW52aXJvbm1lbnRzIGNvbnNpZGVyIHByb3RlY3Rpb24gcnVsZXMgaW5zdGVhZCBvZiB1c2luZyB0aGUgbWFudWFsIG9wdGlvbiBvZiBwcm9qZW4tcGlwZWxpbmVzIGZvciBzdGFnZXNcbiAgICpcbiAgICogQGRlZmF1bHQgZmFsc2VcbiAgICovXG4gIHJlYWRvbmx5IHVzZUdpdGh1YkVudmlyb25tZW50cz86IGJvb2xlYW47XG59XG5cblxuLyoqXG4gKiBJbXBsZW1lbnRzIGEgQ0RLIFBpcGVsaW5lIGNvbmZpZ3VyZWQgc3BlY2lmaWNhbGx5IGZvciBHaXRIdWIgd29ya2Zsb3dzLlxuICovXG5leHBvcnQgY2xhc3MgR2l0aHViQ0RLUGlwZWxpbmUgZXh0ZW5kcyBDREtQaXBlbGluZSB7XG5cbiAgLyoqIEluZGljYXRlcyBpZiB2ZXJzaW9uZWQgYXJ0aWZhY3RzIGFyZSBuZWVkZWQgYmFzZWQgb24gbWFudWFsIGFwcHJvdmFsIHJlcXVpcmVtZW50cy4gKi9cbiAgcHVibGljIHJlYWRvbmx5IG5lZWRzVmVyc2lvbmVkQXJ0aWZhY3RzOiBib29sZWFuO1xuXG4gIC8qKiBUaGUgR2l0SHViIHdvcmtmbG93IGFzc29jaWF0ZWQgd2l0aCB0aGUgcGlwZWxpbmUuICovXG4gIHByaXZhdGUgZGVwbG95bWVudFdvcmtmbG93OiBHaXRodWJXb3JrZmxvdztcbiAgLyoqIExpc3Qgb2YgZGVwbG95bWVudCBzdGFnZXMgZm9yIHRoZSBwaXBlbGluZS4gKi9cbiAgcHJpdmF0ZSBkZXBsb3ltZW50U3RhZ2VzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHByb3RlY3RlZCB1c2VHaXRodWJQYWNrYWdlczogYm9vbGVhbjtcblxuICAvKipcbiAgICogQ29uc3RydWN0cyBhIG5ldyBHaXRodWJDREtQaXBlbGluZSBpbnN0YW5jZS5cbiAgICogQHBhcmFtIGFwcCAtIFRoZSBDREsgYXBwIGFzc29jaWF0ZWQgd2l0aCB0aGlzIHBpcGVsaW5lLlxuICAgKiBAcGFyYW0gb3B0aW9ucyAtIENvbmZpZ3VyYXRpb24gb3B0aW9ucyBmb3IgdGhlIHBpcGVsaW5lLlxuICAgKi9cbiAgY29uc3RydWN0b3IoYXBwOiBhd3NjZGsuQXdzQ2RrVHlwZVNjcmlwdEFwcCwgcHJpdmF0ZSBvcHRpb25zOiBHaXRodWJDREtQaXBlbGluZU9wdGlvbnMpIHtcbiAgICBzdXBlcihhcHAsIHtcbiAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAuLi5vcHRpb25zLnVzZUdpdGh1YlBhY2thZ2VzRm9yQXNzZW1ibHkgJiYge1xuICAgICAgICBwcmVJbnN0YWxsU3RlcHM6IFtcbiAgICAgICAgICBuZXcgR2l0aHViUGFja2FnZXNMb2dpblN0ZXAoYXBwLCB7IHdyaXRlOiBmYWxzZSB9KSxcbiAgICAgICAgICAuLi5vcHRpb25zLnByZUluc3RhbGxTdGVwcyA/PyBbXSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBJbml0aWFsaXplIHRoZSBkZXBsb3ltZW50IHdvcmtmbG93IG9uIEdpdEh1Yi5cbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvdyA9IHRoaXMuYXBwLmdpdGh1YiEuYWRkV29ya2Zsb3coJ2RlcGxveScpO1xuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93Lm9uKHtcbiAgICAgIHB1c2g6IHtcbiAgICAgICAgYnJhbmNoZXM6IFt0aGlzLmJyYW5jaE5hbWVdLFxuICAgICAgfSxcbiAgICAgIHdvcmtmbG93RGlzcGF0Y2g6IHt9LFxuICAgIH0pO1xuXG4gICAgLy8gRGV0ZXJtaW5lIGlmIHZlcnNpb25lZCBhcnRpZmFjdHMgYXJlIG5lY2Vzc2FyeS5cbiAgICB0aGlzLm5lZWRzVmVyc2lvbmVkQXJ0aWZhY3RzID0gb3B0aW9ucy5zdGFnZXMuZmluZChzID0+IHMubWFudWFsQXBwcm92YWwgPT09IHRydWUpICE9PSB1bmRlZmluZWQ7O1xuICAgIHRoaXMudXNlR2l0aHViUGFja2FnZXMgPSB0aGlzLm5lZWRzVmVyc2lvbmVkQXJ0aWZhY3RzICYmIChvcHRpb25zLnVzZUdpdGh1YlBhY2thZ2VzRm9yQXNzZW1ibHkgPz8gZmFsc2UpO1xuXG4gICAgaWYgKHRoaXMudXNlR2l0aHViUGFja2FnZXMpIHtcbiAgICAgIGFwcC5ucG1yYy5hZGRSZWdpc3RyeSgnaHR0cHM6Ly9ucG0ucGtnLmdpdGh1Yi5jb20nLCB0aGlzLmJhc2VPcHRpb25zLnBrZ05hbWVzcGFjZSk7XG4gICAgICBhcHAubnBtcmMuYWRkQ29uZmlnKCcvL25wbS5wa2cuZ2l0aHViLmNvbS86X2F1dGhUb2tlbicsICcke0dJVEhVQl9UT0tFTn0nKTtcbiAgICAgIGFwcC5ucG1yYy5hZGRDb25maWcoJy8vbnBtLnBrZy5naXRodWIuY29tLzphbHdheXMtYXV0aCcsICd0cnVlJyk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIGpvYnMgZm9yIHN5bnRoZXNpemluZywgYXNzZXQgdXBsb2FkaW5nLCBhbmQgZGVwbG95bWVudC5cbiAgICB0aGlzLmNyZWF0ZVN5bnRoKCk7XG5cbiAgICB0aGlzLmNyZWF0ZUFzc2V0VXBsb2FkKCk7XG5cbiAgICBmb3IgKGNvbnN0IHN0YWdlIG9mIG9wdGlvbnMuc3RhZ2VzKSB7XG4gICAgICB0aGlzLmNyZWF0ZURlcGxveW1lbnQoc3RhZ2UpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHN0YWdlIG9mIChvcHRpb25zLmluZGVwZW5kZW50U3RhZ2VzID8/IFtdKSkge1xuICAgICAgdGhpcy5jcmVhdGVJbmRlcGVuZGVudERlcGxveW1lbnQoc3RhZ2UpO1xuICAgIH1cbiAgfVxuXG4gIC8qKiB0aGUgdHlwZSBvZiBlbmdpbmUgdGhpcyBpbXBsZW1lbnRhdGlvbiBvZiBDREtQaXBlbGluZSBpcyBmb3IgKi9cbiAgcHVibGljIGVuZ2luZVR5cGUoKTogUGlwZWxpbmVFbmdpbmUge1xuICAgIHJldHVybiBQaXBlbGluZUVuZ2luZS5HSVRIVUI7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIHN5bnRoZXNpcyBqb2IgZm9yIHRoZSBwaXBlbGluZSB1c2luZyBHaXRIdWIgQWN0aW9ucy5cbiAgICovXG4gIHByaXZhdGUgY3JlYXRlU3ludGgoKTogdm9pZCB7XG4gICAgY29uc3Qgc3RlcHM6IFBpcGVsaW5lU3RlcFtdID0gW107XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zPy5zeW50aCkge1xuICAgICAgc3RlcHMucHVzaChuZXcgQXdzQXNzdW1lUm9sZVN0ZXAodGhpcy5wcm9qZWN0LCB7XG4gICAgICAgIHJvbGVBcm46IHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucy5zeW50aCxcbiAgICAgICAgc2Vzc2lvbk5hbWU6ICdHaXRIdWJBY3Rpb24nLFxuICAgICAgfSkpO1xuICAgIH1cbiAgICBzdGVwcy5wdXNoKC4uLnRoaXMuYmFzZU9wdGlvbnMucHJlSW5zdGFsbFN0ZXBzID8/IFtdKTtcbiAgICBzdGVwcy5wdXNoKG5ldyBTaW1wbGVDb21tYW5kU3RlcCh0aGlzLnByb2plY3QsIHRoaXMucmVuZGVySW5zdGFsbENvbW1hbmRzKCkpKTtcblxuICAgIHN0ZXBzLnB1c2goLi4udGhpcy5iYXNlT3B0aW9ucy5wcmVTeW50aFN0ZXBzID8/IFtdKTtcbiAgICBzdGVwcy5wdXNoKG5ldyBTaW1wbGVDb21tYW5kU3RlcCh0aGlzLnByb2plY3QsIHRoaXMucmVuZGVyU3ludGhDb21tYW5kcygpKSk7XG4gICAgc3RlcHMucHVzaCguLi50aGlzLmJhc2VPcHRpb25zLnBvc3RTeW50aFN0ZXBzID8/IFtdKTtcblxuICAgIHN0ZXBzLnB1c2gobmV3IFVwbG9hZEFydGlmYWN0U3RlcCh0aGlzLnByb2plY3QsIHtcbiAgICAgIG5hbWU6ICdjbG91ZC1hc3NlbWJseScsXG4gICAgICBwYXRoOiBgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fS9gLFxuICAgIH0pKTtcblxuICAgIGNvbnN0IGdpdGh1YlN0ZXBzID0gc3RlcHMubWFwKHMgPT4gcy50b0dpdGh1YigpKTtcblxuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93LmFkZEpvYignc3ludGgnLCB7XG4gICAgICBuYW1lOiAnU3ludGggQ0RLIGFwcGxpY2F0aW9uJyxcbiAgICAgIHJ1bnNPbjogdGhpcy5vcHRpb25zLnJ1bm5lclRhZ3MgPz8gREVGQVVMVF9SVU5ORVJfVEFHUyxcbiAgICAgIGVudjoge1xuICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICAuLi5naXRodWJTdGVwcy5yZWR1Y2UoKGFjYywgc3RlcCkgPT4gKHsgLi4uYWNjLCAuLi5zdGVwLmVudiB9KSwge30pLFxuICAgICAgfSxcbiAgICAgIG5lZWRzOiBbLi4uZ2l0aHViU3RlcHMuZmxhdE1hcChzID0+IHMubmVlZHMpXSxcbiAgICAgIHBlcm1pc3Npb25zOiBtZXJnZUpvYlBlcm1pc3Npb25zKHtcbiAgICAgICAgaWRUb2tlbjogSm9iUGVybWlzc2lvbi5XUklURSxcbiAgICAgICAgY29udGVudHM6IEpvYlBlcm1pc3Npb24uUkVBRCxcbiAgICAgIH0sIC4uLihnaXRodWJTdGVwcy5mbGF0TWFwKHMgPT4gcy5wZXJtaXNzaW9ucykuZmlsdGVyKHAgPT4gcCAhPSB1bmRlZmluZWQpIGFzIEpvYlBlcm1pc3Npb25zW10pKSxcbiAgICAgIHN0ZXBzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiAnQ2hlY2tvdXQnLFxuICAgICAgICAgIHVzZXM6ICdhY3Rpb25zL2NoZWNrb3V0QHY0JyxcbiAgICAgICAgfSxcbiAgICAgICAgLi4uZ2l0aHViU3RlcHMuZmxhdE1hcChzID0+IHMuc3RlcHMpLFxuICAgICAgXSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgam9iIHRvIHVwbG9hZCBhc3NldHMgdG8gQVdTIGFzIHBhcnQgb2YgdGhlIHBpcGVsaW5lLlxuICAgKi9cbiAgcHVibGljIGNyZWF0ZUFzc2V0VXBsb2FkKCk6IHZvaWQge1xuICAgIGNvbnN0IGdsb2JhbFB1Ymxpc2hSb2xlID0gdGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zLmFzc2V0UHVibGlzaGluZyA/PyB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnMuZGVmYXVsdCE7XG5cbiAgICBjb25zdCBzdGVwcyA9IFtcbiAgICAgIG5ldyBTaW1wbGVDb21tYW5kU3RlcCh0aGlzLnByb2plY3QsIFsnZ2l0IGNvbmZpZyAtLWdsb2JhbCB1c2VyLm5hbWUgXCJnaXRodWItYWN0aW9uc1wiICYmIGdpdCBjb25maWcgLS1nbG9iYWwgdXNlci5lbWFpbCBcImdpdGh1Yi1hY3Rpb25zQGdpdGh1Yi5jb21cIiddKSxcbiAgICAgIG5ldyBBd3NBc3N1bWVSb2xlU3RlcCh0aGlzLnByb2plY3QsIHtcbiAgICAgICAgcm9sZUFybjogZ2xvYmFsUHVibGlzaFJvbGUsXG4gICAgICAgIHJlZ2lvbjogJ3VzLWVhc3QtMScsXG4gICAgICB9KSxcbiAgICAgIG5ldyBEb3dubG9hZEFydGlmYWN0U3RlcCh0aGlzLnByb2plY3QsIHtcbiAgICAgICAgbmFtZTogJ2Nsb3VkLWFzc2VtYmx5JyxcbiAgICAgICAgcGF0aDogYCR7dGhpcy5hcHAuY2RrQ29uZmlnLmNka291dH0vYCxcbiAgICAgIH0pLFxuICAgICAgLi4udGhpcy5iYXNlT3B0aW9ucy5wcmVJbnN0YWxsU3RlcHMgPz8gW10sXG4gICAgICBuZXcgU2ltcGxlQ29tbWFuZFN0ZXAodGhpcy5wcm9qZWN0LCB0aGlzLnJlbmRlckluc3RhbGxDb21tYW5kcygpKSxcbiAgICBdO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucy5hc3NldFB1Ymxpc2hpbmdQZXJTdGFnZSkge1xuICAgICAgY29uc3Qgc3RhZ2VzID0gWy4uLnRoaXMub3B0aW9ucy5zdGFnZXMsIC4uLnRoaXMub3B0aW9ucy5pbmRlcGVuZGVudFN0YWdlcyA/PyBbXV07XG4gICAgICBmb3IgKGNvbnN0IHN0YWdlIG9mIHN0YWdlcykge1xuICAgICAgICBzdGVwcy5wdXNoKG5ldyBBd3NBc3N1bWVSb2xlU3RlcCh0aGlzLnByb2plY3QsIHtcbiAgICAgICAgICByb2xlQXJuOiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnMuYXNzZXRQdWJsaXNoaW5nUGVyU3RhZ2Vbc3RhZ2UubmFtZV0gPz8gZ2xvYmFsUHVibGlzaFJvbGUsXG4gICAgICAgIH0pKTtcbiAgICAgICAgc3RlcHMucHVzaChuZXcgU2ltcGxlQ29tbWFuZFN0ZXAodGhpcy5wcm9qZWN0LCB0aGlzLnJlbmRlckFzc2V0VXBsb2FkQ29tbWFuZHMoc3RhZ2UubmFtZSkpKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc3RlcHMucHVzaChuZXcgU2ltcGxlQ29tbWFuZFN0ZXAodGhpcy5wcm9qZWN0LCB0aGlzLnJlbmRlckFzc2V0VXBsb2FkQ29tbWFuZHMoKSkpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm5lZWRzVmVyc2lvbmVkQXJ0aWZhY3RzKSB7XG4gICAgICBzdGVwcy5wdXNoKG5ldyBTaW1wbGVDb21tYW5kU3RlcCh0aGlzLnByb2plY3QsIHRoaXMucmVuZGVyQXNzZW1ibHlVcGxvYWRDb21tYW5kcygpKSk7XG4gICAgfVxuXG4gICAgY29uc3QgZ2hTdGVwcyA9IHN0ZXBzLm1hcChzID0+IHMudG9HaXRodWIoKSk7XG5cbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvdy5hZGRKb2IoJ2Fzc2V0VXBsb2FkJywge1xuICAgICAgbmFtZTogJ1B1Ymxpc2ggYXNzZXRzIHRvIEFXUycsXG4gICAgICBuZWVkczogWydzeW50aCcsIC4uLmdoU3RlcHMuZmxhdE1hcChzID0+IHMubmVlZHMpXSxcbiAgICAgIHJ1bnNPbjogdGhpcy5vcHRpb25zLnJ1bm5lclRhZ3MgPz8gREVGQVVMVF9SVU5ORVJfVEFHUyxcbiAgICAgIGVudjoge1xuICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICAuLi5naFN0ZXBzLnJlZHVjZSgoYWNjLCBzdGVwKSA9PiAoeyAuLi5hY2MsIC4uLnN0ZXAuZW52IH0pLCB7fSksXG4gICAgICB9LFxuICAgICAgcGVybWlzc2lvbnM6IG1lcmdlSm9iUGVybWlzc2lvbnMoe1xuICAgICAgICBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLFxuICAgICAgICBjb250ZW50czogdGhpcy5uZWVkc1ZlcnNpb25lZEFydGlmYWN0cyA/IEpvYlBlcm1pc3Npb24uV1JJVEUgOiBKb2JQZXJtaXNzaW9uLlJFQUQsXG4gICAgICAgIC4uLnRoaXMudXNlR2l0aHViUGFja2FnZXMgJiYge1xuICAgICAgICAgIHBhY2thZ2VzOiBKb2JQZXJtaXNzaW9uLldSSVRFLFxuICAgICAgICB9LFxuICAgICAgfSwgLi4uKGdoU3RlcHMuZmxhdE1hcChzID0+IHMucGVybWlzc2lvbnMpLmZpbHRlcihwID0+IHAgIT0gdW5kZWZpbmVkKSBhcyBKb2JQZXJtaXNzaW9uc1tdKSksXG4gICAgICBzdGVwczogW1xuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ0NoZWNrb3V0JyxcbiAgICAgICAgICB1c2VzOiAnYWN0aW9ucy9jaGVja291dEB2NCcsXG4gICAgICAgICAgd2l0aDoge1xuICAgICAgICAgICAgJ2ZldGNoLWRlcHRoJzogMCxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAuLi5naFN0ZXBzLmZsYXRNYXAocyA9PiBzLnN0ZXBzKSxcbiAgICAgIF0sXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIGpvYiB0byBkZXBsb3kgdGhlIENESyBhcHBsaWNhdGlvbiB0byBBV1MuXG4gICAqIEBwYXJhbSBzdGFnZSAtIFRoZSBkZXBsb3ltZW50IHN0YWdlIHRvIGNyZWF0ZS5cbiAgICovXG4gIHB1YmxpYyBjcmVhdGVEZXBsb3ltZW50KHN0YWdlOiBEZXBsb3ltZW50U3RhZ2UpOiB2b2lkIHtcblxuICAgIGlmIChzdGFnZS5tYW51YWxBcHByb3ZhbCA9PT0gdHJ1ZSkge1xuICAgICAgY29uc3Qgc3RlcHMgPSBbXG4gICAgICAgIG5ldyBBd3NBc3N1bWVSb2xlU3RlcCh0aGlzLnByb2plY3QsIHtcbiAgICAgICAgICByb2xlQXJuOiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LmRlcGxveW1lbnQ/LltzdGFnZS5uYW1lXSA/PyB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LmRlZmF1bHQhLFxuICAgICAgICAgIHJlZ2lvbjogc3RhZ2UuZW52LnJlZ2lvbixcbiAgICAgICAgfSksXG4gICAgICAgIC4uLnRoaXMuYmFzZU9wdGlvbnMucHJlSW5zdGFsbFN0ZXBzID8/IFtdLFxuICAgICAgICBuZXcgU2ltcGxlQ29tbWFuZFN0ZXAodGhpcy5wcm9qZWN0LCB0aGlzLnJlbmRlckluc3RhbGxDb21tYW5kcygpKSxcbiAgICAgICAgbmV3IFNpbXBsZUNvbW1hbmRTdGVwKHRoaXMucHJvamVjdCwgdGhpcy5yZW5kZXJJbnN0YWxsUGFja2FnZUNvbW1hbmRzKGAke3RoaXMuYmFzZU9wdGlvbnMucGtnTmFtZXNwYWNlfS8ke3RoaXMuYXBwLm5hbWV9QFxcJHt7Z2l0aHViLmV2ZW50LmlucHV0cy52ZXJzaW9ufX1gKSksXG4gICAgICAgIG5ldyBTaW1wbGVDb21tYW5kU3RlcCh0aGlzLnByb2plY3QsIFtgbXYgLi9ub2RlX21vZHVsZXMvJHt0aGlzLmJhc2VPcHRpb25zLnBrZ05hbWVzcGFjZX0vJHt0aGlzLmFwcC5uYW1lfSAke3RoaXMuYXBwLmNka0NvbmZpZy5jZGtvdXR9YF0pLFxuICAgICAgICBuZXcgU2ltcGxlQ29tbWFuZFN0ZXAodGhpcy5wcm9qZWN0LCB0aGlzLnJlbmRlckRlcGxveUNvbW1hbmRzKHN0YWdlLm5hbWUpKSxcbiAgICAgICAgbmV3IFVwbG9hZEFydGlmYWN0U3RlcCh0aGlzLnByb2plY3QsIHtcbiAgICAgICAgICBuYW1lOiBgY2RrLW91dHB1dHMtJHtzdGFnZS5uYW1lfWAsXG4gICAgICAgICAgcGF0aDogYGNkay1vdXRwdXRzLSR7c3RhZ2UubmFtZX0uanNvbmAsXG4gICAgICAgIH0pLFxuICAgICAgXS5tYXAocyA9PiBzLnRvR2l0aHViKCkpO1xuXG4gICAgICAvLyBDcmVhdGUgbmV3IHdvcmtmbG93IGZvciBkZXBsb3ltZW50XG4gICAgICBjb25zdCBzdGFnZVdvcmtmbG93ID0gdGhpcy5hcHAuZ2l0aHViIS5hZGRXb3JrZmxvdyhgcmVsZWFzZS0ke3N0YWdlLm5hbWV9YCk7XG4gICAgICBzdGFnZVdvcmtmbG93Lm9uKHtcbiAgICAgICAgd29ya2Zsb3dEaXNwYXRjaDoge1xuICAgICAgICAgIGlucHV0czoge1xuICAgICAgICAgICAgdmVyc2lvbjoge1xuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1BhY2thZ2UgdmVyc2lvbicsXG4gICAgICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBzdGFnZVdvcmtmbG93LmFkZEpvYignZGVwbG95Jywge1xuICAgICAgICBuYW1lOiBgUmVsZWFzZSBzdGFnZSAke3N0YWdlLm5hbWV9IHRvIEFXU2AsXG4gICAgICAgIG5lZWRzOiBzdGVwcy5mbGF0TWFwKHMgPT4gcy5uZWVkcyksXG4gICAgICAgIHJ1bnNPbjogdGhpcy5vcHRpb25zLnJ1bm5lclRhZ3MgPz8gREVGQVVMVF9SVU5ORVJfVEFHUyxcbiAgICAgICAgLi4udGhpcy5vcHRpb25zLnVzZUdpdGh1YkVudmlyb25tZW50cyAmJiB7XG4gICAgICAgICAgZW52aXJvbm1lbnQ6IHN0YWdlLm5hbWUsXG4gICAgICAgIH0sXG4gICAgICAgIGVudjoge1xuICAgICAgICAgIENJOiAndHJ1ZScsXG4gICAgICAgICAgLi4uc3RlcHMucmVkdWNlKChhY2MsIHN0ZXApID0+ICh7IC4uLmFjYywgLi4uc3RlcC5lbnYgfSksIHt9KSxcbiAgICAgICAgfSxcbiAgICAgICAgcGVybWlzc2lvbnM6IG1lcmdlSm9iUGVybWlzc2lvbnMoe1xuICAgICAgICAgIGlkVG9rZW46IEpvYlBlcm1pc3Npb24uV1JJVEUsXG4gICAgICAgICAgY29udGVudHM6IEpvYlBlcm1pc3Npb24uUkVBRCxcbiAgICAgICAgfSwgLi4uKHN0ZXBzLmZsYXRNYXAocyA9PiBzLnBlcm1pc3Npb25zKS5maWx0ZXIocCA9PiBwICE9IHVuZGVmaW5lZCkgYXMgSm9iUGVybWlzc2lvbnNbXSkpLFxuICAgICAgICBzdGVwczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdDaGVja291dCcsXG4gICAgICAgICAgICB1c2VzOiAnYWN0aW9ucy9jaGVja291dEB2NCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAuLi5zdGVwcy5mbGF0TWFwKHMgPT4gcy5zdGVwcyksXG4gICAgICAgIF0sXG4gICAgICB9KTtcblxuICAgIH0gZWxzZSB7XG5cbiAgICAgIGNvbnN0IHN0ZXBzID0gW1xuICAgICAgICBuZXcgQXdzQXNzdW1lUm9sZVN0ZXAodGhpcy5wcm9qZWN0LCB7XG4gICAgICAgICAgcm9sZUFybjogdGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zPy5kZXBsb3ltZW50Py5bc3RhZ2UubmFtZV0gPz8gdGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zPy5kZWZhdWx0ISxcbiAgICAgICAgICByZWdpb246IHN0YWdlLmVudi5yZWdpb24sXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgRG93bmxvYWRBcnRpZmFjdFN0ZXAodGhpcy5wcm9qZWN0LCB7XG4gICAgICAgICAgbmFtZTogJ2Nsb3VkLWFzc2VtYmx5JyxcbiAgICAgICAgICBwYXRoOiBgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fS9gLFxuICAgICAgICB9KSxcbiAgICAgICAgLi4udGhpcy5iYXNlT3B0aW9ucy5wcmVJbnN0YWxsU3RlcHMgPz8gW10sXG4gICAgICAgIG5ldyBTaW1wbGVDb21tYW5kU3RlcCh0aGlzLnByb2plY3QsIHRoaXMucmVuZGVySW5zdGFsbENvbW1hbmRzKCkpLFxuICAgICAgICBuZXcgU2ltcGxlQ29tbWFuZFN0ZXAodGhpcy5wcm9qZWN0LCB0aGlzLnJlbmRlckRlcGxveUNvbW1hbmRzKHN0YWdlLm5hbWUpKSxcbiAgICAgICAgbmV3IFVwbG9hZEFydGlmYWN0U3RlcCh0aGlzLnByb2plY3QsIHtcbiAgICAgICAgICBuYW1lOiBgY2RrLW91dHB1dHMtJHtzdGFnZS5uYW1lfWAsXG4gICAgICAgICAgcGF0aDogYGNkay1vdXRwdXRzLSR7c3RhZ2UubmFtZX0uanNvbmAsXG4gICAgICAgIH0pLFxuICAgICAgXS5tYXAocyA9PiBzLnRvR2l0aHViKCkpO1xuXG4gICAgICAvLyBBZGQgZGVwbG95bWVudCB0byBDSS9DRCB3b3JrZmxvd1xuICAgICAgdGhpcy5kZXBsb3ltZW50V29ya2Zsb3cuYWRkSm9iKGBkZXBsb3ktJHtzdGFnZS5uYW1lfWAsIHtcbiAgICAgICAgbmFtZTogYERlcGxveSBzdGFnZSAke3N0YWdlLm5hbWV9IHRvIEFXU2AsXG4gICAgICAgIC4uLnRoaXMub3B0aW9ucy51c2VHaXRodWJFbnZpcm9ubWVudHMgJiYge1xuICAgICAgICAgIGVudmlyb25tZW50OiBzdGFnZS5uYW1lLFxuICAgICAgICB9LFxuICAgICAgICBuZWVkczogWydhc3NldFVwbG9hZCcsIC4uLnN0ZXBzLmZsYXRNYXAocyA9PiBzLm5lZWRzKSwgLi4uKHRoaXMuZGVwbG95bWVudFN0YWdlcy5sZW5ndGggPiAwID8gW2BkZXBsb3ktJHt0aGlzLmRlcGxveW1lbnRTdGFnZXMuYXQoLTEpIX1gXSA6IFtdKV0sXG4gICAgICAgIHJ1bnNPbjogdGhpcy5vcHRpb25zLnJ1bm5lclRhZ3MgPz8gREVGQVVMVF9SVU5ORVJfVEFHUyxcbiAgICAgICAgZW52OiB7XG4gICAgICAgICAgQ0k6ICd0cnVlJyxcbiAgICAgICAgICAuLi5zdGVwcy5yZWR1Y2UoKGFjYywgc3RlcCkgPT4gKHsgLi4uYWNjLCAuLi5zdGVwLmVudiB9KSwge30pLFxuICAgICAgICB9LFxuICAgICAgICBwZXJtaXNzaW9uczogbWVyZ2VKb2JQZXJtaXNzaW9ucyh7XG4gICAgICAgICAgaWRUb2tlbjogSm9iUGVybWlzc2lvbi5XUklURSxcbiAgICAgICAgICBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFELFxuICAgICAgICB9LCAuLi4oc3RlcHMuZmxhdE1hcChzID0+IHMucGVybWlzc2lvbnMpLmZpbHRlcihwID0+IHAgIT0gdW5kZWZpbmVkKSBhcyBKb2JQZXJtaXNzaW9uc1tdKSksXG4gICAgICAgIHN0ZXBzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ0NoZWNrb3V0JyxcbiAgICAgICAgICAgIHVzZXM6ICdhY3Rpb25zL2NoZWNrb3V0QHY0JyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIC4uLnN0ZXBzLmZsYXRNYXAocyA9PiBzLnN0ZXBzKSxcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuICAgICAgdGhpcy5kZXBsb3ltZW50U3RhZ2VzLnB1c2goc3RhZ2UubmFtZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBqb2IgdG8gZGVwbG95IHRoZSBDREsgYXBwbGljYXRpb24gdG8gQVdTLlxuICAgKiBAcGFyYW0gc3RhZ2UgLSBUaGUgaW5kZXBlbmRlbnQgc3RhZ2UgdG8gY3JlYXRlLlxuICAgKi9cbiAgcHVibGljIGNyZWF0ZUluZGVwZW5kZW50RGVwbG95bWVudChzdGFnZTogSW5kZXBlbmRlbnRTdGFnZSk6IHZvaWQge1xuICAgIGNvbnN0IHN0ZXBzID0gW1xuICAgICAgbmV3IEF3c0Fzc3VtZVJvbGVTdGVwKHRoaXMucHJvamVjdCwge1xuICAgICAgICByb2xlQXJuOiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LmRlcGxveW1lbnQ/LltzdGFnZS5uYW1lXSA/PyB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LmRlZmF1bHQhLFxuICAgICAgICByZWdpb246IHN0YWdlLmVudi5yZWdpb24sXG4gICAgICB9KSxcbiAgICAgIC4uLnRoaXMuYmFzZU9wdGlvbnMucHJlSW5zdGFsbFN0ZXBzID8/IFtdLFxuICAgICAgbmV3IFNpbXBsZUNvbW1hbmRTdGVwKHRoaXMucHJvamVjdCwgdGhpcy5yZW5kZXJJbnN0YWxsQ29tbWFuZHMoKSksXG5cbiAgICAgIC4uLnRoaXMuYmFzZU9wdGlvbnMucHJlU3ludGhTdGVwcyA/PyBbXSxcbiAgICAgIG5ldyBTaW1wbGVDb21tYW5kU3RlcCh0aGlzLnByb2plY3QsIHRoaXMucmVuZGVyU3ludGhDb21tYW5kcygpKSxcbiAgICAgIC4uLnRoaXMuYmFzZU9wdGlvbnMucG9zdFN5bnRoU3RlcHMgPz8gW10sXG5cbiAgICAgIG5ldyBTaW1wbGVDb21tYW5kU3RlcCh0aGlzLnByb2plY3QsIHRoaXMucmVuZGVyRGlmZkNvbW1hbmRzKHN0YWdlLm5hbWUpKSxcbiAgICAgIC4uLnN0YWdlLnBvc3REaWZmU3RlcHMgPz8gW10sXG5cbiAgICAgIG5ldyBTaW1wbGVDb21tYW5kU3RlcCh0aGlzLnByb2plY3QsIHRoaXMucmVuZGVyRGVwbG95Q29tbWFuZHMoc3RhZ2UubmFtZSkpLFxuICAgICAgLi4uc3RhZ2UucG9zdERlcGxveVN0ZXBzID8/IFtdLFxuXG4gICAgICBuZXcgVXBsb2FkQXJ0aWZhY3RTdGVwKHRoaXMucHJvamVjdCwge1xuICAgICAgICBuYW1lOiBgY2RrLW91dHB1dHMtJHtzdGFnZS5uYW1lfWAsXG4gICAgICAgIHBhdGg6IGBjZGstb3V0cHV0cy0ke3N0YWdlLm5hbWV9Lmpzb25gLFxuICAgICAgfSksXG4gICAgXS5tYXAocyA9PiBzLnRvR2l0aHViKCkpO1xuXG4gICAgLy8gQ3JlYXRlIG5ldyB3b3JrZmxvdyBmb3IgZGVwbG95bWVudFxuICAgIGNvbnN0IHN0YWdlV29ya2Zsb3cgPSB0aGlzLmFwcC5naXRodWIhLmFkZFdvcmtmbG93KGBkZXBsb3ktJHtzdGFnZS5uYW1lfWApO1xuICAgIHN0YWdlV29ya2Zsb3cub24oe1xuICAgICAgd29ya2Zsb3dEaXNwYXRjaDoge30sXG4gICAgICAuLi5zdGFnZS5kZXBsb3lPblB1c2ggJiYge1xuICAgICAgICBwdXNoOiB7XG4gICAgICAgICAgYnJhbmNoZXM6IFt0aGlzLmJyYW5jaE5hbWVdLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBzdGFnZVdvcmtmbG93LmFkZEpvYignZGVwbG95Jywge1xuICAgICAgbmFtZTogYFJlbGVhc2Ugc3RhZ2UgJHtzdGFnZS5uYW1lfSB0byBBV1NgLFxuICAgICAgbmVlZHM6IHN0ZXBzLmZsYXRNYXAocyA9PiBzLm5lZWRzKSxcbiAgICAgIHJ1bnNPbjogdGhpcy5vcHRpb25zLnJ1bm5lclRhZ3MgPz8gREVGQVVMVF9SVU5ORVJfVEFHUyxcbiAgICAgIC4uLnRoaXMub3B0aW9ucy51c2VHaXRodWJFbnZpcm9ubWVudHMgJiYge1xuICAgICAgICBlbnZpcm9ubWVudDogc3RhZ2UubmFtZSxcbiAgICAgIH0sXG4gICAgICBlbnY6IHtcbiAgICAgICAgQ0k6ICd0cnVlJyxcbiAgICAgICAgLi4uc3RlcHMucmVkdWNlKChhY2MsIHN0ZXApID0+ICh7IC4uLmFjYywgLi4uc3RlcC5lbnYgfSksIHt9KSxcbiAgICAgIH0sXG4gICAgICBwZXJtaXNzaW9uczogbWVyZ2VKb2JQZXJtaXNzaW9ucyh7XG4gICAgICAgIGlkVG9rZW46IEpvYlBlcm1pc3Npb24uV1JJVEUsXG4gICAgICAgIGNvbnRlbnRzOiBKb2JQZXJtaXNzaW9uLlJFQUQsXG4gICAgICB9LCAuLi4oc3RlcHMuZmxhdE1hcChzID0+IHMucGVybWlzc2lvbnMpLmZpbHRlcihwID0+IHAgIT0gdW5kZWZpbmVkKSBhcyBKb2JQZXJtaXNzaW9uc1tdKSksXG4gICAgICBzdGVwczogW1xuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ0NoZWNrb3V0JyxcbiAgICAgICAgICB1c2VzOiAnYWN0aW9ucy9jaGVja291dEB2NCcsXG4gICAgICAgIH0sXG4gICAgICAgIC4uLnN0ZXBzLmZsYXRNYXAocyA9PiBzLnN0ZXBzKSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgfVxufVxuIl19