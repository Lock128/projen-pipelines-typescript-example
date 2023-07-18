"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubEngine = void 0;
const workflows_model_1 = require("projen/lib/github/workflows-model");
const base_1 = require("./base");
class GitHubEngine extends base_1.BaseEngine {
    constructor(app, props, pipeline) {
        super(app, props, pipeline);
        this.deploymentStages = [];
        this.deploymentWorkflow = this.app.github.addWorkflow('deploy');
        this.deploymentWorkflow.on({
            push: {
                branches: ['main'], // TODO use defaultReleaseBranch
            },
            workflowDispatch: {},
        });
        this.needsVersionedArtifacts = this.props.stages.find(s => s.manualApproval === true) !== undefined;
    }
    createSynth(options) {
        var _a;
        const steps = [{
                name: 'Checkout',
                uses: 'actions/checkout@v3',
            }];
        if ((_a = this.props.githubConfig) === null || _a === void 0 ? void 0 : _a.awsRoleArnForSynth) {
            steps.push({
                name: 'AWS Credentials',
                // FIXME fix version for aws-credentials
                uses: 'aws-actions/configure-aws-credentials@master',
                with: {
                    'role-to-assume': this.props.githubConfig.awsRoleArnForSynth,
                    'role-session-name': 'GitHubAction',
                    'aws-region': 'us-east-1',
                },
            });
        }
        steps.push(...options.commands.map(cmd => ({
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
    createAssetUpload(options) {
        var _a, _b, _c;
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
                    run: 'git config --global user.name "projen pipeline" && git config --global user.email "info@taimos.de"',
                }, {
                    name: 'AWS Credentials',
                    uses: 'aws-actions/configure-aws-credentials@master',
                    with: {
                        'role-to-assume': (_b = (_a = this.props.githubConfig) === null || _a === void 0 ? void 0 : _a.awsRoleArnForAssetPublishing) !== null && _b !== void 0 ? _b : (_c = this.props.githubConfig) === null || _c === void 0 ? void 0 : _c.defaultAwsRoleArn,
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
                ...options.commands.map(cmd => ({
                    run: cmd,
                }))],
        });
    }
    createDeployment(options) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (options.config.manualApproval === true) {
            // Create new workflow for deployment
            const stageWorkflow = this.app.github.addWorkflow(`release-${options.config.name}`);
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
                name: `Release stage ${options.config.name} to AWS`,
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
                            'role-to-assume': (_c = (_b = (_a = this.props.githubConfig) === null || _a === void 0 ? void 0 : _a.awsRoleArnForDeployment) === null || _b === void 0 ? void 0 : _b[options.config.name]) !== null && _c !== void 0 ? _c : (_d = this.props.githubConfig) === null || _d === void 0 ? void 0 : _d.defaultAwsRoleArn,
                            'role-session-name': 'GitHubAction',
                            'aws-region': options.config.env.region,
                        },
                    },
                    ...options.installCommands.map(cmd => ({
                        run: cmd,
                    })),
                    {
                        run: `yarn add ${this.props.pkgNamespace}/${this.app.name}@\${{github.event.inputs.version}} && mv ./node_modules/${this.props.pkgNamespace}/${this.app.name} ${this.app.cdkConfig.cdkout}`,
                    },
                    ...options.deployCommands.map(cmd => ({
                        run: cmd,
                    }))],
            });
        }
        else {
            // Add deployment to CI/CD workflow
            this.deploymentWorkflow.addJob(`deploy-${options.config.name}`, {
                name: `Deploy stage ${options.config.name} to AWS`,
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
                            'role-to-assume': (_g = (_f = (_e = this.props.githubConfig) === null || _e === void 0 ? void 0 : _e.awsRoleArnForDeployment) === null || _f === void 0 ? void 0 : _f[options.config.name]) !== null && _g !== void 0 ? _g : (_h = this.props.githubConfig) === null || _h === void 0 ? void 0 : _h.defaultAwsRoleArn,
                            'role-session-name': 'GitHubAction',
                            'aws-region': options.config.env.region,
                        },
                    }, {
                        uses: 'actions/download-artifact@v3',
                        with: {
                            name: 'cloud-assembly',
                            path: `${this.app.cdkConfig.cdkout}/`,
                        },
                    },
                    ...options.installCommands.map(cmd => ({
                        run: cmd,
                    })),
                    ...options.deployCommands.map(cmd => ({
                        run: cmd,
                    }))],
            });
            this.deploymentStages.push(options.config.name);
        }
    }
}
exports.GitHubEngine = GitHubEngine;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0aHViLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2VuZ2luZS9naXRodWIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRUEsdUVBQTJFO0FBQzNFLGlDQUFvRztBQVVwRyxNQUFhLFlBQWEsU0FBUSxpQkFBVTtJQU8xQyxZQUFZLEdBQStCLEVBQUUsS0FBeUIsRUFBRSxRQUFxQjtRQUMzRixLQUFLLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztRQUh0QixxQkFBZ0IsR0FBYSxFQUFFLENBQUM7UUFLdEMsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNqRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsRUFBRSxDQUFDO1lBQ3pCLElBQUksRUFBRTtnQkFDSixRQUFRLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRSxnQ0FBZ0M7YUFDckQ7WUFDRCxnQkFBZ0IsRUFBRSxFQUFFO1NBQ3JCLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsY0FBYyxLQUFLLElBQUksQ0FBQyxLQUFLLFNBQVMsQ0FBQztJQUN0RyxDQUFDO0lBRU0sV0FBVyxDQUFDLE9BQTBCOztRQUMzQyxNQUFNLEtBQUssR0FBYyxDQUFDO2dCQUN4QixJQUFJLEVBQUUsVUFBVTtnQkFDaEIsSUFBSSxFQUFFLHFCQUFxQjthQUM1QixDQUFDLENBQUM7UUFFSCxJQUFJLE1BQUEsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLDBDQUFFLGtCQUFrQixFQUFFO1lBQy9DLEtBQUssQ0FBQyxJQUFJLENBQUM7Z0JBQ1QsSUFBSSxFQUFFLGlCQUFpQjtnQkFDdkIsd0NBQXdDO2dCQUN4QyxJQUFJLEVBQUUs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Q0Y7QUF4TEQsb0NBd0xDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgYXdzY2RrIH0gZnJvbSAncHJvamVuJztcbmltcG9ydCB7IEdpdGh1YldvcmtmbG93IH0gZnJvbSAncHJvamVuL2xpYi9naXRodWInO1xuaW1wb3J0IHsgSm9iUGVybWlzc2lvbiwgSm9iU3RlcCB9IGZyb20gJ3Byb2plbi9saWIvZ2l0aHViL3dvcmtmbG93cy1tb2RlbCc7XG5pbXBvcnQgeyBBc3NldFVwbG9hZFN0YWdlT3B0aW9ucywgQmFzZUVuZ2luZSwgRGVwbG95U3RhZ2VPcHRpb25zLCBTeW50aFN0YWdlT3B0aW9ucyB9IGZyb20gJy4vYmFzZSc7XG5pbXBvcnQgeyBDREtQaXBlbGluZSwgQ0RLUGlwZWxpbmVPcHRpb25zIH0gZnJvbSAnLi4vcGlwZWxpbmUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEdpdGh1YkVuZ2luZUNvbmZpZyB7XG4gIHJlYWRvbmx5IGRlZmF1bHRBd3NSb2xlQXJuPzogc3RyaW5nO1xuICByZWFkb25seSBhd3NSb2xlQXJuRm9yU3ludGg/OiBzdHJpbmc7XG4gIHJlYWRvbmx5IGF3c1JvbGVBcm5Gb3JBc3NldFB1Ymxpc2hpbmc/OiBzdHJpbmc7XG4gIHJlYWRvbmx5IGF3c1JvbGVBcm5Gb3JEZXBsb3ltZW50PzogeyBbc3RhZ2U6IHN0cmluZ106IHN0cmluZyB9O1xufVxuXG5leHBvcnQgY2xhc3MgR2l0SHViRW5naW5lIGV4dGVuZHMgQmFzZUVuZ2luZSB7XG5cbiAgcHVibGljIHJlYWRvbmx5IG5lZWRzVmVyc2lvbmVkQXJ0aWZhY3RzOiBib29sZWFuO1xuXG4gIHByaXZhdGUgZGVwbG95bWVudFdvcmtmbG93OiBHaXRodWJXb3JrZmxvdztcbiAgcHJpdmF0ZSBkZXBsb3ltZW50U3RhZ2VzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogYXdzY2RrLkF3c0Nka1R5cGVTY3JpcHRBcHAsIHByb3BzOiBDREtQaXBlbGluZU9wdGlvbnMsIHBpcGVsaW5lOiBDREtQaXBlbGluZSkge1xuICAgIHN1cGVyKGFwcCwgcHJvcHMsIHBpcGVsaW5lKTtcblxuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93ID0gdGhpcy5hcHAuZ2l0aHViIS5hZGRXb3JrZmxvdygnZGVwbG95Jyk7XG4gICAgdGhpcy5kZXBsb3ltZW50V29ya2Zsb3cub24oe1xuICAgICAgcHVzaDoge1xuICAgICAgICBicmFuY2hlczogWydtYWluJ10sIC8vIFRPRE8gdXNlIGRlZmF1bHRSZWxlYXNlQnJhbmNoXG4gICAgICB9LFxuICAgICAgd29ya2Zsb3dEaXNwYXRjaDoge30sXG4gICAgfSk7XG5cbiAgICB0aGlzLm5lZWRzVmVyc2lvbmVkQXJ0aWZhY3RzID0gdGhpcy5wcm9wcy5zdGFnZXMuZmluZChzID0+IHMubWFudWFsQXBwcm92YWwgPT09IHRydWUpICE9PSB1bmRlZmluZWQ7XG4gIH1cblxuICBwdWJsaWMgY3JlYXRlU3ludGgob3B0aW9uczogU3ludGhTdGFnZU9wdGlvbnMpOiB2b2lkIHtcbiAgICBjb25zdCBzdGVwczogSm9iU3RlcFtdID0gW3tcbiAgICAgIG5hbWU6ICdDaGVja291dCcsXG4gICAgICB1c2VzOiAnYWN0aW9ucy9jaGVja291dEB2MycsXG4gICAgfV07XG5cbiAgICBpZiAodGhpcy5wcm9wcy5naXRodWJDb25maWc/LmF3c1JvbGVBcm5Gb3JTeW50aCkge1xuICAgICAgc3RlcHMucHVzaCh7XG4gICAgICAgIG5hbWU6ICdBV1MgQ3JlZGVudGlhbHMnLFxuICAgICAgICAvLyBGSVhNRSBmaXggdmVyc2lvbiBmb3IgYXdzLWNyZWRlbnRpYWxzXG4gICAgICAgIHVzZXM6ICdhd3MtYWN0aW9ucy9jb25maWd1cmUtYXdzLWNyZWRlbnRpYWxzQG1hc3RlcicsXG4gICAgICAgIHdpdGg6IHtcbiAgICAgICAgICAncm9sZS10by1hc3N1bWUnOiB0aGlzLnByb3BzLmdpdGh1YkNvbmZpZy5hd3NSb2xlQXJuRm9yU3ludGgsXG4gICAgICAgICAgJ3JvbGUtc2Vzc2lvbi1uYW1lJzogJ0dpdEh1YkFjdGlvbicsXG4gICAgICAgICAgJ2F3cy1yZWdpb24nOiAndXMtZWFzdC0xJyxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHN0ZXBzLnB1c2goLi4ub3B0aW9ucy5jb21tYW5kcy5tYXAoY21kID0+ICh7XG4gICAgICBydW46IGNtZCxcbiAgICB9KSkpO1xuXG4gICAgc3RlcHMucHVzaCh7XG4gICAgICB1c2VzOiAnYWN0aW9ucy91cGxvYWQtYXJ0aWZhY3RAdjMnLFxuICAgICAgd2l0aDoge1xuICAgICAgICBuYW1lOiAnY2xvdWQtYXNzZW1ibHknLFxuICAgICAgICBwYXRoOiBgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fS9gLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93LmFkZEpvYignc3ludGgnLCB7XG4gICAgICBuYW1lOiAnU3ludGggQ0RLIGFwcGxpY2F0aW9uJyxcbiAgICAgIHJ1bnNPbjogWyd1YnVudHUtbGF0ZXN0J10sXG4gICAgICBlbnY6IHtcbiAgICAgICAgQ0k6ICd0cnVlJyxcbiAgICAgIH0sXG4gICAgICBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG4gICAgICBzdGVwcyxcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVBc3NldFVwbG9hZChvcHRpb25zOiBBc3NldFVwbG9hZFN0YWdlT3B0aW9ucyk6IHZvaWQge1xuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93LmFkZEpvYignYXNzZXRVcGxvYWQnLCB7XG4gICAgICBuYW1lOiAnUHVibGlzaCBhc3NldHMgdG8gQVdTJyxcbiAgICAgIG5lZWRzOiBbJ3N5bnRoJ10sXG4gICAgICBydW5zT246IFsndWJ1bnR1LWxhdGVzdCddLFxuICAgICAgZW52OiB7XG4gICAgICAgIENJOiAndHJ1ZScsXG4gICAgICB9LFxuICAgICAgcGVybWlzc2lvbnM6IHsgaWRUb2tlbjogSm9iUGVybWlzc2lvbi5XUklURSwgY29udGVudHM6IHRoaXMubmVlZHNWZXJzaW9uZWRBcnRpZmFjdHMgPyBKb2JQZXJtaXNzaW9uLldSSVRFIDogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG4gICAgICBzdGVwczogW3tcbiAgICAgICAgbmFtZTogJ0NoZWNrb3V0JyxcbiAgICAgICAgdXNlczogJ2FjdGlvbnMvY2hlY2tvdXRAdjMnLFxuICAgICAgICB3aXRoOiB7XG4gICAgICAgICAgJ2ZldGNoLWRlcHRoJzogMCxcbiAgICAgICAgfSxcbiAgICAgIH0sIHtcbiAgICAgICAgbmFtZTogJ1NldHVwIEdJVCBpZGVudGl0eScsXG4gICAgICAgIHJ1bjogJ2dpdCBjb25maWcgLS1nbG9iYWwgdXNlci5uYW1lIFwicHJvamVuIHBpcGVsaW5lXCIgJiYgZ2l0IGNvbmZpZyAtLWdsb2JhbCB1c2VyLmVtYWlsIFwiaW5mb0B0YWltb3MuZGVcIicsXG4gICAgICB9LCB7XG4gICAgICAgIG5hbWU6ICdBV1MgQ3JlZGVudGlhbHMnLFxuICAgICAgICB1c2VzOiAnYXdzLWFjdGlvbnMvY29uZmlndXJlLWF3cy1jcmVkZW50aWFsc0BtYXN0ZXInLFxuICAgICAgICB3aXRoOiB7XG4gICAgICAgICAgJ3JvbGUtdG8tYXNzdW1lJzogdGhpcy5wcm9wcy5naXRodWJDb25maWc/LmF3c1JvbGVBcm5Gb3JBc3NldFB1Ymxpc2hpbmcgPz8gdGhpcy5wcm9wcy5naXRodWJDb25maWc/LmRlZmF1bHRBd3NSb2xlQXJuLFxuICAgICAgICAgICdyb2xlLXNlc3Npb24tbmFtZSc6ICdHaXRIdWJBY3Rpb24nLFxuICAgICAgICAgICdhd3MtcmVnaW9uJzogJ3VzLWVhc3QtMScsXG4gICAgICAgIH0sXG4gICAgICB9LCB7XG4gICAgICAgIHVzZXM6ICdhY3Rpb25zL2Rvd25sb2FkLWFydGlmYWN0QHYzJyxcbiAgICAgICAgd2l0aDoge1xuICAgICAgICAgIG5hbWU6ICdjbG91ZC1hc3NlbWJseScsXG4gICAgICAgICAgcGF0aDogYCR7dGhpcy5hcHAuY2RrQ29uZmlnLmNka291dH0vYCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICAuLi5vcHRpb25zLmNvbW1hbmRzLm1hcChjbWQgPT4gKHtcbiAgICAgICAgcnVuOiBjbWQsXG4gICAgICB9KSldLFxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZURlcGxveW1lbnQob3B0aW9uczogRGVwbG95U3RhZ2VPcHRpb25zKTogdm9pZCB7XG4gICAgaWYgKG9wdGlvbnMuY29uZmlnLm1hbnVhbEFwcHJvdmFsID09PSB0cnVlKSB7XG4gICAgICAvLyBDcmVhdGUgbmV3IHdvcmtmbG93IGZvciBkZXBsb3ltZW50XG4gICAgICBjb25zdCBzdGFnZVdvcmtmbG93ID0gdGhpcy5hcHAuZ2l0aHViIS5hZGRXb3JrZmxvdyhgcmVsZWFzZS0ke29wdGlvbnMuY29uZmlnLm5hbWV9YCk7XG4gICAgICBzdGFnZVdvcmtmbG93Lm9uKHtcbiAgICAgICAgd29ya2Zsb3dEaXNwYXRjaDoge1xuICAgICAgICAgIGlucHV0czoge1xuICAgICAgICAgICAgdmVyc2lvbjoge1xuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1BhY2thZ2UgdmVyc2lvbicsXG4gICAgICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBzdGFnZVdvcmtmbG93LmFkZEpvYignZGVwbG95Jywge1xuICAgICAgICBuYW1lOiBgUmVsZWFzZSBzdGFnZSAke29wdGlvbnMuY29uZmlnLm5hbWV9IHRvIEFXU2AsXG4gICAgICAgIHJ1bnNPbjogWyd1YnVudHUtbGF0ZXN0J10sXG4gICAgICAgIGVudjoge1xuICAgICAgICAgIENJOiAndHJ1ZScsXG4gICAgICAgIH0sXG4gICAgICAgIHBlcm1pc3Npb25zOiB7IGlkVG9rZW46IEpvYlBlcm1pc3Npb24uV1JJVEUsIGNvbnRlbnRzOiBKb2JQZXJtaXNzaW9uLlJFQUQgfSxcbiAgICAgICAgc3RlcHM6IFt7XG4gICAgICAgICAgbmFtZTogJ0NoZWNrb3V0JyxcbiAgICAgICAgICB1c2VzOiAnYWN0aW9ucy9jaGVja291dEB2MycsXG4gICAgICAgIH0sIHtcbiAgICAgICAgICBuYW1lOiAnQVdTIENyZWRlbnRpYWxzJyxcbiAgICAgICAgICB1c2VzOiAnYXdzLWFjdGlvbnMvY29uZmlndXJlLWF3cy1jcmVkZW50aWFsc0BtYXN0ZXInLFxuICAgICAgICAgIHdpdGg6IHtcbiAgICAgICAgICAgICdyb2xlLXRvLWFzc3VtZSc6IHRoaXMucHJvcHMuZ2l0aHViQ29uZmlnPy5hd3NSb2xlQXJuRm9yRGVwbG95bWVudD8uW29wdGlvbnMuY29uZmlnLm5hbWVdID8/IHRoaXMucHJvcHMuZ2l0aHViQ29uZmlnPy5kZWZhdWx0QXdzUm9sZUFybixcbiAgICAgICAgICAgICdyb2xlLXNlc3Npb24tbmFtZSc6ICdHaXRIdWJBY3Rpb24nLFxuICAgICAgICAgICAgJ2F3cy1yZWdpb24nOiBvcHRpb25zLmNvbmZpZy5lbnYucmVnaW9uLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIC4uLm9wdGlvbnMuaW5zdGFsbENvbW1hbmRzLm1hcChjbWQgPT4gKHtcbiAgICAgICAgICBydW46IGNtZCxcbiAgICAgICAgfSkpLFxuICAgICAgICB7XG4gICAgICAgICAgcnVuOiBgeWFybiBhZGQgJHt0aGlzLnByb3BzLnBrZ05hbWVzcGFjZX0vJHt0aGlzLmFwcC5uYW1lfUBcXCR7e2dpdGh1Yi5ldmVudC5pbnB1dHMudmVyc2lvbn19ICYmIG12IC4vbm9kZV9tb2R1bGVzLyR7dGhpcy5wcm9wcy5wa2dOYW1lc3BhY2V9LyR7dGhpcy5hcHAubmFtZX0gJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fWAsXG4gICAgICAgIH0sXG4gICAgICAgIC4uLm9wdGlvbnMuZGVwbG95Q29tbWFuZHMubWFwKGNtZCA9PiAoe1xuICAgICAgICAgIHJ1bjogY21kLFxuICAgICAgICB9KSldLFxuICAgICAgfSk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQWRkIGRlcGxveW1lbnQgdG8gQ0kvQ0Qgd29ya2Zsb3dcbiAgICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93LmFkZEpvYihgZGVwbG95LSR7b3B0aW9ucy5jb25maWcubmFtZX1gLCB7XG4gICAgICAgIG5hbWU6IGBEZXBsb3kgc3RhZ2UgJHtvcHRpb25zLmNvbmZpZy5uYW1lfSB0byBBV1NgLFxuICAgICAgICBuZWVkczogdGhpcy5kZXBsb3ltZW50U3RhZ2VzLmxlbmd0aCA+IDAgPyBbJ2Fzc2V0VXBsb2FkJywgYGRlcGxveS0ke3RoaXMuZGVwbG95bWVudFN0YWdlcy5hdCgtMSkhfWBdIDogWydhc3NldFVwbG9hZCddLFxuICAgICAgICBydW5zT246IFsndWJ1bnR1LWxhdGVzdCddLFxuICAgICAgICBlbnY6IHtcbiAgICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICB9LFxuICAgICAgICBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG4gICAgICAgIHN0ZXBzOiBbe1xuICAgICAgICAgIG5hbWU6ICdDaGVja291dCcsXG4gICAgICAgICAgdXNlczogJ2FjdGlvbnMvY2hlY2tvdXRAdjMnLFxuICAgICAgICB9LCB7XG4gICAgICAgICAgbmFtZTogJ0FXUyBDcmVkZW50aWFscycsXG4gICAgICAgICAgdXNlczogJ2F3cy1hY3Rpb25zL2NvbmZpZ3VyZS1hd3MtY3JlZGVudGlhbHNAbWFzdGVyJyxcbiAgICAgICAgICB3aXRoOiB7XG4gICAgICAgICAgICAncm9sZS10by1hc3N1bWUnOiB0aGlzLnByb3BzLmdpdGh1YkNvbmZpZz8uYXdzUm9sZUFybkZvckRlcGxveW1lbnQ/LltvcHRpb25zLmNvbmZpZy5uYW1lXSA/PyB0aGlzLnByb3BzLmdpdGh1YkNvbmZpZz8uZGVmYXVsdEF3c1JvbGVBcm4sXG4gICAgICAgICAgICAncm9sZS1zZXNzaW9uLW5hbWUnOiAnR2l0SHViQWN0aW9uJyxcbiAgICAgICAgICAgICdhd3MtcmVnaW9uJzogb3B0aW9ucy5jb25maWcuZW52LnJlZ2lvbixcbiAgICAgICAgICB9LFxuICAgICAgICB9LCB7XG4gICAgICAgICAgdXNlczogJ2FjdGlvbnMvZG93bmxvYWQtYXJ0aWZhY3RAdjMnLFxuICAgICAgICAgIHdpdGg6IHtcbiAgICAgICAgICAgIG5hbWU6ICdjbG91ZC1hc3NlbWJseScsXG4gICAgICAgICAgICBwYXRoOiBgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fS9gLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIC4uLm9wdGlvbnMuaW5zdGFsbENvbW1hbmRzLm1hcChjbWQgPT4gKHtcbiAgICAgICAgICBydW46IGNtZCxcbiAgICAgICAgfSkpLFxuICAgICAgICAuLi5vcHRpb25zLmRlcGxveUNvbW1hbmRzLm1hcChjbWQgPT4gKHtcbiAgICAgICAgICBydW46IGNtZCxcbiAgICAgICAgfSkpXSxcbiAgICAgIH0pO1xuICAgICAgdGhpcy5kZXBsb3ltZW50U3RhZ2VzLnB1c2gob3B0aW9ucy5jb25maWcubmFtZSk7XG4gICAgfVxuICB9XG59Il19