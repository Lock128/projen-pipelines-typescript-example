"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeCatalystCDKPipeline = void 0;
const JSII_RTTI_SYMBOL_1 = Symbol.for("jsii.rtti");
const blueprint_component_environments_1 = require("@amazon-codecatalyst/blueprint-component.environments");
const blueprint_component_workflows_1 = require("@amazon-codecatalyst/blueprint-component.workflows");
const projen_1 = require("projen");
const base_1 = require("./base");
const blueprint_1 = require("./codecatalyst/blueprint");
const engine_1 = require("../engine");
class CodeCatalystCDKPipeline extends base_1.CDKPipeline {
    constructor(app, options) {
        super(app, options);
        this.options = options;
        this.environments = new Map();
        this.deploymentStages = [];
        // see https://github.com/aws/codecatalyst-blueprints/issues/477
        process.env.CONTEXT_ENVIRONMENTID = 'prod';
        this.bp = new blueprint_1.Blueprint({ outdir: '.codecatalyst/workflows' });
        if (this.options.iamRoleArns) {
            this.createEnvironments();
        }
        this.deploymentWorkflowBuilder = new blueprint_component_workflows_1.WorkflowBuilder(this.bp);
        this.deploymentWorkflowBuilder.setName('deploy');
        this.deploymentWorkflowBuilder.addBranchTrigger(['main']);
        this.needsVersionedArtifacts = this.options.stages.find(s => s.manualApproval === true) !== undefined;
        this.createSynth();
        this.createAssetUpload();
        for (const stage of options.stages) {
            this.createDeployment(stage);
        }
        for (const stage of (options.independentStages ?? [])) {
            this.createIndependentDeployment(stage);
        }
        const yml = new projen_1.YamlFile(this, '.codecatalyst/workflows/deploy.yaml', {
            obj: this.deploymentWorkflowBuilder.getDefinition(),
        });
        yml.synthesize();
    }
    createEnvironments() {
        if (this.options.iamRoleArns.default) {
            this.environments.set('default', new blueprint_component_environments_1.Environment(this.bp, {
                environmentType: 'DEVELOPMENT',
                name: 'default',
                description: 'default deployment environment',
                awsAccount: {
                    id: 'default',
                    name: 'awsAccount',
                    awsAccount: { name: 'default-role', arn: this.options.iamRoleArns.default },
                },
            }));
        }
        if (this.options.iamRoleArns.synth) {
            this.environments.set('synth', new blueprint_component_environments_1.Environment(this.bp, {
                environmentType: 'DEVELOPMENT',
                name: 'synth',
                description: 'synth deployment environment',
                awsAccount: {
                    id: 'synth',
                    name: 'awsAccount',
                    awsAccount: { name: 'synth-role', arn: this.options.iamRoleArns.synth },
                },
            }));
        }
        if (this.options.iamRoleArns.assetPublishing) {
            this.environments.set('assetPublishing', new blueprint_component_environments_1.Environment(this.bp, {
                environmentType: 'DEVELOPMENT',
                name: 'assetPublishing',
                description: 'asset publishing deployment environment',
                awsAccount: {
                    id: 'assetPublishing',
                    name: 'awsAccount',
                    awsAccount: { name: 'assetPublishing-role', arn: this.options.iamRoleArns.assetPublishing },
                },
            }));
        }
        if (this.options.iamRoleArns.assetPublishingPerStage) {
            for (const [stage, arn] of Object.entries(this.options.iamRoleArns.assetPublishingPerStage)) {
                this.environments.set(`${stage}AssetPublishing`, new blueprint_component_environments_1.Environment(this.bp, {
                    environmentType: 'DEVELOPMENT',
                    name: `${stage}AssetPublishingPerStage`,
                    description: `${stage} asset publishing deployment environment`,
                    awsAccount: {
                        id: `${stage}AssetPublishingPerStage`,
                        name: 'awsAccount',
                        awsAccount: { name: `${stage}-role`, arn: arn },
                    },
                }));
            }
        }
        if (this.options.iamRoleArns.deployment) {
            for (const [stage, arn] of Object.entries(this.options.iamRoleArns.deployment)) {
                this.environments.set(stage, new blueprint_component_environments_1.Environment(this.bp, {
                    environmentType: 'DEVELOPMENT',
                    name: stage,
                    description: `${stage} deployment environment`,
                    awsAccount: {
                        id: stage,
                        name: 'awsAccount',
                        awsAccount: { name: `${stage}-role`, arn: arn },
                    },
                }));
            }
        }
    }
    /** the type of engine this implementation of CDKPipeline is for */
    engineType() {
        return engine_1.PipelineEngine.CODE_CATALYST;
    }
    createSynth() {
        const cmds = [];
        cmds.push(...this.renderInstallCommands());
        cmds.push(...this.renderSynthCommands());
        this.deploymentWorkflowBuilder.addBuildAction({
            actionName: 'SynthCDKApplication',
            input: {
                Sources: ['WorkflowSource'],
                Variables: {
                    CI: 'true',
                },
            },
            steps: cmds,
            // FIXME is there is an environment, connect it to the workflow
            // needs to react on this.options.iamRoleArns?.synth
            //environment: environment && convertToWorkflowEnvironment(environment),
            // FIXME what about the permissions?
            // permissions: { idToken: JobPermission.WRITE, contents: JobPermission.READ },
            environment: (0, blueprint_component_workflows_1.convertToWorkflowEnvironment)(this.environments.get('default')),
            output: {},
        });
        /*
    not required because codecatalyst automatically uploads artifacts
    FIXME or do we need to create "artifacts" here and upload?
    steps.push({
          uses: 'actions/upload-artifact@v3',
          with: {
            name: 'cloud-assembly',
            path: `${this.app.cdkConfig.cdkout}/`,
          },
        });
        */
    }
    createAssetUpload() {
        const cmds = [];
        cmds.push(...this.renderAssetUploadCommands());
        this.deploymentWorkflowBuilder.addBuildAction({
            actionName: 'PublishAssetsToAWS',
            dependsOn: ['SynthCDKApplication'],
            input: {
                Sources: ['WorkflowSource'],
                Variables: {
                    CI: 'true',
                },
            },
            steps: cmds,
            // FIXME is there is an environment, connect it to the workflow
            // needs to react on this.options.iamRoleArns?.synth
            //environment: environment && convertToWorkflowEnvironment(environment),
            // FIXME what about the permissions?
            // permissions: { idToken: JobPermission.WRITE, contents: JobPermission.READ },
            output: {},
        });
    }
    createDeployment(stage) {
        let dependsOn = `deploy_${this.deploymentStages.at(-1)}`;
        if (stage.manualApproval === true) {
            this.deploymentWorkflowBuilder.addGenericAction({
                Identifier: 'aws/approval@v1',
                actionName: `approve_${stage.name}`,
                DependsOn: [`deploy_${this.deploymentStages.at(-1)}`],
                Configuration: {
                    ApprovalsRequired: 1,
                },
            });
            dependsOn = `approve_${stage.name}`;
        }
        // Add deployment to existing workflow
        const cmds = [];
        cmds.push(...this.renderInstallCommands());
        cmds.push(...this.renderDeployCommands(stage.name));
        this.deploymentWorkflowBuilder.addBuildAction({
            actionName: `deploy_${stage.name}`,
            dependsOn: this.deploymentStages.length > 0 ? ['PublishAssetsToAWS', dependsOn] : ['PublishAssetsToAWS'],
            input: {
                Sources: ['WorkflowSource'],
                Variables: {
                    CI: 'true',
                },
            },
            steps: cmds,
            // FIXME is there is an environment, connect it to the workflow
            // needs to react on this.options.iamRoleArns?.synth
            //environment: environment && convertToWorkflowEnvironment(environment),
            // FIXME what about the permissions?
            // permissions: { idToken: JobPermission.WRITE, contents: JobPermission.READ },
            output: {},
            environment: (0, blueprint_component_workflows_1.convertToWorkflowEnvironment)(this.environments.get(stage.name)),
        });
        this.deploymentStages.push(stage.name);
    }
    createIndependentDeployment(stage) {
        let dependsOn = 'PublishAssetsToAWS';
        if (stage.manualApproval === true) {
            this.deploymentWorkflowBuilder.addGenericAction({
                Identifier: 'aws/approval@v1',
                actionName: `approve_${stage.name}`,
                DependsOn: [`deploy_${this.deploymentStages.at(-1)}`],
                Configuration: {
                    ApprovalsRequired: 1,
                },
            });
            dependsOn = `approve_${stage.name}`;
        }
        // Add deployment to existing workflow
        const cmds = [];
        cmds.push(...this.renderInstallCommands());
        cmds.push(...this.renderDeployCommands(stage.name));
        this.deploymentWorkflowBuilder.addBuildAction({
            actionName: `indeploy_${stage.name}`,
            dependsOn: [dependsOn],
            input: {
                Sources: ['WorkflowSource'],
                Variables: {
                    CI: 'true',
                },
            },
            steps: cmds,
            // FIXME is there is an environment, connect it to the workflow
            // needs to react on this.options.iamRoleArns?.synth
            //environment: environment && convertToWorkflowEnvironment(environment),
            // FIXME what about the permissions?
            // permissions: { idToken: JobPermission.WRITE, contents: JobPermission.READ },
            output: {},
        });
    }
}
exports.CodeCatalystCDKPipeline = CodeCatalystCDKPipeline;
_a = JSII_RTTI_SYMBOL_1;
CodeCatalystCDKPipeline[_a] = { fqn: "projen-pipelines.CodeCatalystCDKPipeline", version: "0.0.0" };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29kZWNhdGFseXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2F3c2Nkay9jb2RlY2F0YWx5c3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSw0R0FBb0Y7QUFDcEYsc0dBQW1IO0FBQ25ILG1DQUEwQztBQUMxQyxpQ0FBMEU7QUFFMUUsd0RBQXFEO0FBQ3JELHNDQUEyQztBQStDM0MsTUFBYSx1QkFBd0IsU0FBUSxrQkFBVztJQVV0RCxZQUFZLEdBQStCLEVBQVUsT0FBdUM7UUFDMUYsS0FBSyxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUQrQixZQUFPLEdBQVAsT0FBTyxDQUFnQztRQUxwRixpQkFBWSxHQUE2QixJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ25ELHFCQUFnQixHQUFhLEVBQUUsQ0FBQztRQU10QyxnRUFBZ0U7UUFDaEUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsR0FBRyxNQUFNLENBQUM7UUFFM0MsSUFBSSxDQUFDLEVBQUUsR0FBRyxJQUFJLHFCQUFTLENBQUMsRUFBRSxNQUFNLEVBQUUseUJBQXlCLEVBQUUsQ0FBQyxDQUFDO1FBRS9ELElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUM3QixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUM1QixDQUFDO1FBRUQsSUFBSSxDQUFDLHlCQUF5QixHQUFHLElBQUksK0NBQWUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFOUQsSUFBSSxDQUFDLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNqRCxJQUFJLENBQUMseUJBQXlCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBRTFELElBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FB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YUFDRixDQUFDLENBQUM7WUFDSCxTQUFTLEdBQUcsV0FBVyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDdEMsQ0FBQztRQUNELHNDQUFzQztRQUN0QyxNQUFNLElBQUksR0FBYSxFQUFFLENBQUM7UUFDMUIsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDLENBQUM7UUFDM0MsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNwRCxJQUFJLENBQUMseUJBQXlCLENBQUMsY0FBYyxDQUFDO1lBQzVDLFVBQVUsRUFBRSxZQUFZLEtBQUssQ0FBQyxJQUFJLEVBQUU7WUFDcEMsU0FBUyxFQUFFLENBQUMsU0FBUyxDQUFDO1lBQ3RCLEtBQUssRUFBRTtnQkFDTCxPQUFPLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDM0IsU0FBUyxFQUFFO29CQUNULEVBQUUsRUFBRSxNQUFNO2lCQUNYO2FBQ0Y7WUFDRCxLQUFLLEVBQ0gsSUFBSTtZQUNOLCtEQUErRDtZQUMvRCxvREFBb0Q7WUFDcEQsd0VBQXdFO1lBRXhFLG9DQUFvQztZQUNwQywrRUFBK0U7WUFFL0UsTUFBTSxFQUFFLEVBQUU7U0FDWCxDQUFDLENBQUM7SUFDTCxDQUFDOztBQTlRSCwwREFnUkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFbnZpcm9ubWVudCB9IGZyb20gJ0BhbWF6b24tY29kZWNhdGFseXN0L2JsdWVwcmludC1jb21wb25lbnQuZW52aXJvbm1lbnRzJztcbmltcG9ydCB7IGNvbnZlcnRUb1dvcmtmbG93RW52aXJvbm1lbnQsIFdvcmtmbG93QnVpbGRlciB9IGZyb20gJ0BhbWF6b24tY29kZWNhdGFseXN0L2JsdWVwcmludC1jb21wb25lbnQud29ya2Zsb3dzJztcbmltcG9ydCB7IFlhbWxGaWxlLCBhd3NjZGsgfSBmcm9tICdwcm9qZW4nO1xuaW1wb3J0IHsgQ0RLUGlwZWxpbmUsIENES1BpcGVsaW5lT3B0aW9ucywgRGVwbG95bWVudFN0YWdlIH0gZnJvbSAnLi9iYXNlJztcblxuaW1wb3J0IHsgQmx1ZXByaW50IH0gZnJvbSAnLi9jb2RlY2F0YWx5c3QvYmx1ZXByaW50JztcbmltcG9ydCB7IFBpcGVsaW5lRW5naW5lIH0gZnJvbSAnLi4vZW5naW5lJztcblxuLypcbk5lZWRzIHRvIGNyZWF0ZTpcbi0gYnVpbGQueW1sIChjcmVhdGVzIGFuZCBtdXRhdGVzIHBpcGVsaW5lIGJ5IGV4ZWN1dGluZyBwcm9qZW4gYnVpbGQpIC0gY29tZXMgZnJvbSBwcm9qZW5cbi0gZGVwbG95LnlhbWwgKGJ1aWxkICsgZGVwbG95IHRvIGRldilcbi0gcHVsbC1yZXF1ZXN0LWxpbnQueW1sIChleGVjdXRlcyBhbWFubm4vYWN0aW9uLXNlbWFudGljLXB1bGwtcmVxdWVzdEB2NS4wLjIpIC0gY29tZXMgZnJvbSBwcm9qZW5cbi0gcmVsZWFzZS1wcm9kLnlhbWwgKGRlcGxveSB0byBwcm9kIC0gbm90IHJlcXVpcmVkLCBtb3ZlIG92ZXIgdG8gXCJtYW51YWwgYXBwcm92YWxzXCIgaW4gZGVwbG8pXG4tIHVwZ3JhZGUueWFtbCAodXBncmFkZSBkZXBlbmRlbmNpZXMpICAtIGNvbWVzIGZyb20gcHJvamVuXG5cbiogc3ludGggLT4gY3JlYXRlIGFydGlmYWN0c1xuKiB1cGxvYWQgY2RrIGFzc2V0cyAtPiAgc2F2ZSBhc3NldHMgaW4gczMgKGxhbWJkYSksIGJ1aWxkIGNvbnRhaW5lciBpbWFnZXMgKHB1c2ggdG8gRUNSKSAtLSBldmVyeXRoaW5nIGluIEFXU1xuKiBkZXBsb3kgZm9yIGVhY2ggc3RhZ2UgdGhhdCBpcyBub24tcHJvZHVjdGlvblxuKiBkZXBsb3kgdG8gcHJvZCAobWFudWFsIGFwcHJvdmFsKVxuXG5UT0RPOlxuLSBhY2NvdW50IHRhcmdldFxuLSBtYW51YWwgYXBwcm92YWwgZm9yIHN0YWdlcyAtLSBET05FXG4tIElBTSByb2xlIHBlciBzdGFnZSwgc3ludGgsIGFzc2V0IC0gTk9UIFBPU1NJQkxFIGFzIHdlIGNhbm5vdCBjcmVhdGUgZW52aXJvbm1lbnRzXG4tIGluZGVwZW5kZW5kIHN0YWdlcyAoYWxsIHBhcmFsbGVsIHRvIGVhY2ggb3RoZXIpIGFmdGVyIHN5bnRoJmFzc2V0cyAtLSBET05FXG4tIGVudmlyb25tZW50cyBzdXBwb3J0IC0gRE9ORVxuLSBzdGVwcyBwZXIgc3RhZ2UgLSBwcmVJbnN0YWxsLCBwcmVTeW50aCwgLi4uXG5cbmV4YW1wbGU6IGh0dHBzOi8vZ2l0aHViLmNvbS9hd3MtY29tbXVuaXR5LWRhY2gvZXZlbnQtc3lzdGVtLWJhY2tlbmRcblxudGVzdCBkb2NnZW46IGh0dHBzOi8vZ2l0aHViLmNvbS9vcGVuLWNvbnN0cnVjdHMvYXdzLWNkay1saWJyYXJ5XG5cblxuKi9cblxuZXhwb3J0IGludGVyZmFjZSBDb2RlQ2F0YWx5c3RJYW1Sb2xlQ29uZmlnIHtcbiAgLyoqIERlZmF1bHQgSUFNIHJvbGUgQVJOIHVzZWQgaWYgbm8gc3BlY2lmaWMgcm9sZSBpcyBwcm92aWRlZC4gKi9cbiAgcmVhZG9ubHkgZGVmYXVsdD86IHN0cmluZztcbiAgLyoqIElBTSByb2xlIEFSTiBmb3IgdGhlIHN5bnRoZXNpcyBzdGVwLiAqL1xuICByZWFkb25seSBzeW50aD86IHN0cmluZztcbiAgLyoqIElBTSByb2xlIEFSTiBmb3IgdGhlIGFzc2V0IHB1Ymxpc2hpbmcgc3RlcC4gKi9cbiAgcmVhZG9ubHkgYXNzZXRQdWJsaXNoaW5nPzogc3RyaW5nO1xuICAvKiogSUFNIHJvbGUgQVJOIGZvciB0aGUgYXNzZXQgcHVibGlzaGluZyBzdGVwIGZvciBhIHNwZWNpZmljIHN0YWdlLiAqL1xuICByZWFkb25seSBhc3NldFB1Ymxpc2hpbmdQZXJTdGFnZT86IHsgW3N0YWdlOiBzdHJpbmddOiBzdHJpbmcgfTtcbiAgLyoqIElBTSByb2xlIEFSTnMgZm9yIGRpZmZlcmVudCBkZXBsb3ltZW50IHN0YWdlcy4gKi9cbiAgcmVhZG9ubHkgZGVwbG95bWVudD86IHsgW3N0YWdlOiBzdHJpbmddOiBzdHJpbmcgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb2RlQ2F0YWx5c3RDREtQaXBlbGluZU9wdGlvbnMgZXh0ZW5kcyBDREtQaXBlbGluZU9wdGlvbnMge1xuICByZWFkb25seSBpYW1Sb2xlQXJuczogQ29kZUNhdGFseXN0SWFtUm9sZUNvbmZpZztcbn1cblxuZXhwb3J0IGNsYXNzIENvZGVDYXRhbHlzdENES1BpcGVsaW5lIGV4dGVuZHMgQ0RLUGlwZWxpbmUge1xuXG4gIHB1YmxpYyByZWFkb25seSBuZWVkc1ZlcnNpb25lZEFydGlmYWN0czogYm9vbGVhbjtcblxuICBwcml2YXRlIGRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXI6IFdvcmtmbG93QnVpbGRlcjtcbiAgcHJpdmF0ZSBlbnZpcm9ubWVudHM6IE1hcDxTdHJpbmcsIEVudmlyb25tZW50PiA9IG5ldyBNYXAoKTtcbiAgcHJpdmF0ZSBkZXBsb3ltZW50U3RhZ2VzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHByaXZhdGUgcmVhZG9ubHkgYnA6IEJsdWVwcmludDtcblxuICBjb25zdHJ1Y3RvcihhcHA6IGF3c2Nkay5Bd3NDZGtUeXBlU2NyaXB0QXBwLCBwcml2YXRlIG9wdGlvbnM6IENvZGVDYXRhbHlzdENES1BpcGVsaW5lT3B0aW9ucykge1xuICAgIHN1cGVyKGFwcCwgb3B0aW9ucyk7XG4gICAgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9hd3MvY29kZWNhdGFseXN0LWJsdWVwcmludHMvaXNzdWVzLzQ3N1xuICAgIHByb2Nlc3MuZW52LkNPTlRFWFRfRU5WSVJPTk1FTlRJRCA9ICdwcm9kJztcblxuICAgIHRoaXMuYnAgPSBuZXcgQmx1ZXByaW50KHsgb3V0ZGlyOiAnLmNvZGVjYXRhbHlzdC93b3JrZmxvd3MnIH0pO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucykge1xuICAgICAgdGhpcy5jcmVhdGVFbnZpcm9ubWVudHMoKTtcbiAgICB9XG5cbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIgPSBuZXcgV29ya2Zsb3dCdWlsZGVyKHRoaXMuYnApO1xuXG4gICAgdGhpcy5kZXBsb3ltZW50V29ya2Zsb3dCdWlsZGVyLnNldE5hbWUoJ2RlcGxveScpO1xuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93QnVpbGRlci5hZGRCcmFuY2hUcmlnZ2VyKFsnbWFpbiddKTtcblxuICAgIHRoaXMubmVlZHNWZXJzaW9uZWRBcnRpZmFjdHMgPSB0aGlzLm9wdGlvbnMuc3RhZ2VzLmZpbmQocyA9PiBzLm1hbnVhbEFwcHJvdmFsID09PSB0cnVlKSAhPT0gdW5kZWZpbmVkO1xuXG4gICAgdGhpcy5jcmVhdGVTeW50aCgpO1xuICAgIHRoaXMuY3JlYXRlQXNzZXRVcGxvYWQoKTtcblxuICAgIGZvciAoY29uc3Qgc3RhZ2Ugb2Ygb3B0aW9ucy5zdGFnZXMpIHtcbiAgICAgIHRoaXMuY3JlYXRlRGVwbG95bWVudChzdGFnZSk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBzdGFnZSBvZiAob3B0aW9ucy5pbmRlcGVuZGVudFN0YWdlcyA/PyBbXSkpIHtcbiAgICAgIHRoaXMuY3JlYXRlSW5kZXBlbmRlbnREZXBsb3ltZW50KHN0YWdlKTtcbiAgICB9XG5cbiAgICBjb25zdCB5bWwgPSBuZXcgWWFtbEZpbGUodGhpcywgJy5jb2RlY2F0YWx5c3Qvd29ya2Zsb3dzL2RlcGxveS55YW1sJywge1xuICAgICAgb2JqOiB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuZ2V0RGVmaW5pdGlvbigpLFxuXG4gICAgfSk7XG4gICAgeW1sLnN5bnRoZXNpemUoKTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVFbnZpcm9ubWVudHMoKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucy5kZWZhdWx0KSB7XG4gICAgICB0aGlzLmVudmlyb25tZW50cy5zZXQoJ2RlZmF1bHQnLFxuICAgICAgICBuZXcgRW52aXJvbm1lbnQodGhpcy5icCwge1xuICAgICAgICAgIGVudmlyb25tZW50VHlwZTogJ0RFVkVMT1BNRU5UJyxcbiAgICAgICAgICBuYW1lOiAnZGVmYXVsdCcsXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdkZWZhdWx0IGRlcGxveW1lbnQgZW52aXJvbm1lbnQnLFxuICAgICAgICAgIGF3c0FjY291bnQ6IHtcbiAgICAgICAgICAgIGlkOiAnZGVmYXVsdCcsXG4gICAgICAgICAgICBuYW1lOiAnYXdzQWNjb3VudCcsXG4gICAgICAgICAgICBhd3NBY2NvdW50OiB7IG5hbWU6ICdkZWZhdWx0LXJvbGUnLCBhcm46IHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucy5kZWZhdWx0IH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnMuc3ludGgpIHtcbiAgICAgIHRoaXMuZW52aXJvbm1lbnRzLnNldCgnc3ludGgnLFxuICAgICAgICBuZXcgRW52aXJvbm1lbnQodGhpcy5icCwge1xuICAgICAgICAgIGVudmlyb25tZW50VHlwZTogJ0RFVkVMT1BNRU5UJyxcbiAgICAgICAgICBuYW1lOiAnc3ludGgnLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnc3ludGggZGVwbG95bWVudCBlbnZpcm9ubWVudCcsXG4gICAgICAgICAgYXdzQWNjb3VudDoge1xuICAgICAgICAgICAgaWQ6ICdzeW50aCcsXG4gICAgICAgICAgICBuYW1lOiAnYXdzQWNjb3VudCcsXG4gICAgICAgICAgICBhd3NBY2NvdW50OiB7IG5hbWU6ICdzeW50aC1yb2xlJywgYXJuOiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnMuc3ludGggfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucy5hc3NldFB1Ymxpc2hpbmcpIHtcbiAgICAgIHRoaXMuZW52aXJvbm1lbnRzLnNldCgnYXNzZXRQdWJsaXNoaW5nJyxcbiAgICAgICAgbmV3IEVudmlyb25tZW50KHRoaXMuYnAsIHtcbiAgICAgICAgICBlbnZpcm9ubWVudFR5cGU6ICdERVZFTE9QTUVOVCcsXG4gICAgICAgICAgbmFtZTogJ2Fzc2V0UHVibGlzaGluZycsXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdhc3NldCBwdWJsaXNoaW5nIGRlcGxveW1lbnQgZW52aXJvbm1lbnQnLFxuICAgICAgICAgIGF3c0FjY291bnQ6IHtcbiAgICAgICAgICAgIGlkOiAnYXNzZXRQdWJsaXNoaW5nJyxcbiAgICAgICAgICAgIG5hbWU6ICdhd3NBY2NvdW50JyxcbiAgICAgICAgICAgIGF3c0FjY291bnQ6IHsgbmFtZTogJ2Fzc2V0UHVibGlzaGluZy1yb2xlJywgYXJuOiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnMuYXNzZXRQdWJsaXNoaW5nIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnMuYXNzZXRQdWJsaXNoaW5nUGVyU3RhZ2UpIHtcbiAgICAgIGZvciAoY29uc3QgW3N0YWdlLCBhcm5dIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucy5hc3NldFB1Ymxpc2hpbmdQZXJTdGFnZSkpIHtcbiAgICAgICAgdGhpcy5lbnZpcm9ubWVudHMuc2V0KGAke3N0YWdlfUFzc2V0UHVibGlzaGluZ2AsXG4gICAgICAgICAgbmV3IEVudmlyb25tZW50KHRoaXMuYnAsIHtcbiAgICAgICAgICAgIGVudmlyb25tZW50VHlwZTogJ0RFVkVMT1BNRU5UJyxcbiAgICAgICAgICAgIG5hbWU6IGAke3N0YWdlfUFzc2V0UHVibGlzaGluZ1BlclN0YWdlYCxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgJHtzdGFnZX0gYXNzZXQgcHVibGlzaGluZyBkZXBsb3ltZW50IGVudmlyb25tZW50YCxcbiAgICAgICAgICAgIGF3c0FjY291bnQ6IHtcbiAgICAgICAgICAgICAgaWQ6IGAke3N0YWdlfUFzc2V0UHVibGlzaGluZ1BlclN0YWdlYCxcbiAgICAgICAgICAgICAgbmFtZTogJ2F3c0FjY291bnQnLFxuICAgICAgICAgICAgICBhd3NBY2NvdW50OiB7IG5hbWU6IGAke3N0YWdlfS1yb2xlYCwgYXJuOiBhcm4gfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnMuZGVwbG95bWVudCkge1xuICAgICAgZm9yIChjb25zdCBbc3RhZ2UsIGFybl0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zLmRlcGxveW1lbnQpKSB7XG4gICAgICAgIHRoaXMuZW52aXJvbm1lbnRzLnNldChzdGFnZSxcbiAgICAgICAgICBuZXcgRW52aXJvbm1lbnQodGhpcy5icCwge1xuICAgICAgICAgICAgZW52aXJvbm1lbnRUeXBlOiAnREVWRUxPUE1FTlQnLFxuICAgICAgICAgICAgbmFtZTogc3RhZ2UsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYCR7c3RhZ2V9IGRlcGxveW1lbnQgZW52aXJvbm1lbnRgLFxuICAgICAgICAgICAgYXdzQWNjb3VudDoge1xuICAgICAgICAgICAgICBpZDogc3RhZ2UsXG4gICAgICAgICAgICAgIG5hbWU6ICdhd3NBY2NvdW50JyxcbiAgICAgICAgICAgICAgYXdzQWNjb3VudDogeyBuYW1lOiBgJHtzdGFnZX0tcm9sZWAsIGFybjogYXJuIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKiogdGhlIHR5cGUgb2YgZW5naW5lIHRoaXMgaW1wbGVtZW50YXRpb24gb2YgQ0RLUGlwZWxpbmUgaXMgZm9yICovXG4gIHB1YmxpYyBlbmdpbmVUeXBlKCk6IFBpcGVsaW5lRW5naW5lIHtcbiAgICByZXR1cm4gUGlwZWxpbmVFbmdpbmUuQ09ERV9DQVRBTFlTVDtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlU3ludGgoKTogdm9pZCB7XG5cbiAgICBjb25zdCBjbWRzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNtZHMucHVzaCguLi50aGlzLnJlbmRlckluc3RhbGxDb21tYW5kcygpKTtcbiAgICBjbWRzLnB1c2goLi4udGhpcy5yZW5kZXJTeW50aENvbW1hbmRzKCkpO1xuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93QnVpbGRlci5hZGRCdWlsZEFjdGlvbih7XG4gICAgICBhY3Rpb25OYW1lOiAnU3ludGhDREtBcHBsaWNhdGlvbicsXG4gICAgICBpbnB1dDoge1xuICAgICAgICBTb3VyY2VzOiBbJ1dvcmtmbG93U291cmNlJ10sXG4gICAgICAgIFZhcmlhYmxlczoge1xuICAgICAgICAgIENJOiAndHJ1ZScsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgc3RlcHM6XG4gICAgICAgIGNtZHMsXG4gICAgICAvLyBGSVhNRSBpcyB0aGVyZSBpcyBhbiBlbnZpcm9ubWVudCwgY29ubmVjdCBpdCB0byB0aGUgd29ya2Zsb3dcbiAgICAgIC8vIG5lZWRzIHRvIHJlYWN0IG9uIHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucz8uc3ludGhcbiAgICAgIC8vZW52aXJvbm1lbnQ6IGVudmlyb25tZW50ICYmIGNvbnZlcnRUb1dvcmtmbG93RW52aXJvbm1lbnQoZW52aXJvbm1lbnQpLFxuXG4gICAgICAvLyBGSVhNRSB3aGF0IGFib3V0IHRoZSBwZXJtaXNzaW9ucz9cbiAgICAgIC8vIHBlcm1pc3Npb25zOiB7IGlkVG9rZW46IEpvYlBlcm1pc3Npb24uV1JJVEUsIGNvbnRlbnRzOiBKb2JQZXJtaXNzaW9uLlJFQUQgfSxcbiAgICAgIGVudmlyb25tZW50OiBjb252ZXJ0VG9Xb3JrZmxvd0Vudmlyb25tZW50KHRoaXMuZW52aXJvbm1lbnRzLmdldCgnZGVmYXVsdCcpKSxcbiAgICAgIG91dHB1dDoge30sXG4gICAgfSk7XG5cbiAgICAvKlxubm90IHJlcXVpcmVkIGJlY2F1c2UgY29kZWNhdGFseXN0IGF1dG9tYXRpY2FsbHkgdXBsb2FkcyBhcnRpZmFjdHNcbkZJWE1FIG9yIGRvIHdlIG5lZWQgdG8gY3JlYXRlIFwiYXJ0aWZhY3RzXCIgaGVyZSBhbmQgdXBsb2FkP1xuc3RlcHMucHVzaCh7XG4gICAgICB1c2VzOiAnYWN0aW9ucy91cGxvYWQtYXJ0aWZhY3RAdjMnLFxuICAgICAgd2l0aDoge1xuICAgICAgICBuYW1lOiAnY2xvdWQtYXNzZW1ibHknLFxuICAgICAgICBwYXRoOiBgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fS9gLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICAqL1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZUFzc2V0VXBsb2FkKCk6IHZvaWQge1xuXG4gICAgY29uc3QgY21kczogc3RyaW5nW10gPSBbXTtcbiAgICBjbWRzLnB1c2goLi4udGhpcy5yZW5kZXJBc3NldFVwbG9hZENvbW1hbmRzKCkpO1xuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93QnVpbGRlci5hZGRCdWlsZEFjdGlvbih7XG4gICAgICBhY3Rpb25OYW1lOiAnUHVibGlzaEFzc2V0c1RvQVdTJyxcbiAgICAgIGRlcGVuZHNPbjogWydTeW50aENES0FwcGxpY2F0aW9uJ10sXG4gICAgICBpbnB1dDoge1xuICAgICAgICBTb3VyY2VzOiBbJ1dvcmtmbG93U291cmNlJ10sXG4gICAgICAgIFZhcmlhYmxlczoge1xuICAgICAgICAgIENJOiAndHJ1ZScsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgc3RlcHM6XG4gICAgICAgIGNtZHMsXG4gICAgICAvLyBGSVhNRSBpcyB0aGVyZSBpcyBhbiBlbnZpcm9ubWVudCwgY29ubmVjdCBpdCB0byB0aGUgd29ya2Zsb3dcbiAgICAgIC8vIG5lZWRzIHRvIHJlYWN0IG9uIHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucz8uc3ludGhcbiAgICAgIC8vZW52aXJvbm1lbnQ6IGVudmlyb25tZW50ICYmIGNvbnZlcnRUb1dvcmtmbG93RW52aXJvbm1lbnQoZW52aXJvbm1lbnQpLFxuXG4gICAgICAvLyBGSVhNRSB3aGF0IGFib3V0IHRoZSBwZXJtaXNzaW9ucz9cbiAgICAgIC8vIHBlcm1pc3Npb25zOiB7IGlkVG9rZW46IEpvYlBlcm1pc3Npb24uV1JJVEUsIGNvbnRlbnRzOiBKb2JQZXJtaXNzaW9uLlJFQUQgfSxcblxuICAgICAgb3V0cHV0OiB7fSxcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVEZXBsb3ltZW50KHN0YWdlOiBEZXBsb3ltZW50U3RhZ2UpOiB2b2lkIHtcbiAgICBsZXQgZGVwZW5kc09uID0gYGRlcGxveV8ke3RoaXMuZGVwbG95bWVudFN0YWdlcy5hdCgtMSkhfWA7XG4gICAgaWYgKHN0YWdlLm1hbnVhbEFwcHJvdmFsID09PSB0cnVlKSB7XG4gICAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkR2VuZXJpY0FjdGlvbih7XG4gICAgICAgIElkZW50aWZpZXI6ICdhd3MvYXBwcm92YWxAdjEnLFxuICAgICAgICBhY3Rpb25OYW1lOiBgYXBwcm92ZV8ke3N0YWdlLm5hbWV9YCxcbiAgICAgICAgRGVwZW5kc09uOiBbYGRlcGxveV8ke3RoaXMuZGVwbG95bWVudFN0YWdlcy5hdCgtMSkhfWBdLFxuICAgICAgICBDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgQXBwcm92YWxzUmVxdWlyZWQ6IDEsXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGRlcGVuZHNPbiA9IGBhcHByb3ZlXyR7c3RhZ2UubmFtZX1gO1xuICAgIH1cbiAgICAvLyBBZGQgZGVwbG95bWVudCB0byBleGlzdGluZyB3b3JrZmxvd1xuICAgIGNvbnN0IGNtZHM6IHN0cmluZ1tdID0gW107XG4gICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVySW5zdGFsbENvbW1hbmRzKCkpO1xuICAgIGNtZHMucHVzaCguLi50aGlzLnJlbmRlckRlcGxveUNvbW1hbmRzKHN0YWdlLm5hbWUpKTtcbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogYGRlcGxveV8ke3N0YWdlLm5hbWV9YCxcbiAgICAgIGRlcGVuZHNPbjogdGhpcy5kZXBsb3ltZW50U3RhZ2VzLmxlbmd0aCA+IDAgPyBbJ1B1Ymxpc2hBc3NldHNUb0FXUycsIGRlcGVuZHNPbl0gOiBbJ1B1Ymxpc2hBc3NldHNUb0FXUyddLFxuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgU291cmNlczogWydXb3JrZmxvd1NvdXJjZSddLFxuICAgICAgICBWYXJpYWJsZXM6IHtcbiAgICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHN0ZXBzOlxuICAgICAgICBjbWRzLFxuICAgICAgLy8gRklYTUUgaXMgdGhlcmUgaXMgYW4gZW52aXJvbm1lbnQsIGNvbm5lY3QgaXQgdG8gdGhlIHdvcmtmbG93XG4gICAgICAvLyBuZWVkcyB0byByZWFjdCBvbiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LnN5bnRoXG4gICAgICAvL2Vudmlyb25tZW50OiBlbnZpcm9ubWVudCAmJiBjb252ZXJ0VG9Xb3JrZmxvd0Vudmlyb25tZW50KGVudmlyb25tZW50KSxcblxuICAgICAgLy8gRklYTUUgd2hhdCBhYm91dCB0aGUgcGVybWlzc2lvbnM/XG4gICAgICAvLyBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG5cbiAgICAgIG91dHB1dDoge30sXG4gICAgICBlbnZpcm9ubWVudDogY29udmVydFRvV29ya2Zsb3dFbnZpcm9ubWVudCh0aGlzLmVudmlyb25tZW50cy5nZXQoc3RhZ2UubmFtZSkpLFxuICAgIH0pO1xuXG4gICAgdGhpcy5kZXBsb3ltZW50U3RhZ2VzLnB1c2goc3RhZ2UubmFtZSk7XG4gIH1cblxuICBwdWJsaWMgY3JlYXRlSW5kZXBlbmRlbnREZXBsb3ltZW50KHN0YWdlOiBEZXBsb3ltZW50U3RhZ2UpOiB2b2lkIHtcbiAgICBsZXQgZGVwZW5kc09uID0gJ1B1Ymxpc2hBc3NldHNUb0FXUyc7XG4gICAgaWYgKHN0YWdlLm1hbnVhbEFwcHJvdmFsID09PSB0cnVlKSB7XG4gICAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkR2VuZXJpY0FjdGlvbih7XG4gICAgICAgIElkZW50aWZpZXI6ICdhd3MvYXBwcm92YWxAdjEnLFxuICAgICAgICBhY3Rpb25OYW1lOiBgYXBwcm92ZV8ke3N0YWdlLm5hbWV9YCxcbiAgICAgICAgRGVwZW5kc09uOiBbYGRlcGxveV8ke3RoaXMuZGVwbG95bWVudFN0YWdlcy5hdCgtMSkhfWBdLFxuICAgICAgICBDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgQXBwcm92YWxzUmVxdWlyZWQ6IDEsXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGRlcGVuZHNPbiA9IGBhcHByb3ZlXyR7c3RhZ2UubmFtZX1gO1xuICAgIH1cbiAgICAvLyBBZGQgZGVwbG95bWVudCB0byBleGlzdGluZyB3b3JrZmxvd1xuICAgIGNvbnN0IGNtZHM6IHN0cmluZ1tdID0gW107XG4gICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVySW5zdGFsbENvbW1hbmRzKCkpO1xuICAgIGNtZHMucHVzaCguLi50aGlzLnJlbmRlckRlcGxveUNvbW1hbmRzKHN0YWdlLm5hbWUpKTtcbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogYGluZGVwbG95XyR7c3RhZ2UubmFtZX1gLFxuICAgICAgZGVwZW5kc09uOiBbZGVwZW5kc09uXSxcbiAgICAgIGlucHV0OiB7XG4gICAgICAgIFNvdXJjZXM6IFsnV29ya2Zsb3dTb3VyY2UnXSxcbiAgICAgICAgVmFyaWFibGVzOiB7XG4gICAgICAgICAgQ0k6ICd0cnVlJyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBzdGVwczpcbiAgICAgICAgY21kcyxcbiAgICAgIC8vIEZJWE1FIGlzIHRoZXJlIGlzIGFuIGVudmlyb25tZW50LCBjb25uZWN0IGl0IHRvIHRoZSB3b3JrZmxvd1xuICAgICAgLy8gbmVlZHMgdG8gcmVhY3Qgb24gdGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zPy5zeW50aFxuICAgICAgLy9lbnZpcm9ubWVudDogZW52aXJvbm1lbnQgJiYgY29udmVydFRvV29ya2Zsb3dFbnZpcm9ubWVudChlbnZpcm9ubWVudCksXG5cbiAgICAgIC8vIEZJWE1FIHdoYXQgYWJvdXQgdGhlIHBlcm1pc3Npb25zP1xuICAgICAgLy8gcGVybWlzc2lvbnM6IHsgaWRUb2tlbjogSm9iUGVybWlzc2lvbi5XUklURSwgY29udGVudHM6IEpvYlBlcm1pc3Npb24uUkVBRCB9LFxuXG4gICAgICBvdXRwdXQ6IHt9LFxuICAgIH0pO1xuICB9XG5cbn1cbiJdfQ==