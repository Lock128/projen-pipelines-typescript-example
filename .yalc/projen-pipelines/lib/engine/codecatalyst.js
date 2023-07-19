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
        // this.deploymentWorkflow = this.app.github!.addWorkflow('deploy');
        this.codecatalyst = new codecatalyst_1.CodeCatalyst(app);
        this.deploymentWorkflow = new workflow_1.CodeCatalystWorkflow(this.codecatalyst, 'workflow');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29kZWNhdGFseXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2VuZ2luZS9jb2RlY2F0YWx5c3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsdUVBQTJFO0FBQzNFLGlDQUFvRztBQUNwRyw4REFBMkQ7QUFDM0Qsc0RBQStEO0FBdU10RCxxR0F2TUEsK0JBQW9CLE9BdU1BO0FBN0w3QixNQUFhLGtCQUFtQixTQUFRLGlCQUFVO0lBUWhELFlBQVksR0FBK0IsRUFBRSxLQUF5QixFQUFFLFFBQXFCO1FBQzNGLEtBQUssQ0FBQyxHQUFHLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBSnRCLHFCQUFnQixHQUFhLEVBQUUsQ0FBQztRQUt0QyxvRUFBb0U7UUFDcEUsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLDJCQUFZLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDMUMsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksK0JBQW9CLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxVQUFVLENBQUMsQ0FBQztRQUVsRixJQUFJLENBQUMsa0JBQWtCLENBQUMsRUFBRSxDQUFDO1lBQ3pCLElBQUksRUFBRTtnQkFDSixRQUFRLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRSxnQ0FBZ0M7YUFDckQ7WUFDRCxnQkFBZ0IsRUFBRSxFQUFFO1NBQ3JCLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsY0FBYyxLQUFLLElBQUksQ0FBQyxLQUFLLFNBQVMsQ0FBQztJQUN0RyxDQUFDO0lBRU0sV0FBVyxDQUFDLE9BQTBCOztRQUMzQyxNQUFNLEtBQUssR0FBYyxDQUFDO2dCQUN4QixJQUFJLEVBQUUsVUFBVTtnQkFDaEIsSUFBSSxFQUFFLHFCQUFxQjthQUM1QixDQUFDLENBQUM7UUFF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LENBQUM7YUFDTCxDQUFDLENBQUM7WUFDSCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDakQ7SUFDSCxDQUFDO0NBQ0Y7QUEzTEQsZ0RBMkxDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgYXdzY2RrIH0gZnJvbSAncHJvamVuJztcbmltcG9ydCB7IEpvYlBlcm1pc3Npb24sIEpvYlN0ZXAgfSBmcm9tICdwcm9qZW4vbGliL2dpdGh1Yi93b3JrZmxvd3MtbW9kZWwnO1xuaW1wb3J0IHsgQXNzZXRVcGxvYWRTdGFnZU9wdGlvbnMsIEJhc2VFbmdpbmUsIERlcGxveVN0YWdlT3B0aW9ucywgU3ludGhTdGFnZU9wdGlvbnMgfSBmcm9tICcuL2Jhc2UnO1xuaW1wb3J0IHsgQ29kZUNhdGFseXN0IH0gZnJvbSAnLi9jb2RlY2F0YWx5c3QvY29kZWNhdGFseXN0JztcbmltcG9ydCB7IENvZGVDYXRhbHlzdFdvcmtmbG93IH0gZnJvbSAnLi9jb2RlY2F0YWx5c3Qvd29ya2Zsb3cnO1xuaW1wb3J0IHsgQ0RLUGlwZWxpbmUsIENES1BpcGVsaW5lT3B0aW9ucyB9IGZyb20gJy4uL3BpcGVsaW5lJztcblxuZXhwb3J0IGludGVyZmFjZSBDb2RlQ2F0YWx5c3RFbmdpbmVDb25maWcge1xuICByZWFkb25seSBkZWZhdWx0QXdzUm9sZUFybj86IHN0cmluZztcbiAgcmVhZG9ubHkgYXdzUm9sZUFybkZvclN5bnRoPzogc3RyaW5nO1xuICByZWFkb25seSBhd3NSb2xlQXJuRm9yQXNzZXRQdWJsaXNoaW5nPzogc3RyaW5nO1xuICByZWFkb25seSBhd3NSb2xlQXJuRm9yRGVwbG95bWVudD86IHsgW3N0YWdlOiBzdHJpbmddOiBzdHJpbmcgfTtcbn1cblxuZXhwb3J0IGNsYXNzIENvZGVDYXRhbHlzdEVuZ2luZSBleHRlbmRzIEJhc2VFbmdpbmUge1xuXG4gIHB1YmxpYyByZWFkb25seSBuZWVkc1ZlcnNpb25lZEFydGlmYWN0czogYm9vbGVhbjtcblxuICBwcml2YXRlIGRlcGxveW1lbnRXb3JrZmxvdzogQ29kZUNhdGFseXN0V29ya2Zsb3c7XG4gIHByaXZhdGUgZGVwbG95bWVudFN0YWdlczogc3RyaW5nW10gPSBbXTtcbiAgcHVibGljIHJlYWRvbmx5IGNvZGVjYXRhbHlzdDogQ29kZUNhdGFseXN0IHwgdW5kZWZpbmVkO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogYXdzY2RrLkF3c0Nka1R5cGVTY3JpcHRBcHAsIHByb3BzOiBDREtQaXBlbGluZU9wdGlvbnMsIHBpcGVsaW5lOiBDREtQaXBlbGluZSkge1xuICAgIHN1cGVyKGFwcCwgcHJvcHMsIHBpcGVsaW5lKTtcbiAgICAvLyB0aGlzLmRlcGxveW1lbnRXb3JrZmxvdyA9IHRoaXMuYXBwLmdpdGh1YiEuYWRkV29ya2Zsb3coJ2RlcGxveScpO1xuICAgIHRoaXMuY29kZWNhdGFseXN0ID0gbmV3IENvZGVDYXRhbHlzdChhcHApO1xuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93ID0gbmV3IENvZGVDYXRhbHlzdFdvcmtmbG93KHRoaXMuY29kZWNhdGFseXN0LCAnd29ya2Zsb3cnKTtcblxuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93Lm9uKHtcbiAgICAgIHB1c2g6IHtcbiAgICAgICAgYnJhbmNoZXM6IFsnbWFpbiddLCAvLyBUT0RPIHVzZSBkZWZhdWx0UmVsZWFzZUJyYW5jaFxuICAgICAgfSxcbiAgICAgIHdvcmtmbG93RGlzcGF0Y2g6IHt9LFxuICAgIH0pO1xuXG4gICAgdGhpcy5uZWVkc1ZlcnNpb25lZEFydGlmYWN0cyA9IHRoaXMucHJvcHMuc3RhZ2VzLmZpbmQocyA9PiBzLm1hbnVhbEFwcHJvdmFsID09PSB0cnVlKSAhPT0gdW5kZWZpbmVkO1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZVN5bnRoKG9wdGlvbnM6IFN5bnRoU3RhZ2VPcHRpb25zKTogdm9pZCB7XG4gICAgY29uc3Qgc3RlcHM6IEpvYlN0ZXBbXSA9IFt7XG4gICAgICBuYW1lOiAnQ2hlY2tvdXQnLFxuICAgICAgdXNlczogJ2FjdGlvbnMvY2hlY2tvdXRAdjMnLFxuICAgIH1dO1xuXG4gICAgaWYgKHRoaXMucHJvcHMuZ2l0aHViQ29uZmlnPy5hd3NSb2xlQXJuRm9yU3ludGgpIHtcbiAgICAgIHN0ZXBzLnB1c2goe1xuICAgICAgICBuYW1lOiAnQVdTIENyZWRlbnRpYWxzJyxcbiAgICAgICAgdXNlczogJ2F3cy1hY3Rpb25zL2NvbmZpZ3VyZS1hd3MtY3JlZGVudGlhbHNAbWFzdGVyJyxcbiAgICAgICAgd2l0aDoge1xuICAgICAgICAgICdyb2xlLXRvLWFzc3VtZSc6IHRoaXMucHJvcHMuZ2l0aHViQ29uZmlnLmF3c1JvbGVBcm5Gb3JTeW50aCxcbiAgICAgICAgICAncm9sZS1zZXNzaW9uLW5hbWUnOiAnR2l0SHViQWN0aW9uJyxcbiAgICAgICAgICAnYXdzLXJlZ2lvbic6ICd1cy1lYXN0LTEnLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc3RlcHMucHVzaCguLi5vcHRpb25zLmNvbW1hbmRzLm1hcChjbWQgPT4gKHtcbiAgICAgIHJ1bjogY21kLFxuICAgIH0pKSk7XG5cbiAgICBzdGVwcy5wdXNoKHtcbiAgICAgIHVzZXM6ICdhY3Rpb25zL3VwbG9hZC1hcnRpZmFjdEB2MycsXG4gICAgICB3aXRoOiB7XG4gICAgICAgIG5hbWU6ICdjbG91ZC1hc3NlbWJseScsXG4gICAgICAgIHBhdGg6IGAke3RoaXMuYXBwLmNka0NvbmZpZy5jZGtvdXR9L2AsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgdGhpcy5kZXBsb3ltZW50V29ya2Zsb3cuYWRkSm9iKCdzeW50aCcsIHtcbiAgICAgIG5hbWU6ICdTeW50aCBDREsgYXBwbGljYXRpb24nLFxuICAgICAgcnVuc09uOiBbJ3VidW50dS1sYXRlc3QnXSxcbiAgICAgIGVudjoge1xuICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgfSxcbiAgICAgIHBlcm1pc3Npb25zOiB7IGlkVG9rZW46IEpvYlBlcm1pc3Npb24uV1JJVEUsIGNvbnRlbnRzOiBKb2JQZXJtaXNzaW9uLlJFQUQgfSxcbiAgICAgIHN0ZXBzLFxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZUFzc2V0VXBsb2FkKG9wdGlvbnM6IEFzc2V0VXBsb2FkU3RhZ2VPcHRpb25zKTogdm9pZCB7XG4gICAgdGhpcy5kZXBsb3ltZW50V29ya2Zsb3cuYWRkSm9iKCdhc3NldFVwbG9hZCcsIHtcbiAgICAgIG5hbWU6ICdQdWJsaXNoIGFzc2V0cyB0byBBV1MnLFxuICAgICAgbmVlZHM6IFsnc3ludGgnXSxcbiAgICAgIHJ1bnNPbjogWyd1YnVudHUtbGF0ZXN0J10sXG4gICAgICBlbnY6IHtcbiAgICAgICAgQ0k6ICd0cnVlJyxcbiAgICAgIH0sXG4gICAgICBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogdGhpcy5uZWVkc1ZlcnNpb25lZEFydGlmYWN0cyA/IEpvYlBlcm1pc3Npb24uV1JJVEUgOiBKb2JQZXJtaXNzaW9uLlJFQUQgfSxcbiAgICAgIHN0ZXBzOiBbe1xuICAgICAgICBuYW1lOiAnQ2hlY2tvdXQnLFxuICAgICAgICB1c2VzOiAnYWN0aW9ucy9jaGVja291dEB2MycsXG4gICAgICAgIHdpdGg6IHtcbiAgICAgICAgICAnZmV0Y2gtZGVwdGgnOiAwLFxuICAgICAgICB9LFxuICAgICAgfSwge1xuICAgICAgICBuYW1lOiAnU2V0dXAgR0lUIGlkZW50aXR5JyxcbiAgICAgICAgcnVuOiAnZ2l0IGNvbmZpZyAtLWdsb2JhbCB1c2VyLm5hbWUgXCJwcm9qZW4gcGlwZWxpbmVcIiAmJiBnaXQgY29uZmlnIC0tZ2xvYmFsIHVzZXIuZW1haWwgXCJpbmZvQHRhaW1vcy5kZVwiJyxcbiAgICAgIH0sIHtcbiAgICAgICAgbmFtZTogJ0FXUyBDcmVkZW50aWFscycsXG4gICAgICAgIHVzZXM6ICdhd3MtYWN0aW9ucy9jb25maWd1cmUtYXdzLWNyZWRlbnRpYWxzQG1hc3RlcicsXG4gICAgICAgIHdpdGg6IHtcbiAgICAgICAgICAncm9sZS10by1hc3N1bWUnOiB0aGlzLnByb3BzLmdpdGh1YkNvbmZpZz8uYXdzUm9sZUFybkZvckFzc2V0UHVibGlzaGluZyA/PyB0aGlzLnByb3BzLmdpdGh1YkNvbmZpZz8uZGVmYXVsdEF3c1JvbGVBcm4sXG4gICAgICAgICAgJ3JvbGUtc2Vzc2lvbi1uYW1lJzogJ0dpdEh1YkFjdGlvbicsXG4gICAgICAgICAgJ2F3cy1yZWdpb24nOiAndXMtZWFzdC0xJyxcbiAgICAgICAgfSxcbiAgICAgIH0sIHtcbiAgICAgICAgdXNlczogJ2FjdGlvbnMvZG93bmxvYWQtYXJ0aWZhY3RAdjMnLFxuICAgICAgICB3aXRoOiB7XG4gICAgICAgICAgbmFtZTogJ2Nsb3VkLWFzc2VtYmx5JyxcbiAgICAgICAgICBwYXRoOiBgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fS9gLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIC4uLm9wdGlvbnMuY29tbWFuZHMubWFwKGNtZCA9PiAoe1xuICAgICAgICBydW46IGNtZCxcbiAgICAgIH0pKV0sXG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgY3JlYXRlRGVwbG95bWVudChvcHRpb25zOiBEZXBsb3lTdGFnZU9wdGlvbnMpOiB2b2lkIHtcbiAgICBpZiAob3B0aW9ucy5jb25maWcubWFudWFsQXBwcm92YWwgPT09IHRydWUpIHtcbiAgICAgIC8vIENyZWF0ZSBuZXcgd29ya2Zsb3cgZm9yIGRlcGxveW1lbnRcbiAgICAgIGNvbnN0IHN0YWdlV29ya2Zsb3cgPSB0aGlzLmNvZGVjYXRhbHlzdCEuYWRkV29ya2Zsb3coYHJlbGVhc2UtJHtvcHRpb25zLmNvbmZpZy5uYW1lfWApO1xuXG4gICAgICBzdGFnZVdvcmtmbG93Lm9uKHtcbiAgICAgICAgd29ya2Zsb3dEaXNwYXRjaDoge1xuICAgICAgICAgIGlucHV0czoge1xuICAgICAgICAgICAgdmVyc2lvbjoge1xuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1BhY2thZ2UgdmVyc2lvbicsXG4gICAgICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgICBzdGFnZVdvcmtmbG93LmFkZEpvYignZGVwbG95Jywge1xuICAgICAgICBuYW1lOiBgUmVsZWFzZSBzdGFnZSAke29wdGlvbnMuY29uZmlnLm5hbWV9IHRvIEFXU2AsXG4gICAgICAgIHJ1bnNPbjogWyd1YnVudHUtbGF0ZXN0J10sXG4gICAgICAgIGVudjoge1xuICAgICAgICAgIENJOiAndHJ1ZScsXG4gICAgICAgIH0sXG4gICAgICAgIHBlcm1pc3Npb25zOiB7IGlkVG9rZW46IEpvYlBlcm1pc3Npb24uV1JJVEUsIGNvbnRlbnRzOiBKb2JQZXJtaXNzaW9uLlJFQUQgfSxcbiAgICAgICAgc3RlcHM6IFt7XG4gICAgICAgICAgbmFtZTogJ0NoZWNrb3V0JyxcbiAgICAgICAgICB1c2VzOiAnYWN0aW9ucy9jaGVja291dEB2MycsXG4gICAgICAgIH0sIHtcbiAgICAgICAgICBuYW1lOiAnQVdTIENyZWRlbnRpYWxzJyxcbiAgICAgICAgICB1c2VzOiAnYXdzLWFjdGlvbnMvY29uZmlndXJlLWF3cy1jcmVkZW50aWFsc0BtYXN0ZXInLFxuICAgICAgICAgIHdpdGg6IHtcbiAgICAgICAgICAgICdyb2xlLXRvLWFzc3VtZSc6IHRoaXMucHJvcHMuZ2l0aHViQ29uZmlnPy5hd3NSb2xlQXJuRm9yRGVwbG95bWVudD8uW29wdGlvbnMuY29uZmlnLm5hbWVdID8/IHRoaXMucHJvcHMuZ2l0aHViQ29uZmlnPy5kZWZhdWx0QXdzUm9sZUFybixcbiAgICAgICAgICAgICdyb2xlLXNlc3Npb24tbmFtZSc6ICdHaXRIdWJBY3Rpb24nLFxuICAgICAgICAgICAgJ2F3cy1yZWdpb24nOiBvcHRpb25zLmNvbmZpZy5lbnYucmVnaW9uLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIC4uLm9wdGlvbnMuaW5zdGFsbENvbW1hbmRzLm1hcChjbWQgPT4gKHtcbiAgICAgICAgICBydW46IGNtZCxcbiAgICAgICAgfSkpLFxuICAgICAgICB7XG4gICAgICAgICAgcnVuOiBgeWFybiBhZGQgJHt0aGlzLnByb3BzLnBrZ05hbWVzcGFjZX0vJHt0aGlzLmFwcC5uYW1lfUBcXCR7e2dpdGh1Yi5ldmVudC5pbnB1dHMudmVyc2lvbn19ICYmIG12IC4vbm9kZV9tb2R1bGVzLyR7dGhpcy5wcm9wcy5wa2dOYW1lc3BhY2V9LyR7dGhpcy5hcHAubmFtZX0gJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fWAsXG4gICAgICAgIH0sXG4gICAgICAgIC4uLm9wdGlvbnMuZGVwbG95Q29tbWFuZHMubWFwKGNtZCA9PiAoe1xuICAgICAgICAgIHJ1bjogY21kLFxuICAgICAgICB9KSldLFxuICAgICAgfSk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQWRkIGRlcGxveW1lbnQgdG8gQ0kvQ0Qgd29ya2Zsb3dcbiAgICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93LmFkZEpvYihgZGVwbG95LSR7b3B0aW9ucy5jb25maWcubmFtZX1gLCB7XG4gICAgICAgIG5hbWU6IGBEZXBsb3kgc3RhZ2UgJHtvcHRpb25zLmNvbmZpZy5uYW1lfSB0byBBV1NgLFxuICAgICAgICBuZWVkczogdGhpcy5kZXBsb3ltZW50U3RhZ2VzLmxlbmd0aCA+IDAgPyBbJ2Fzc2V0VXBsb2FkJywgYGRlcGxveS0ke3RoaXMuZGVwbG95bWVudFN0YWdlcy5hdCgtMSkhfWBdIDogWydhc3NldFVwbG9hZCddLFxuICAgICAgICBydW5zT246IFsndWJ1bnR1LWxhdGVzdCddLFxuICAgICAgICBlbnY6IHtcbiAgICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICB9LFxuICAgICAgICBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG4gICAgICAgIHN0ZXBzOiBbe1xuICAgICAgICAgIG5hbWU6ICdDaGVja291dCcsXG4gICAgICAgICAgdXNlczogJ2FjdGlvbnMvY2hlY2tvdXRAdjMnLFxuICAgICAgICB9LCB7XG4gICAgICAgICAgbmFtZTogJ0FXUyBDcmVkZW50aWFscycsXG4gICAgICAgICAgdXNlczogJ2F3cy1hY3Rpb25zL2NvbmZpZ3VyZS1hd3MtY3JlZGVudGlhbHNAbWFzdGVyJyxcbiAgICAgICAgICB3aXRoOiB7XG4gICAgICAgICAgICAncm9sZS10by1hc3N1bWUnOiB0aGlzLnByb3BzLmdpdGh1YkNvbmZpZz8uYXdzUm9sZUFybkZvckRlcGxveW1lbnQ/LltvcHRpb25zLmNvbmZpZy5uYW1lXSA/PyB0aGlzLnByb3BzLmdpdGh1YkNvbmZpZz8uZGVmYXVsdEF3c1JvbGVBcm4sXG4gICAgICAgICAgICAncm9sZS1zZXNzaW9uLW5hbWUnOiAnR2l0SHViQWN0aW9uJyxcbiAgICAgICAgICAgICdhd3MtcmVnaW9uJzogb3B0aW9ucy5jb25maWcuZW52LnJlZ2lvbixcbiAgICAgICAgICB9LFxuICAgICAgICB9LCB7XG4gICAgICAgICAgdXNlczogJ2FjdGlvbnMvZG93bmxvYWQtYXJ0aWZhY3RAdjMnLFxuICAgICAgICAgIHdpdGg6IHtcbiAgICAgICAgICAgIG5hbWU6ICdjbG91ZC1hc3NlbWJseScsXG4gICAgICAgICAgICBwYXRoOiBgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fS9gLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIC4uLm9wdGlvbnMuaW5zdGFsbENvbW1hbmRzLm1hcChjbWQgPT4gKHtcbiAgICAgICAgICBydW46IGNtZCxcbiAgICAgICAgfSkpLFxuICAgICAgICAuLi5vcHRpb25zLmRlcGxveUNvbW1hbmRzLm1hcChjbWQgPT4gKHtcbiAgICAgICAgICBydW46IGNtZCxcbiAgICAgICAgfSkpXSxcbiAgICAgIH0pO1xuICAgICAgdGhpcy5kZXBsb3ltZW50U3RhZ2VzLnB1c2gob3B0aW9ucy5jb25maWcubmFtZSk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCB7IENvZGVDYXRhbHlzdFdvcmtmbG93IH07XG4iXX0=