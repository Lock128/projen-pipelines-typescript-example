"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubCDKPipeline = void 0;
const JSII_RTTI_SYMBOL_1 = Symbol.for("jsii.rtti");
const workflows_model_1 = require("projen/lib/github/workflows-model");
const base_1 = require("./base");
class GithubCDKPipeline extends base_1.CDKPipeline {
    constructor(app, options) {
        super(app, options);
        this.options = options;
        this.deploymentStages = [];
        this.deploymentWorkflow = this.app.github.addWorkflow('deploy');
        this.deploymentWorkflow.on({
            push: {
                branches: ['main'],
            },
            workflowDispatch: {},
        });
        this.needsVersionedArtifacts = this.options.stages.find(s => s.manualApproval === true) !== undefined;
        this.createSynth();
        this.createAssetUpload();
        for (const stage of options.stages) {
            this.createDeployment(stage);
        }
    }
    createSynth() {
        const steps = [{
                name: 'Checkout',
                uses: 'actions/checkout@v3',
            }];
        if (this.options.iamRoleArns?.synth) {
            steps.push({
                name: 'AWS Credentials',
                uses: 'aws-actions/configure-aws-credentials@master',
                with: {
                    'role-to-assume': this.options.iamRoleArns.synth,
                    'role-session-name': 'GitHubAction',
                    'aws-region': 'us-east-1',
                },
            });
        }
        steps.push(...this.renderSynthCommands().map(cmd => ({
            run: cmd,
        })));
        steps.push({
            uses: 'actions/upload-artifact@v3',
            with: {
                name: 'cloud-assembly',
                path: `${this.app.cdkConfig.cdkout}/`,
            },
        });
        this.deploymentWorkflow.addJob('synth', {
            name: 'Synth CDK application',
            runsOn: ['ubuntu-latest'],
            env: {
                CI: 'true',
            },
            permissions: { idToken: workflows_model_1.JobPermission.WRITE, contents: workflows_model_1.JobPermission.READ },
            steps,
        });
    }
    createAssetUpload() {
        this.deploymentWorkflow.addJob('assetUpload', {
            name: 'Publish assets to AWS',
            needs: ['synth'],
            runsOn: ['ubuntu-latest'],
            env: {
                CI: 'true',
            },
            permissions: { idToken: workflows_model_1.JobPermission.WRITE, contents: this.needsVersionedArtifacts ? workflows_model_1.JobPermission.WRITE : workflows_model_1.JobPermission.READ },
            steps: [{
                    name: 'Checkout',
                    uses: 'actions/checkout@v3',
                    with: {
                        'fetch-depth': 0,
                    },
                }, {
                    name: 'Setup GIT identity',
                    run: 'git config --global user.name "github-actions" && git config --global user.email "github-actions@github.com"',
                }, {
                    name: 'AWS Credentials',
                    uses: 'aws-actions/configure-aws-credentials@master',
                    with: {
                        'role-to-assume': this.options.iamRoleArns?.assetPublishing ?? this.options.iamRoleArns?.default,
                        'role-session-name': 'GitHubAction',
                        'aws-region': 'us-east-1',
                    },
                }, {
                    uses: 'actions/download-artifact@v3',
                    with: {
                        name: 'cloud-assembly',
                        path: `${this.app.cdkConfig.cdkout}/`,
                    },
                },
                ...this.getAssetUploadCommands(this.needsVersionedArtifacts).map(cmd => ({
                    run: cmd,
                }))],
        });
    }
    createDeployment(stage) {
        if (stage.manualApproval === true) {
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
                runsOn: ['ubuntu-latest'],
                env: {
                    CI: 'true',
                },
                permissions: { idToken: workflows_model_1.JobPermission.WRITE, contents: workflows_model_1.JobPermission.READ },
                steps: [{
                        name: 'Checkout',
                        uses: 'actions/checkout@v3',
                    }, {
                        name: 'AWS Credentials',
                        uses: 'aws-actions/configure-aws-credentials@master',
                        with: {
                            'role-to-assume': this.options.iamRoleArns?.deployment?.[stage.name] ?? this.options.iamRoleArns?.default,
                            'role-session-name': 'GitHubAction',
                            'aws-region': stage.env.region,
                        },
                    },
                    ...this.renderInstallCommands().map(cmd => ({
                        run: cmd,
                    })),
                    ...this.renderInstallPackageCommands(`${this.options.pkgNamespace}/${this.app.name}@\${{github.event.inputs.version}}`).map(cmd => ({
                        run: cmd,
                    })),
                    {
                        run: `mv ./node_modules/${this.options.pkgNamespace}/${this.app.name} ${this.app.cdkConfig.cdkout}`,
                    },
                    ...this.renderDeployCommands(stage.name).map(cmd => ({
                        run: cmd,
                    }))],
            });
        }
        else {
            // Add deployment to CI/CD workflow
            this.deploymentWorkflow.addJob(`deploy-${stage.name}`, {
                name: `Deploy stage ${stage.name} to AWS`,
                needs: this.deploymentStages.length > 0 ? ['assetUpload', `deploy-${this.deploymentStages.at(-1)}`] : ['assetUpload'],
                runsOn: ['ubuntu-latest'],
                env: {
                    CI: 'true',
                },
                permissions: { idToken: workflows_model_1.JobPermission.WRITE, contents: workflows_model_1.JobPermission.READ },
                steps: [{
                        name: 'Checkout',
                        uses: 'actions/checkout@v3',
                    }, {
                        name: 'AWS Credentials',
                        uses: 'aws-actions/configure-aws-credentials@master',
                        with: {
                            'role-to-assume': this.options.iamRoleArns?.deployment?.[stage.name] ?? this.options.iamRoleArns?.default,
                            'role-session-name': 'GitHubAction',
                            'aws-region': stage.env.region,
                        },
                    }, {
                        uses: 'actions/download-artifact@v3',
                        with: {
                            name: 'cloud-assembly',
                            path: `${this.app.cdkConfig.cdkout}/`,
                        },
                    },
                    ...this.renderInstallCommands().map(cmd => ({
                        run: cmd,
                    })),
                    ...this.renderDeployCommands(stage.name).map(cmd => ({
                        run: cmd,
                    }))],
            });
            this.deploymentStages.push(stage.name);
        }
    }
}
exports.GithubCDKPipeline = GithubCDKPipeline;
_a = JSII_RTTI_SYMBOL_1;
GithubCDKPipeline[_a] = { fqn: "projen-pipelines.GithubCDKPipeline", version: "0.0.0" };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0aHViLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2F3c2Nkay9naXRodWIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFFQSx1RUFBMkU7QUFDM0UsaUNBQTBFO0FBYTFFLE1BQWEsaUJBQWtCLFNBQVEsa0JBQVc7SUFPaEQsWUFBWSxHQUErQixFQUFVLE9BQWlDO1FBQ3BGLEtBQUssQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFEK0IsWUFBTyxHQUFQLE9BQU8sQ0FBMEI7UUFGOUUscUJBQWdCLEdBQWEsRUFBRSxDQUFDO1FBS3RDLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU8sQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDakUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsQ0FBQztZQUN6QixJQUFJLEVBQUU7Z0JBQ0osUUFBUSxFQUFFLENBQUMsTUFBTSxDQUFDO2FBQ25CO1lBQ0QsZ0JBQWdCLEVBQUUsRUFBRTtTQUNyQixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsdUJBQXVCLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLGNBQWMsS0FBSyxJQUFJLENBQUMsS0FBSyxTQUFTLENBQUM7UUFFdEcsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBRW5CLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBRXpCLEtBQUssTUFBTSxLQUFLLElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRTtZQUNsQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDOUI7SUFDSCxDQUFDO0lBRU8sV0FBVztRQUNqQixNQUFNLEtBQUssR0FBYyxDQUFDO2dCQUN4QixJQUFJLEVBQUUsVUFBVTtnQkFDaEIsSUFBSSxFQUFFLHFCQUFxQjthQUM1QixDQUFD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QUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO3dCQUNuRCxHQUFHLEVBQUUsR0FBRztxQkFDVCxDQUFDLENBQUMsQ0FBQzthQUNMLENBQUMsQ0FBQztZQUNILElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ3hDO0lBQ0gsQ0FBQzs7QUFqTUgsOENBa01DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgYXdzY2RrIH0gZnJvbSAncHJvamVuJztcbmltcG9ydCB7IEdpdGh1YldvcmtmbG93IH0gZnJvbSAncHJvamVuL2xpYi9naXRodWInO1xuaW1wb3J0IHsgSm9iUGVybWlzc2lvbiwgSm9iU3RlcCB9IGZyb20gJ3Byb2plbi9saWIvZ2l0aHViL3dvcmtmbG93cy1tb2RlbCc7XG5pbXBvcnQgeyBDREtQaXBlbGluZSwgQ0RLUGlwZWxpbmVPcHRpb25zLCBEZXBsb3ltZW50U3RhZ2UgfSBmcm9tICcuL2Jhc2UnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEdpdGh1YklhbVJvbGVDb25maWcge1xuICByZWFkb25seSBkZWZhdWx0Pzogc3RyaW5nO1xuICByZWFkb25seSBzeW50aD86IHN0cmluZztcbiAgcmVhZG9ubHkgYXNzZXRQdWJsaXNoaW5nPzogc3RyaW5nO1xuICByZWFkb25seSBkZXBsb3ltZW50PzogeyBbc3RhZ2U6IHN0cmluZ106IHN0cmluZyB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEdpdGh1YkNES1BpcGVsaW5lT3B0aW9ucyBleHRlbmRzIENES1BpcGVsaW5lT3B0aW9ucyB7XG4gIHJlYWRvbmx5IGlhbVJvbGVBcm5zOiBHaXRodWJJYW1Sb2xlQ29uZmlnO1xufVxuXG5leHBvcnQgY2xhc3MgR2l0aHViQ0RLUGlwZWxpbmUgZXh0ZW5kcyBDREtQaXBlbGluZSB7XG5cbiAgcHVibGljIHJlYWRvbmx5IG5lZWRzVmVyc2lvbmVkQXJ0aWZhY3RzOiBib29sZWFuO1xuXG4gIHByaXZhdGUgZGVwbG95bWVudFdvcmtmbG93OiBHaXRodWJXb3JrZmxvdztcbiAgcHJpdmF0ZSBkZXBsb3ltZW50U3RhZ2VzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogYXdzY2RrLkF3c0Nka1R5cGVTY3JpcHRBcHAsIHByaXZhdGUgb3B0aW9uczogR2l0aHViQ0RLUGlwZWxpbmVPcHRpb25zKSB7XG4gICAgc3VwZXIoYXBwLCBvcHRpb25zKTtcblxuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93ID0gdGhpcy5hcHAuZ2l0aHViIS5hZGRXb3JrZmxvdygnZGVwbG95Jyk7XG4gICAgdGhpcy5kZXBsb3ltZW50V29ya2Zsb3cub24oe1xuICAgICAgcHVzaDoge1xuICAgICAgICBicmFuY2hlczogWydtYWluJ10sIC8vIFRPRE8gdXNlIGRlZmF1bHRSZWxlYXNlQnJhbmNoXG4gICAgICB9LFxuICAgICAgd29ya2Zsb3dEaXNwYXRjaDoge30sXG4gICAgfSk7XG5cbiAgICB0aGlzLm5lZWRzVmVyc2lvbmVkQXJ0aWZhY3RzID0gdGhpcy5vcHRpb25zLnN0YWdlcy5maW5kKHMgPT4gcy5tYW51YWxBcHByb3ZhbCA9PT0gdHJ1ZSkgIT09IHVuZGVmaW5lZDtcblxuICAgIHRoaXMuY3JlYXRlU3ludGgoKTtcblxuICAgIHRoaXMuY3JlYXRlQXNzZXRVcGxvYWQoKTtcblxuICAgIGZvciAoY29uc3Qgc3RhZ2Ugb2Ygb3B0aW9ucy5zdGFnZXMpIHtcbiAgICAgIHRoaXMuY3JlYXRlRGVwbG95bWVudChzdGFnZSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVTeW50aCgpOiB2b2lkIHtcbiAgICBjb25zdCBzdGVwczogSm9iU3RlcFtdID0gW3tcbiAgICAgIG5hbWU6ICdDaGVja291dCcsXG4gICAgICB1c2VzOiAnYWN0aW9ucy9jaGVja291dEB2MycsXG4gICAgfV07XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zPy5zeW50aCkge1xuICAgICAgc3RlcHMucHVzaCh7XG4gICAgICAgIG5hbWU6ICdBV1MgQ3JlZGVudGlhbHMnLFxuICAgICAgICB1c2VzOiAnYXdzLWFjdGlvbnMvY29uZmlndXJlLWF3cy1jcmVkZW50aWFsc0BtYXN0ZXInLFxuICAgICAgICB3aXRoOiB7XG4gICAgICAgICAgJ3JvbGUtdG8tYXNzdW1lJzogdGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zLnN5bnRoLFxuICAgICAgICAgICdyb2xlLXNlc3Npb24tbmFtZSc6ICdHaXRIdWJBY3Rpb24nLFxuICAgICAgICAgICdhd3MtcmVnaW9uJzogJ3VzLWVhc3QtMScsXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzdGVwcy5wdXNoKC4uLnRoaXMucmVuZGVyU3ludGhDb21tYW5kcygpLm1hcChjbWQgPT4gKHtcbiAgICAgIHJ1bjogY21kLFxuICAgIH0pKSk7XG5cbiAgICBzdGVwcy5wdXNoKHtcbiAgICAgIHVzZXM6ICdhY3Rpb25zL3VwbG9hZC1hcnRpZmFjdEB2MycsXG4gICAgICB3aXRoOiB7XG4gICAgICAgIG5hbWU6ICdjbG91ZC1hc3NlbWJseScsXG4gICAgICAgIHBhdGg6IGAke3RoaXMuYXBwLmNka0NvbmZpZy5jZGtvdXR9L2AsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgdGhpcy5kZXBsb3ltZW50V29ya2Zsb3cuYWRkSm9iKCdzeW50aCcsIHtcbiAgICAgIG5hbWU6ICdTeW50aCBDREsgYXBwbGljYXRpb24nLFxuICAgICAgcnVuc09uOiBbJ3VidW50dS1sYXRlc3QnXSxcbiAgICAgIGVudjoge1xuICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgfSxcbiAgICAgIHBlcm1pc3Npb25zOiB7IGlkVG9rZW46IEpvYlBlcm1pc3Npb24uV1JJVEUsIGNvbnRlbnRzOiBKb2JQZXJtaXNzaW9uLlJFQUQgfSxcbiAgICAgIHN0ZXBzLFxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZUFzc2V0VXBsb2FkKCk6IHZvaWQge1xuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93LmFkZEpvYignYXNzZXRVcGxvYWQnLCB7XG4gICAgICBuYW1lOiAnUHVibGlzaCBhc3NldHMgdG8gQVdTJyxcbiAgICAgIG5lZWRzOiBbJ3N5bnRoJ10sXG4gICAgICBydW5zT246IFsndWJ1bnR1LWxhdGVzdCddLFxuICAgICAgZW52OiB7XG4gICAgICAgIENJOiAndHJ1ZScsXG4gICAgICB9LFxuICAgICAgcGVybWlzc2lvbnM6IHsgaWRUb2tlbjogSm9iUGVybWlzc2lvbi5XUklURSwgY29udGVudHM6IHRoaXMubmVlZHNWZXJzaW9uZWRBcnRpZmFjdHMgPyBKb2JQZXJtaXNzaW9uLldSSVRFIDogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG4gICAgICBzdGVwczogW3tcbiAgICAgICAgbmFtZTogJ0NoZWNrb3V0JyxcbiAgICAgICAgdXNlczogJ2FjdGlvbnMvY2hlY2tvdXRAdjMnLFxuICAgICAgICB3aXRoOiB7XG4gICAgICAgICAgJ2ZldGNoLWRlcHRoJzogMCxcbiAgICAgICAgfSxcbiAgICAgIH0sIHtcbiAgICAgICAgbmFtZTogJ1NldHVwIEdJVCBpZGVudGl0eScsXG4gICAgICAgIHJ1bjogJ2dpdCBjb25maWcgLS1nbG9iYWwgdXNlci5uYW1lIFwiZ2l0aHViLWFjdGlvbnNcIiAmJiBnaXQgY29uZmlnIC0tZ2xvYmFsIHVzZXIuZW1haWwgXCJnaXRodWItYWN0aW9uc0BnaXRodWIuY29tXCInLFxuICAgICAgfSwge1xuICAgICAgICBuYW1lOiAnQVdTIENyZWRlbnRpYWxzJyxcbiAgICAgICAgdXNlczogJ2F3cy1hY3Rpb25zL2NvbmZpZ3VyZS1hd3MtY3JlZGVudGlhbHNAbWFzdGVyJyxcbiAgICAgICAgd2l0aDoge1xuICAgICAgICAgICdyb2xlLXRvLWFzc3VtZSc6IHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucz8uYXNzZXRQdWJsaXNoaW5nID8/IHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucz8uZGVmYXVsdCxcbiAgICAgICAgICAncm9sZS1zZXNzaW9uLW5hbWUnOiAnR2l0SHViQWN0aW9uJyxcbiAgICAgICAgICAnYXdzLXJlZ2lvbic6ICd1cy1lYXN0LTEnLFxuICAgICAgICB9LFxuICAgICAgfSwge1xuICAgICAgICB1c2VzOiAnYWN0aW9ucy9kb3dubG9hZC1hcnRpZmFjdEB2MycsXG4gICAgICAgIHdpdGg6IHtcbiAgICAgICAgICBuYW1lOiAnY2xvdWQtYXNzZW1ibHknLFxuICAgICAgICAgIHBhdGg6IGAke3RoaXMuYXBwLmNka0NvbmZpZy5jZGtvdXR9L2AsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgLi4udGhpcy5nZXRBc3NldFVwbG9hZENvbW1hbmRzKHRoaXMubmVlZHNWZXJzaW9uZWRBcnRpZmFjdHMpLm1hcChjbWQgPT4gKHtcbiAgICAgICAgcnVuOiBjbWQsXG4gICAgICB9KSldLFxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZURlcGxveW1lbnQoc3RhZ2U6IERlcGxveW1lbnRTdGFnZSk6IHZvaWQge1xuICAgIGlmIChzdGFnZS5tYW51YWxBcHByb3ZhbCA9PT0gdHJ1ZSkge1xuICAgICAgLy8gQ3JlYXRlIG5ldyB3b3JrZmxvdyBmb3IgZGVwbG95bWVudFxuICAgICAgY29uc3Qgc3RhZ2VXb3JrZmxvdyA9IHRoaXMuYXBwLmdpdGh1YiEuYWRkV29ya2Zsb3coYHJlbGVhc2UtJHtzdGFnZS5uYW1lfWApO1xuICAgICAgc3RhZ2VXb3JrZmxvdy5vbih7XG4gICAgICAgIHdvcmtmbG93RGlzcGF0Y2g6IHtcbiAgICAgICAgICBpbnB1dHM6IHtcbiAgICAgICAgICAgIHZlcnNpb246IHtcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdQYWNrYWdlIHZlcnNpb24nLFxuICAgICAgICAgICAgICByZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgc3RhZ2VXb3JrZmxvdy5hZGRKb2IoJ2RlcGxveScsIHtcbiAgICAgICAgbmFtZTogYFJlbGVhc2Ugc3RhZ2UgJHtzdGFnZS5uYW1lfSB0byBBV1NgLFxuICAgICAgICBydW5zT246IFsndWJ1bnR1LWxhdGVzdCddLFxuICAgICAgICBlbnY6IHtcbiAgICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICB9LFxuICAgICAgICBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG4gICAgICAgIHN0ZXBzOiBbe1xuICAgICAgICAgIG5hbWU6ICdDaGVja291dCcsXG4gICAgICAgICAgdXNlczogJ2FjdGlvbnMvY2hlY2tvdXRAdjMnLFxuICAgICAgICB9LCB7XG4gICAgICAgICAgbmFtZTogJ0FXUyBDcmVkZW50aWFscycsXG4gICAgICAgICAgdXNlczogJ2F3cy1hY3Rpb25zL2NvbmZpZ3VyZS1hd3MtY3JlZGVudGlhbHNAbWFzdGVyJyxcbiAgICAgICAgICB3aXRoOiB7XG4gICAgICAgICAgICAncm9sZS10by1hc3N1bWUnOiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LmRlcGxveW1lbnQ/LltzdGFnZS5uYW1lXSA/PyB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LmRlZmF1bHQsXG4gICAgICAgICAgICAncm9sZS1zZXNzaW9uLW5hbWUnOiAnR2l0SHViQWN0aW9uJyxcbiAgICAgICAgICAgICdhd3MtcmVnaW9uJzogc3RhZ2UuZW52LnJlZ2lvbixcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAuLi50aGlzLnJlbmRlckluc3RhbGxDb21tYW5kcygpLm1hcChjbWQgPT4gKHtcbiAgICAgICAgICBydW46IGNtZCxcbiAgICAgICAgfSkpLFxuICAgICAgICAuLi50aGlzLnJlbmRlckluc3RhbGxQYWNrYWdlQ29tbWFuZHMoYCR7dGhpcy5vcHRpb25zLnBrZ05hbWVzcGFjZX0vJHt0aGlzLmFwcC5uYW1lfUBcXCR7e2dpdGh1Yi5ldmVudC5pbnB1dHMudmVyc2lvbn19YCkubWFwKGNtZCA9PiAoe1xuICAgICAgICAgIHJ1bjogY21kLFxuICAgICAgICB9KSksXG4gICAgICAgIHtcbiAgICAgICAgICBydW46IGBtdiAuL25vZGVfbW9kdWxlcy8ke3RoaXMub3B0aW9ucy5wa2dOYW1lc3BhY2V9LyR7dGhpcy5hcHAubmFtZX0gJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fWAsXG4gICAgICAgIH0sXG4gICAgICAgIC4uLnRoaXMucmVuZGVyRGVwbG95Q29tbWFuZHMoc3RhZ2UubmFtZSkubWFwKGNtZCA9PiAoe1xuICAgICAgICAgIHJ1bjogY21kLFxuICAgICAgICB9KSldLFxuICAgICAgfSk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQWRkIGRlcGxveW1lbnQgdG8gQ0kvQ0Qgd29ya2Zsb3dcbiAgICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93LmFkZEpvYihgZGVwbG95LSR7c3RhZ2UubmFtZX1gLCB7XG4gICAgICAgIG5hbWU6IGBEZXBsb3kgc3RhZ2UgJHtzdGFnZS5uYW1lfSB0byBBV1NgLFxuICAgICAgICBuZWVkczogdGhpcy5kZXBsb3ltZW50U3RhZ2VzLmxlbmd0aCA+IDAgPyBbJ2Fzc2V0VXBsb2FkJywgYGRlcGxveS0ke3RoaXMuZGVwbG95bWVudFN0YWdlcy5hdCgtMSkhfWBdIDogWydhc3NldFVwbG9hZCddLFxuICAgICAgICBydW5zT246IFsndWJ1bnR1LWxhdGVzdCddLFxuICAgICAgICBlbnY6IHtcbiAgICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICB9LFxuICAgICAgICBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG4gICAgICAgIHN0ZXBzOiBbe1xuICAgICAgICAgIG5hbWU6ICdDaGVja291dCcsXG4gICAgICAgICAgdXNlczogJ2FjdGlvbnMvY2hlY2tvdXRAdjMnLFxuICAgICAgICB9LCB7XG4gICAgICAgICAgbmFtZTogJ0FXUyBDcmVkZW50aWFscycsXG4gICAgICAgICAgdXNlczogJ2F3cy1hY3Rpb25zL2NvbmZpZ3VyZS1hd3MtY3JlZGVudGlhbHNAbWFzdGVyJyxcbiAgICAgICAgICB3aXRoOiB7XG4gICAgICAgICAgICAncm9sZS10by1hc3N1bWUnOiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LmRlcGxveW1lbnQ/LltzdGFnZS5uYW1lXSA/PyB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LmRlZmF1bHQsXG4gICAgICAgICAgICAncm9sZS1zZXNzaW9uLW5hbWUnOiAnR2l0SHViQWN0aW9uJyxcbiAgICAgICAgICAgICdhd3MtcmVnaW9uJzogc3RhZ2UuZW52LnJlZ2lvbixcbiAgICAgICAgICB9LFxuICAgICAgICB9LCB7XG4gICAgICAgICAgdXNlczogJ2FjdGlvbnMvZG93bmxvYWQtYXJ0aWZhY3RAdjMnLFxuICAgICAgICAgIHdpdGg6IHtcbiAgICAgICAgICAgIG5hbWU6ICdjbG91ZC1hc3NlbWJseScsXG4gICAgICAgICAgICBwYXRoOiBgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fS9gLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIC4uLnRoaXMucmVuZGVySW5zdGFsbENvbW1hbmRzKCkubWFwKGNtZCA9PiAoe1xuICAgICAgICAgIHJ1bjogY21kLFxuICAgICAgICB9KSksXG4gICAgICAgIC4uLnRoaXMucmVuZGVyRGVwbG95Q29tbWFuZHMoc3RhZ2UubmFtZSkubWFwKGNtZCA9PiAoe1xuICAgICAgICAgIHJ1bjogY21kLFxuICAgICAgICB9KSldLFxuICAgICAgfSk7XG4gICAgICB0aGlzLmRlcGxveW1lbnRTdGFnZXMucHVzaChzdGFnZS5uYW1lKTtcbiAgICB9XG4gIH1cbn1cbiJdfQ==