"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeCatalystWorkflow = exports.CodeCatalystEngine = void 0;
const workflows_model_1 = require("projen/lib/github/workflows-model");
const base_1 = require("./base");
const codecatalyst_1 = require("./codecatalyst/codecatalyst");
const workflow_1 = require("./codecatalyst/workflow");
Object.defineProperty(exports, "CodeCatalystWorkflow", { enumerable: true, get: function () { return workflow_1.CodeCatalystWorkflow; } });
class CodeCatalystEngine extends base_1.BaseEngine {
    constructor(app, props, pipeline) {
        super(app, props, pipeline);
        this.deploymentStages = [];
        //app._addComponent(codecatalyst)
        // this.deploymentWorkflow = this.app.github!.addWorkflow('deploy');
        this.codecatalyst = new codecatalyst_1.CodeCatalyst();
        this.deploymentWorkflow = new workflow_1.CodeCatalystWorkflow(this.codecatalyst, 'workflow');
        console.log('Executing CodeCatalystEngine');
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
            const stageWorkflow = this.codecatalyst.addWorkflow(`release-${options.config.name}`);
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
exports.CodeCatalystEngine = CodeCatalystEngine;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29kZWNhdGFseXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2VuZ2luZS9jb2RlY2F0YWx5c3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsdUVBQTJFO0FBQzNFLGlDQUFvRztBQUNwRyw4REFBMkQ7QUFDM0Qsc0RBQStEO0FBME10RCxxR0ExTUEsK0JBQW9CLE9BME1BO0FBaE03QixNQUFhLGtCQUFtQixTQUFRLGlCQUFVO0lBUWhELFlBQVksR0FBK0IsRUFBRSxLQUF5QixFQUFFLFFBQXFCO1FBQzNGLEtBQUssQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBSnRCLHFCQUFnQixHQUFhLEVBQUUsQ0FBQztRQU10QyxpQ0FBaUM7UUFFakMsb0VBQW9FO1FBQ3BFLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSwyQkFBWSxFQUFFLENBQUM7UUFDdkMsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksK0JBQW9CLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNsRixPQUFPLENBQUMsR0FBRyxDQUFDLDhCQUE4QixDQUFDLENBQUM7UUFFNUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsQ0FBQztZQUN6QixJQUFJLEVBQUU7Z0JBQ0osUUFBUSxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsZ0NBQWdDO2FBQ3JEO1lBQ0QsZ0JBQWdCLEVBQUUsRUFBRTtTQUNyQixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsdUJBQXVCLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLGNBQWMsS0FBSyxJQUFJLENBQUMsS0FBSyxTQUFTLENBQUM7SUFDdEcsQ0FBQztJQUVNLFdBQVcsQ0FBQyxPQUEwQjs7UUFDM0MsTUFBTSxLQUFLLEdBQWMsQ0FBQztnQkFDeEIsSUFBSSxFQUFFLFVB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QUFDLENBQUM7d0JBQ3BDLEdBQUcsRUFBRSxHQUFHO3FCQUNULENBQUMsQ0FBQyxDQUFDO2FBQ0wsQ0FBQyxDQUFDO1lBQ0gsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ2pEO0lBQ0gsQ0FBQztDQUNGO0FBOUxELGdEQThMQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGF3c2NkayB9IGZyb20gJ3Byb2plbic7XG5pbXBvcnQgeyBKb2JQZXJtaXNzaW9uLCBKb2JTdGVwIH0gZnJvbSAncHJvamVuL2xpYi9naXRodWIvd29ya2Zsb3dzLW1vZGVsJztcbmltcG9ydCB7IEFzc2V0VXBsb2FkU3RhZ2VPcHRpb25zLCBCYXNlRW5naW5lLCBEZXBsb3lTdGFnZU9wdGlvbnMsIFN5bnRoU3RhZ2VPcHRpb25zIH0gZnJvbSAnLi9iYXNlJztcbmltcG9ydCB7IENvZGVDYXRhbHlzdCB9IGZyb20gJy4vY29kZWNhdGFseXN0L2NvZGVjYXRhbHlzdCc7XG5pbXBvcnQgeyBDb2RlQ2F0YWx5c3RXb3JrZmxvdyB9IGZyb20gJy4vY29kZWNhdGFseXN0L3dvcmtmbG93JztcbmltcG9ydCB7IENES1BpcGVsaW5lLCBDREtQaXBlbGluZU9wdGlvbnMgfSBmcm9tICcuLi9waXBlbGluZSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29kZUNhdGFseXN0RW5naW5lQ29uZmlnIHtcbiAgcmVhZG9ubHkgZGVmYXVsdEF3c1JvbGVBcm4/OiBzdHJpbmc7XG4gIHJlYWRvbmx5IGF3c1JvbGVBcm5Gb3JTeW50aD86IHN0cmluZztcbiAgcmVhZG9ubHkgYXdzUm9sZUFybkZvckFzc2V0UHVibGlzaGluZz86IHN0cmluZztcbiAgcmVhZG9ubHkgYXdzUm9sZUFybkZvckRlcGxveW1lbnQ/OiB7IFtzdGFnZTogc3RyaW5nXTogc3RyaW5nIH07XG59XG5cbmV4cG9ydCBjbGFzcyBDb2RlQ2F0YWx5c3RFbmdpbmUgZXh0ZW5kcyBCYXNlRW5naW5lIHtcblxuICBwdWJsaWMgcmVhZG9ubHkgbmVlZHNWZXJzaW9uZWRBcnRpZmFjdHM6IGJvb2xlYW47XG5cbiAgcHJpdmF0ZSBkZXBsb3ltZW50V29ya2Zsb3c6IENvZGVDYXRhbHlzdFdvcmtmbG93O1xuICBwcml2YXRlIGRlcGxveW1lbnRTdGFnZXM6IHN0cmluZ1tdID0gW107XG4gIHB1YmxpYyByZWFkb25seSBjb2RlY2F0YWx5c3Q6IENvZGVDYXRhbHlzdCB8IHVuZGVmaW5lZDtcblxuICBjb25zdHJ1Y3RvcihhcHA6IGF3c2Nkay5Bd3NDZGtUeXBlU2NyaXB0QXBwLCBwcm9wczogQ0RLUGlwZWxpbmVPcHRpb25zLCBwaXBlbGluZTogQ0RLUGlwZWxpbmUpIHtcbiAgICBzdXBlcihhcHAsIHByb3BzLCBwaXBlbGluZSk7XG5cbiAgICAvL2FwcC5fYWRkQ29tcG9uZW50KGNvZGVjYXRhbHlzdClcblxuICAgIC8vIHRoaXMuZGVwbG95bWVudFdvcmtmbG93ID0gdGhpcy5hcHAuZ2l0aHViIS5hZGRXb3JrZmxvdygnZGVwbG95Jyk7XG4gICAgdGhpcy5jb2RlY2F0YWx5c3QgPSBuZXcgQ29kZUNhdGFseXN0KCk7XG4gICAgdGhpcy5kZXBsb3ltZW50V29ya2Zsb3cgPSBuZXcgQ29kZUNhdGFseXN0V29ya2Zsb3codGhpcy5jb2RlY2F0YWx5c3QsICd3b3JrZmxvdycpO1xuICAgIGNvbnNvbGUubG9nKCdFeGVjdXRpbmcgQ29kZUNhdGFseXN0RW5naW5lJyk7XG5cbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvdy5vbih7XG4gICAgICBwdXNoOiB7XG4gICAgICAgIGJyYW5jaGVzOiBbJ21haW4nXSwgLy8gVE9ETyB1c2UgZGVmYXVsdFJlbGVhc2VCcmFuY2hcbiAgICAgIH0sXG4gICAgICB3b3JrZmxvd0Rpc3BhdGNoOiB7fSxcbiAgICB9KTtcblxuICAgIHRoaXMubmVlZHNWZXJzaW9uZWRBcnRpZmFjdHMgPSB0aGlzLnByb3BzLnN0YWdlcy5maW5kKHMgPT4gcy5tYW51YWxBcHByb3ZhbCA9PT0gdHJ1ZSkgIT09IHVuZGVmaW5lZDtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVTeW50aChvcHRpb25zOiBTeW50aFN0YWdlT3B0aW9ucyk6IHZvaWQge1xuICAgIGNvbnN0IHN0ZXBzOiBKb2JTdGVwW10gPSBbe1xuICAgICAgbmFtZTogJ0NoZWNrb3V0JyxcbiAgICAgIHVzZXM6ICdhY3Rpb25zL2NoZWNrb3V0QHYzJyxcbiAgICB9XTtcblxuICAgIGlmICh0aGlzLnByb3BzLmdpdGh1YkNvbmZpZz8uYXdzUm9sZUFybkZvclN5bnRoKSB7XG4gICAgICBzdGVwcy5wdXNoKHtcbiAgICAgICAgbmFtZTogJ0FXUyBDcmVkZW50aWFscycsXG4gICAgICAgIHVzZXM6ICdhd3MtYWN0aW9ucy9jb25maWd1cmUtYXdzLWNyZWRlbnRpYWxzQG1hc3RlcicsXG4gICAgICAgIHdpdGg6IHtcbiAgICAgICAgICAncm9sZS10by1hc3N1bWUnOiB0aGlzLnByb3BzLmdpdGh1YkNvbmZpZy5hd3NSb2xlQXJuRm9yU3ludGgsXG4gICAgICAgICAgJ3JvbGUtc2Vzc2lvbi1uYW1lJzogJ0dpdEh1YkFjdGlvbicsXG4gICAgICAgICAgJ2F3cy1yZWdpb24nOiAndXMtZWFzdC0xJyxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHN0ZXBzLnB1c2goLi4ub3B0aW9ucy5jb21tYW5kcy5tYXAoY21kID0+ICh7XG4gICAgICBydW46IGNtZCxcbiAgICB9KSkpO1xuXG4gICAgc3RlcHMucHVzaCh7XG4gICAgICB1c2VzOiAnYWN0aW9ucy91cGxvYWQtYXJ0aWZhY3RAdjMnLFxuICAgICAgd2l0aDoge1xuICAgICAgICBuYW1lOiAnY2xvdWQtYXNzZW1ibHknLFxuICAgICAgICBwYXRoOiBgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fS9gLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93LmFkZEpvYignc3ludGgnLCB7XG4gICAgICBuYW1lOiAnU3ludGggQ0RLIGFwcGxpY2F0aW9uJyxcbiAgICAgIHJ1bnNPbjogWyd1YnVudHUtbGF0ZXN0J10sXG4gICAgICBlbnY6IHtcbiAgICAgICAgQ0k6ICd0cnVlJyxcbiAgICAgIH0sXG4gICAgICBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG4gICAgICBzdGVwcyxcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVBc3NldFVwbG9hZChvcHRpb25zOiBBc3NldFVwbG9hZFN0YWdlT3B0aW9ucyk6IHZvaWQge1xuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93LmFkZEpvYignYXNzZXRVcGxvYWQnLCB7XG4gICAgICBuYW1lOiAnUHVibGlzaCBhc3NldHMgdG8gQVdTJyxcbiAgICAgIG5lZWRzOiBbJ3N5bnRoJ10sXG4gICAgICBydW5zT246IFsndWJ1bnR1LWxhdGVzdCddLFxuICAgICAgZW52OiB7XG4gICAgICAgIENJOiAndHJ1ZScsXG4gICAgICB9LFxuICAgICAgcGVybWlzc2lvbnM6IHsgaWRUb2tlbjogSm9iUGVybWlzc2lvbi5XUklURSwgY29udGVudHM6IHRoaXMubmVlZHNWZXJzaW9uZWRBcnRpZmFjdHMgPyBKb2JQZXJtaXNzaW9uLldSSVRFIDogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG4gICAgICBzdGVwczogW3tcbiAgICAgICAgbmFtZTogJ0NoZWNrb3V0JyxcbiAgICAgICAgdXNlczogJ2FjdGlvbnMvY2hlY2tvdXRAdjMnLFxuICAgICAgICB3aXRoOiB7XG4gICAgICAgICAgJ2ZldGNoLWRlcHRoJzogMCxcbiAgICAgICAgfSxcbiAgICAgIH0sIHtcbiAgICAgICAgbmFtZTogJ1NldHVwIEdJVCBpZGVudGl0eScsXG4gICAgICAgIHJ1bjogJ2dpdCBjb25maWcgLS1nbG9iYWwgdXNlci5uYW1lIFwicHJvamVuIHBpcGVsaW5lXCIgJiYgZ2l0IGNvbmZpZyAtLWdsb2JhbCB1c2VyLmVtYWlsIFwiaW5mb0B0YWltb3MuZGVcIicsXG4gICAgICB9LCB7XG4gICAgICAgIG5hbWU6ICdBV1MgQ3JlZGVudGlhbHMnLFxuICAgICAgICB1c2VzOiAnYXdzLWFjdGlvbnMvY29uZmlndXJlLWF3cy1jcmVkZW50aWFsc0BtYXN0ZXInLFxuICAgICAgICB3aXRoOiB7XG4gICAgICAgICAgJ3JvbGUtdG8tYXNzdW1lJzogdGhpcy5wcm9wcy5naXRodWJDb25maWc/LmF3c1JvbGVBcm5Gb3JBc3NldFB1Ymxpc2hpbmcgPz8gdGhpcy5wcm9wcy5naXRodWJDb25maWc/LmRlZmF1bHRBd3NSb2xlQXJuLFxuICAgICAgICAgICdyb2xlLXNlc3Npb24tbmFtZSc6ICdHaXRIdWJBY3Rpb24nLFxuICAgICAgICAgICdhd3MtcmVnaW9uJzogJ3VzLWVhc3QtMScsXG4gICAgICAgIH0sXG4gICAgICB9LCB7XG4gICAgICAgIHVzZXM6ICdhY3Rpb25zL2Rvd25sb2FkLWFydGlmYWN0QHYzJyxcbiAgICAgICAgd2l0aDoge1xuICAgICAgICAgIG5hbWU6ICdjbG91ZC1hc3NlbWJseScsXG4gICAgICAgICAgcGF0aDogYCR7dGhpcy5hcHAuY2RrQ29uZmlnLmNka291dH0vYCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICAuLi5vcHRpb25zLmNvbW1hbmRzLm1hcChjbWQgPT4gKHtcbiAgICAgICAgcnVuOiBjbWQsXG4gICAgICB9KSldLFxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZURlcGxveW1lbnQob3B0aW9uczogRGVwbG95U3RhZ2VPcHRpb25zKTogdm9pZCB7XG4gICAgaWYgKG9wdGlvbnMuY29uZmlnLm1hbnVhbEFwcHJvdmFsID09PSB0cnVlKSB7XG4gICAgICAvLyBDcmVhdGUgbmV3IHdvcmtmbG93IGZvciBkZXBsb3ltZW50XG4gICAgICBjb25zdCBzdGFnZVdvcmtmbG93ID0gdGhpcy5jb2RlY2F0YWx5c3QhLmFkZFdvcmtmbG93KGByZWxlYXNlLSR7b3B0aW9ucy5jb25maWcubmFtZX1gKTtcbiAgICAgIHN0YWdlV29ya2Zsb3cub24oe1xuICAgICAgICB3b3JrZmxvd0Rpc3BhdGNoOiB7XG4gICAgICAgICAgaW5wdXRzOiB7XG4gICAgICAgICAgICB2ZXJzaW9uOiB7XG4gICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUGFja2FnZSB2ZXJzaW9uJyxcbiAgICAgICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIHN0YWdlV29ya2Zsb3cuYWRkSm9iKCdkZXBsb3knLCB7XG4gICAgICAgIG5hbWU6IGBSZWxlYXNlIHN0YWdlICR7b3B0aW9ucy5jb25maWcubmFtZX0gdG8gQVdTYCxcbiAgICAgICAgcnVuc09uOiBbJ3VidW50dS1sYXRlc3QnXSxcbiAgICAgICAgZW52OiB7XG4gICAgICAgICAgQ0k6ICd0cnVlJyxcbiAgICAgICAgfSxcbiAgICAgICAgcGVybWlzc2lvbnM6IHsgaWRUb2tlbjogSm9iUGVybWlzc2lvbi5XUklURSwgY29udGVudHM6IEpvYlBlcm1pc3Npb24uUkVBRCB9LFxuICAgICAgICBzdGVwczogW3tcbiAgICAgICAgICBuYW1lOiAnQ2hlY2tvdXQnLFxuICAgICAgICAgIHVzZXM6ICdhY3Rpb25zL2NoZWNrb3V0QHYzJyxcbiAgICAgICAgfSwge1xuICAgICAgICAgIG5hbWU6ICdBV1MgQ3JlZGVudGlhbHMnLFxuICAgICAgICAgIHVzZXM6ICdhd3MtYWN0aW9ucy9jb25maWd1cmUtYXdzLWNyZWRlbnRpYWxzQG1hc3RlcicsXG4gICAgICAgICAgd2l0aDoge1xuICAgICAgICAgICAgJ3JvbGUtdG8tYXNzdW1lJzogdGhpcy5wcm9wcy5naXRodWJDb25maWc/LmF3c1JvbGVBcm5Gb3JEZXBsb3ltZW50Py5bb3B0aW9ucy5jb25maWcubmFtZV0gPz8gdGhpcy5wcm9wcy5naXRodWJDb25maWc/LmRlZmF1bHRBd3NSb2xlQXJuLFxuICAgICAgICAgICAgJ3JvbGUtc2Vzc2lvbi1uYW1lJzogJ0dpdEh1YkFjdGlvbicsXG4gICAgICAgICAgICAnYXdzLXJlZ2lvbic6IG9wdGlvbnMuY29uZmlnLmVudi5yZWdpb24sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgLi4ub3B0aW9ucy5pbnN0YWxsQ29tbWFuZHMubWFwKGNtZCA9PiAoe1xuICAgICAgICAgIHJ1bjogY21kLFxuICAgICAgICB9KSksXG4gICAgICAgIHtcbiAgICAgICAgICBydW46IGB5YXJuIGFkZCAke3RoaXMucHJvcHMucGtnTmFtZXNwYWNlfS8ke3RoaXMuYXBwLm5hbWV9QFxcJHt7Z2l0aHViLmV2ZW50LmlucHV0cy52ZXJzaW9ufX0gJiYgbXYgLi9ub2RlX21vZHVsZXMvJHt0aGlzLnByb3BzLnBrZ05hbWVzcGFjZX0vJHt0aGlzLmFwcC5uYW1lfSAke3RoaXMuYXBwLmNka0NvbmZpZy5jZGtvdXR9YCxcbiAgICAgICAgfSxcbiAgICAgICAgLi4ub3B0aW9ucy5kZXBsb3lDb21tYW5kcy5tYXAoY21kID0+ICh7XG4gICAgICAgICAgcnVuOiBjbWQsXG4gICAgICAgIH0pKV0sXG4gICAgICB9KTtcblxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBBZGQgZGVwbG95bWVudCB0byBDSS9DRCB3b3JrZmxvd1xuICAgICAgdGhpcy5kZXBsb3ltZW50V29ya2Zsb3cuYWRkSm9iKGBkZXBsb3ktJHtvcHRpb25zLmNvbmZpZy5uYW1lfWAsIHtcbiAgICAgICAgbmFtZTogYERlcGxveSBzdGFnZSAke29wdGlvbnMuY29uZmlnLm5hbWV9IHRvIEFXU2AsXG4gICAgICAgIG5lZWRzOiB0aGlzLmRlcGxveW1lbnRTdGFnZXMubGVuZ3RoID4gMCA/IFsnYXNzZXRVcGxvYWQnLCBgZGVwbG95LSR7dGhpcy5kZXBsb3ltZW50U3RhZ2VzLmF0KC0xKSF9YF0gOiBbJ2Fzc2V0VXBsb2FkJ10sXG4gICAgICAgIHJ1bnNPbjogWyd1YnVudHUtbGF0ZXN0J10sXG4gICAgICAgIGVudjoge1xuICAgICAgICAgIENJOiAndHJ1ZScsXG4gICAgICAgIH0sXG4gICAgICAgIHBlcm1pc3Npb25zOiB7IGlkVG9rZW46IEpvYlBlcm1pc3Npb24uV1JJVEUsIGNvbnRlbnRzOiBKb2JQZXJtaXNzaW9uLlJFQUQgfSxcbiAgICAgICAgc3RlcHM6IFt7XG4gICAgICAgICAgbmFtZTogJ0NoZWNrb3V0JyxcbiAgICAgICAgICB1c2VzOiAnYWN0aW9ucy9jaGVja291dEB2MycsXG4gICAgICAgIH0sIHtcbiAgICAgICAgICBuYW1lOiAnQVdTIENyZWRlbnRpYWxzJyxcbiAgICAgICAgICB1c2VzOiAnYXdzLWFjdGlvbnMvY29uZmlndXJlLWF3cy1jcmVkZW50aWFsc0BtYXN0ZXInLFxuICAgICAgICAgIHdpdGg6IHtcbiAgICAgICAgICAgICdyb2xlLXRvLWFzc3VtZSc6IHRoaXMucHJvcHMuZ2l0aHViQ29uZmlnPy5hd3NSb2xlQXJuRm9yRGVwbG95bWVudD8uW29wdGlvbnMuY29uZmlnLm5hbWVdID8/IHRoaXMucHJvcHMuZ2l0aHViQ29uZmlnPy5kZWZhdWx0QXdzUm9sZUFybixcbiAgICAgICAgICAgICdyb2xlLXNlc3Npb24tbmFtZSc6ICdHaXRIdWJBY3Rpb24nLFxuICAgICAgICAgICAgJ2F3cy1yZWdpb24nOiBvcHRpb25zLmNvbmZpZy5lbnYucmVnaW9uLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sIHtcbiAgICAgICAgICB1c2VzOiAnYWN0aW9ucy9kb3dubG9hZC1hcnRpZmFjdEB2MycsXG4gICAgICAgICAgd2l0aDoge1xuICAgICAgICAgICAgbmFtZTogJ2Nsb3VkLWFzc2VtYmx5JyxcbiAgICAgICAgICAgIHBhdGg6IGAke3RoaXMuYXBwLmNka0NvbmZpZy5jZGtvdXR9L2AsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgLi4ub3B0aW9ucy5pbnN0YWxsQ29tbWFuZHMubWFwKGNtZCA9PiAoe1xuICAgICAgICAgIHJ1bjogY21kLFxuICAgICAgICB9KSksXG4gICAgICAgIC4uLm9wdGlvbnMuZGVwbG95Q29tbWFuZHMubWFwKGNtZCA9PiAoe1xuICAgICAgICAgIHJ1bjogY21kLFxuICAgICAgICB9KSldLFxuICAgICAgfSk7XG4gICAgICB0aGlzLmRlcGxveW1lbnRTdGFnZXMucHVzaChvcHRpb25zLmNvbmZpZy5uYW1lKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IHsgQ29kZUNhdGFseXN0V29ya2Zsb3cgfTtcbiJdfQ==