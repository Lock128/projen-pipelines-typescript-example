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
const steps_1 = require("../steps");
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
        const steps = [];
        steps.push(...this.baseOptions.preInstallSteps ?? []);
        steps.push(new steps_1.SimpleCommandStep(this.project, this.renderInstallCommands()));
        steps.push(...this.baseOptions.preSynthSteps ?? []);
        steps.push(new steps_1.SimpleCommandStep(this.project, this.renderSynthCommands()));
        steps.push(...this.baseOptions.postSynthSteps ?? []);
        steps.push(new steps_1.UploadArtifactStep(this.project, {
            name: 'cloud-assembly',
            path: `${this.app.cdkConfig.cdkout}/`,
        }));
        const codeCatalystSteps = steps.map(s => s.toCodeCatalyst());
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
            steps: [...codeCatalystSteps.flatMap(s => s.commands)],
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29kZWNhdGFseXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2F3c2Nkay9jb2RlY2F0YWx5c3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSw0R0FBb0Y7QUFDcEYsc0dBQW1IO0FBQ25ILG1DQUEwQztBQUMxQyxpQ0FBMEU7QUFFMUUsd0RBQXFEO0FBQ3JELHNDQUEyQztBQUMzQyxvQ0FBK0U7QUErQy9FLE1BQWEsdUJBQXdCLFNBQVEsa0JBQVc7SUFVdEQsWUFBWSxHQUErQixFQUFVLE9BQXVDO1FBQzFGLEtBQUssQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFEK0IsWUFBTyxHQUFQLE9BQU8sQ0FBZ0M7UUFMcEYsaUJBQVksR0FBNkIsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUNuRCxxQkFBZ0IsR0FBYSxFQUFFLENBQUM7UUFNdEMsZ0VBQWdFO1FBQ2hFLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLEdBQUcsTUFBTSxDQUFDO1FBRTNDLElBQUksQ0FBQyxFQUFFLEdBQUcsSUFBSSxxQkFBUyxDQUFDLEVBQUUsTUFBTSxFQUFFLHlCQUF5QixFQUFFLENBQUMsQ0FBQztRQUUvRCxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDN0IsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDNUIsQ0FBQztRQUVELElBQUksQ0FBQyx5QkFBeUIsR0FBRyxJQUFJLCtDQUFlLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRTlELElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDakQsSUFBSSxDQUFDLHlCQUF5QixDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUUxRCxJQUFJLENBQUMsdUJBQXVCLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMs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SUFBSSxHQUFhLEVBQUUsQ0FBQztRQUMxQixJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUMsQ0FBQztRQUMzQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ3BELElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxjQUFjLENBQUM7WUFDNUMsVUFBVSxFQUFFLFlBQVksS0FBSyxDQUFDLElBQUksRUFBRTtZQUNwQyxTQUFTLEVBQUUsQ0FBQyxTQUFTLENBQUM7WUFDdEIsS0FBSyxFQUFFO2dCQUNMLE9BQU8sRUFBRSxDQUFDLGdCQUFnQixDQUFDO2dCQUMzQixTQUFTLEVBQUU7b0JBQ1QsRUFBRSxFQUFFLE1BQU07aUJBQ1g7YUFDRjtZQUNELEtBQUssRUFDSCxJQUFJO1lBQ04sK0RBQStEO1lBQy9ELG9EQUFvRDtZQUNwRCx3RUFBd0U7WUFFeEUsb0NBQW9DO1lBQ3BDLCtFQUErRTtZQUUvRSxNQUFNLEVBQUUsRUFBRTtTQUNYLENBQUMsQ0FBQztJQUNMLENBQUM7O0FBN1JILDBEQStSQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEVudmlyb25tZW50IH0gZnJvbSAnQGFtYXpvbi1jb2RlY2F0YWx5c3QvYmx1ZXByaW50LWNvbXBvbmVudC5lbnZpcm9ubWVudHMnO1xuaW1wb3J0IHsgY29udmVydFRvV29ya2Zsb3dFbnZpcm9ubWVudCwgV29ya2Zsb3dCdWlsZGVyIH0gZnJvbSAnQGFtYXpvbi1jb2RlY2F0YWx5c3QvYmx1ZXByaW50LWNvbXBvbmVudC53b3JrZmxvd3MnO1xuaW1wb3J0IHsgWWFtbEZpbGUsIGF3c2NkayB9IGZyb20gJ3Byb2plbic7XG5pbXBvcnQgeyBDREtQaXBlbGluZSwgQ0RLUGlwZWxpbmVPcHRpb25zLCBEZXBsb3ltZW50U3RhZ2UgfSBmcm9tICcuL2Jhc2UnO1xuXG5pbXBvcnQgeyBCbHVlcHJpbnQgfSBmcm9tICcuL2NvZGVjYXRhbHlzdC9ibHVlcHJpbnQnO1xuaW1wb3J0IHsgUGlwZWxpbmVFbmdpbmUgfSBmcm9tICcuLi9lbmdpbmUnO1xuaW1wb3J0IHsgUGlwZWxpbmVTdGVwLCBTaW1wbGVDb21tYW5kU3RlcCwgVXBsb2FkQXJ0aWZhY3RTdGVwIH0gZnJvbSAnLi4vc3RlcHMnO1xuXG4vKlxuTmVlZHMgdG8gY3JlYXRlOlxuLSBidWlsZC55bWwgKGNyZWF0ZXMgYW5kIG11dGF0ZXMgcGlwZWxpbmUgYnkgZXhlY3V0aW5nIHByb2plbiBidWlsZCkgLSBjb21lcyBmcm9tIHByb2plblxuLSBkZXBsb3kueWFtbCAoYnVpbGQgKyBkZXBsb3kgdG8gZGV2KVxuLSBwdWxsLXJlcXVlc3QtbGludC55bWwgKGV4ZWN1dGVzIGFtYW5ubi9hY3Rpb24tc2VtYW50aWMtcHVsbC1yZXF1ZXN0QHY1LjAuMikgLSBjb21lcyBmcm9tIHByb2plblxuLSByZWxlYXNlLXByb2QueWFtbCAoZGVwbG95IHRvIHByb2QgLSBub3QgcmVxdWlyZWQsIG1vdmUgb3ZlciB0byBcIm1hbnVhbCBhcHByb3ZhbHNcIiBpbiBkZXBsbylcbi0gdXBncmFkZS55YW1sICh1cGdyYWRlIGRlcGVuZGVuY2llcykgIC0gY29tZXMgZnJvbSBwcm9qZW5cblxuKiBzeW50aCAtPiBjcmVhdGUgYXJ0aWZhY3RzXG4qIHVwbG9hZCBjZGsgYXNzZXRzIC0+ICBzYXZlIGFzc2V0cyBpbiBzMyAobGFtYmRhKSwgYnVpbGQgY29udGFpbmVyIGltYWdlcyAocHVzaCB0byBFQ1IpIC0tIGV2ZXJ5dGhpbmcgaW4gQVdTXG4qIGRlcGxveSBmb3IgZWFjaCBzdGFnZSB0aGF0IGlzIG5vbi1wcm9kdWN0aW9uXG4qIGRlcGxveSB0byBwcm9kIChtYW51YWwgYXBwcm92YWwpXG5cblRPRE86XG4tIGFjY291bnQgdGFyZ2V0IC0tIE5PVCBQT1NTSUJMRSBhcyB3ZSBjYW5ub3QgY3JlYXRlIGVudmlyb25tZW50cy9hY2NvdW50cy90YXJnZXRzXG4tIG1hbnVhbCBhcHByb3ZhbCBmb3Igc3RhZ2VzIC0tIERPTkVcbi0gSUFNIHJvbGUgcGVyIHN0YWdlLCBzeW50aCwgYXNzZXQgLSBOT1QgUE9TU0lCTEUgYXMgd2UgY2Fubm90IGNyZWF0ZSBlbnZpcm9ubWVudHNcbi0gaW5kZXBlbmRlbmQgc3RhZ2VzIChhbGwgcGFyYWxsZWwgdG8gZWFjaCBvdGhlcikgYWZ0ZXIgc3ludGgmYXNzZXRzIC0tIERPTkVcbi0gZW52aXJvbm1lbnRzIHN1cHBvcnQgLSBET05FXG4tIHN0ZXBzIHBlciBzdGFnZSAtIHByZUluc3RhbGwsIHByZVN5bnRoLCAuLi5cblxuZXhhbXBsZTogaHR0cHM6Ly9naXRodWIuY29tL2F3cy1jb21tdW5pdHktZGFjaC9ldmVudC1zeXN0ZW0tYmFja2VuZFxuXG50ZXN0IGRvY2dlbjogaHR0cHM6Ly9naXRodWIuY29tL29wZW4tY29uc3RydWN0cy9hd3MtY2RrLWxpYnJhcnlcblxuXG4qL1xuXG5leHBvcnQgaW50ZXJmYWNlIENvZGVDYXRhbHlzdElhbVJvbGVDb25maWcge1xuICAvKiogRGVmYXVsdCBJQU0gcm9sZSBBUk4gdXNlZCBpZiBubyBzcGVjaWZpYyByb2xlIGlzIHByb3ZpZGVkLiAqL1xuICByZWFkb25seSBkZWZhdWx0Pzogc3RyaW5nO1xuICAvKiogSUFNIHJvbGUgQVJOIGZvciB0aGUgc3ludGhlc2lzIHN0ZXAuICovXG4gIHJlYWRvbmx5IHN5bnRoPzogc3RyaW5nO1xuICAvKiogSUFNIHJvbGUgQVJOIGZvciB0aGUgYXNzZXQgcHVibGlzaGluZyBzdGVwLiAqL1xuICByZWFkb25seSBhc3NldFB1Ymxpc2hpbmc/OiBzdHJpbmc7XG4gIC8qKiBJQU0gcm9sZSBBUk4gZm9yIHRoZSBhc3NldCBwdWJsaXNoaW5nIHN0ZXAgZm9yIGEgc3BlY2lmaWMgc3RhZ2UuICovXG4gIHJlYWRvbmx5IGFzc2V0UHVibGlzaGluZ1BlclN0YWdlPzogeyBbc3RhZ2U6IHN0cmluZ106IHN0cmluZyB9O1xuICAvKiogSUFNIHJvbGUgQVJOcyBmb3IgZGlmZmVyZW50IGRlcGxveW1lbnQgc3RhZ2VzLiAqL1xuICByZWFkb25seSBkZXBsb3ltZW50PzogeyBbc3RhZ2U6IHN0cmluZ106IHN0cmluZyB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvZGVDYXRhbHlzdENES1BpcGVsaW5lT3B0aW9ucyBleHRlbmRzIENES1BpcGVsaW5lT3B0aW9ucyB7XG4gIHJlYWRvbmx5IGlhbVJvbGVBcm5zOiBDb2RlQ2F0YWx5c3RJYW1Sb2xlQ29uZmlnO1xufVxuXG5leHBvcnQgY2xhc3MgQ29kZUNhdGFseXN0Q0RLUGlwZWxpbmUgZXh0ZW5kcyBDREtQaXBlbGluZSB7XG5cbiAgcHVibGljIHJlYWRvbmx5IG5lZWRzVmVyc2lvbmVkQXJ0aWZhY3RzOiBib29sZWFuO1xuXG4gIHByaXZhdGUgZGVwbG95bWVudFdvcmtmbG93QnVpbGRlcjogV29ya2Zsb3dCdWlsZGVyO1xuICBwcml2YXRlIGVudmlyb25tZW50czogTWFwPFN0cmluZywgRW52aXJvbm1lbnQ+ID0gbmV3IE1hcCgpO1xuICBwcml2YXRlIGRlcGxveW1lbnRTdGFnZXM6IHN0cmluZ1tdID0gW107XG5cbiAgcHJpdmF0ZSByZWFkb25seSBicDogQmx1ZXByaW50O1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogYXdzY2RrLkF3c0Nka1R5cGVTY3JpcHRBcHAsIHByaXZhdGUgb3B0aW9uczogQ29kZUNhdGFseXN0Q0RLUGlwZWxpbmVPcHRpb25zKSB7XG4gICAgc3VwZXIoYXBwLCBvcHRpb25zKTtcbiAgICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2F3cy9jb2RlY2F0YWx5c3QtYmx1ZXByaW50cy9pc3N1ZXMvNDc3XG4gICAgcHJvY2Vzcy5lbnYuQ09OVEVYVF9FTlZJUk9OTUVOVElEID0gJ3Byb2QnO1xuXG4gICAgdGhpcy5icCA9IG5ldyBCbHVlcHJpbnQoeyBvdXRkaXI6ICcuY29kZWNhdGFseXN0L3dvcmtmbG93cycgfSk7XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zKSB7XG4gICAgICB0aGlzLmNyZWF0ZUVudmlyb25tZW50cygpO1xuICAgIH1cblxuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93QnVpbGRlciA9IG5ldyBXb3JrZmxvd0J1aWxkZXIodGhpcy5icCk7XG5cbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuc2V0TmFtZSgnZGVwbG95Jyk7XG4gICAgdGhpcy5kZXBsb3ltZW50V29ya2Zsb3dCdWlsZGVyLmFkZEJyYW5jaFRyaWdnZXIoWydtYWluJ10pO1xuXG4gICAgdGhpcy5uZWVkc1ZlcnNpb25lZEFydGlmYWN0cyA9IHRoaXMub3B0aW9ucy5zdGFnZXMuZmluZChzID0+IHMubWFudWFsQXBwcm92YWwgPT09IHRydWUpICE9PSB1bmRlZmluZWQ7XG5cbiAgICB0aGlzLmNyZWF0ZVN5bnRoKCk7XG4gICAgdGhpcy5jcmVhdGVBc3NldFVwbG9hZCgpO1xuXG4gICAgZm9yIChjb25zdCBzdGFnZSBvZiBvcHRpb25zLnN0YWdlcykge1xuICAgICAgdGhpcy5jcmVhdGVEZXBsb3ltZW50KHN0YWdlKTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHN0YWdlIG9mIChvcHRpb25zLmluZGVwZW5kZW50U3RhZ2VzID8/IFtdKSkge1xuICAgICAgdGhpcy5jcmVhdGVJbmRlcGVuZGVudERlcGxveW1lbnQoc3RhZ2UpO1xuICAgIH1cblxuICAgIGNvbnN0IHltbCA9IG5ldyBZYW1sRmlsZSh0aGlzLCAnLmNvZGVjYXRhbHlzdC93b3JrZmxvd3MvZGVwbG95LnlhbWwnLCB7XG4gICAgICBvYmo6IHRoaXMuZGVwbG95bWVudFdvcmtmbG93QnVpbGRlci5nZXREZWZpbml0aW9uKCksXG5cbiAgICB9KTtcbiAgICB5bWwuc3ludGhlc2l6ZSgpO1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZUVudmlyb25tZW50cygpIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zLmRlZmF1bHQpIHtcbiAgICAgIHRoaXMuZW52aXJvbm1lbnRzLnNldCgnZGVmYXVsdCcsXG4gICAgICAgIG5ldyBFbnZpcm9ubWVudCh0aGlzLmJwLCB7XG4gICAgICAgICAgZW52aXJvbm1lbnRUeXBlOiAnREVWRUxPUE1FTlQnLFxuICAgICAgICAgIG5hbWU6ICdkZWZhdWx0JyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ2RlZmF1bHQgZGVwbG95bWVudCBlbnZpcm9ubWVudCcsXG4gICAgICAgICAgYXdzQWNjb3VudDoge1xuICAgICAgICAgICAgaWQ6ICdkZWZhdWx0JyxcbiAgICAgICAgICAgIG5hbWU6ICdhd3NBY2NvdW50JyxcbiAgICAgICAgICAgIGF3c0FjY291bnQ6IHsgbmFtZTogJ2RlZmF1bHQtcm9sZScsIGFybjogdGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zLmRlZmF1bHQgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucy5zeW50aCkge1xuICAgICAgdGhpcy5lbnZpcm9ubWVudHMuc2V0KCdzeW50aCcsXG4gICAgICAgIG5ldyBFbnZpcm9ubWVudCh0aGlzLmJwLCB7XG4gICAgICAgICAgZW52aXJvbm1lbnRUeXBlOiAnREVWRUxPUE1FTlQnLFxuICAgICAgICAgIG5hbWU6ICdzeW50aCcsXG4gICAgICAgICAgZGVzY3JpcHRpb246ICdzeW50aCBkZXBsb3ltZW50IGVudmlyb25tZW50JyxcbiAgICAgICAgICBhd3NBY2NvdW50OiB7XG4gICAgICAgICAgICBpZDogJ3N5bnRoJyxcbiAgICAgICAgICAgIG5hbWU6ICdhd3NBY2NvdW50JyxcbiAgICAgICAgICAgIGF3c0FjY291bnQ6IHsgbmFtZTogJ3N5bnRoLXJvbGUnLCBhcm46IHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucy5zeW50aCB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zLmFzc2V0UHVibGlzaGluZykge1xuICAgICAgdGhpcy5lbnZpcm9ubWVudHMuc2V0KCdhc3NldFB1Ymxpc2hpbmcnLFxuICAgICAgICBuZXcgRW52aXJvbm1lbnQodGhpcy5icCwge1xuICAgICAgICAgIGVudmlyb25tZW50VHlwZTogJ0RFVkVMT1BNRU5UJyxcbiAgICAgICAgICBuYW1lOiAnYXNzZXRQdWJsaXNoaW5nJyxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ2Fzc2V0IHB1Ymxpc2hpbmcgZGVwbG95bWVudCBlbnZpcm9ubWVudCcsXG4gICAgICAgICAgYXdzQWNjb3VudDoge1xuICAgICAgICAgICAgaWQ6ICdhc3NldFB1Ymxpc2hpbmcnLFxuICAgICAgICAgICAgbmFtZTogJ2F3c0FjY291bnQnLFxuICAgICAgICAgICAgYXdzQWNjb3VudDogeyBuYW1lOiAnYXNzZXRQdWJsaXNoaW5nLXJvbGUnLCBhcm46IHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucy5hc3NldFB1Ymxpc2hpbmcgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucy5hc3NldFB1Ymxpc2hpbmdQZXJTdGFnZSkge1xuICAgICAgZm9yIChjb25zdCBbc3RhZ2UsIGFybl0gb2YgT2JqZWN0LmVudHJpZXModGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zLmFzc2V0UHVibGlzaGluZ1BlclN0YWdlKSkge1xuICAgICAgICB0aGlzLmVudmlyb25tZW50cy5zZXQoYCR7c3RhZ2V9QXNzZXRQdWJsaXNoaW5nYCxcbiAgICAgICAgICBuZXcgRW52aXJvbm1lbnQodGhpcy5icCwge1xuICAgICAgICAgICAgZW52aXJvbm1lbnRUeXBlOiAnREVWRUxPUE1FTlQnLFxuICAgICAgICAgICAgbmFtZTogYCR7c3RhZ2V9QXNzZXRQdWJsaXNoaW5nUGVyU3RhZ2VgLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGAke3N0YWdlfSBhc3NldCBwdWJsaXNoaW5nIGRlcGxveW1lbnQgZW52aXJvbm1lbnRgLFxuICAgICAgICAgICAgYXdzQWNjb3VudDoge1xuICAgICAgICAgICAgICBpZDogYCR7c3RhZ2V9QXNzZXRQdWJsaXNoaW5nUGVyU3RhZ2VgLFxuICAgICAgICAgICAgICBuYW1lOiAnYXdzQWNjb3VudCcsXG4gICAgICAgICAgICAgIGF3c0FjY291bnQ6IHsgbmFtZTogYCR7c3RhZ2V9LXJvbGVgLCBhcm46IGFybiB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucy5kZXBsb3ltZW50KSB7XG4gICAgICBmb3IgKGNvbnN0IFtzdGFnZSwgYXJuXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnMuZGVwbG95bWVudCkpIHtcbiAgICAgICAgdGhpcy5lbnZpcm9ubWVudHMuc2V0KHN0YWdlLFxuICAgICAgICAgIG5ldyBFbnZpcm9ubWVudCh0aGlzLmJwLCB7XG4gICAgICAgICAgICBlbnZpcm9ubWVudFR5cGU6ICdERVZFTE9QTUVOVCcsXG4gICAgICAgICAgICBuYW1lOiBzdGFnZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgJHtzdGFnZX0gZGVwbG95bWVudCBlbnZpcm9ubWVudGAsXG4gICAgICAgICAgICBhd3NBY2NvdW50OiB7XG4gICAgICAgICAgICAgIGlkOiBzdGFnZSxcbiAgICAgICAgICAgICAgbmFtZTogJ2F3c0FjY291bnQnLFxuICAgICAgICAgICAgICBhd3NBY2NvdW50OiB7IG5hbWU6IGAke3N0YWdlfS1yb2xlYCwgYXJuOiBhcm4gfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKiB0aGUgdHlwZSBvZiBlbmdpbmUgdGhpcyBpbXBsZW1lbnRhdGlvbiBvZiBDREtQaXBlbGluZSBpcyBmb3IgKi9cbiAgcHVibGljIGVuZ2luZVR5cGUoKTogUGlwZWxpbmVFbmdpbmUge1xuICAgIHJldHVybiBQaXBlbGluZUVuZ2luZS5DT0RFX0NBVEFMWVNUO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVTeW50aCgpOiB2b2lkIHtcbiAgICBjb25zdCBzdGVwczogUGlwZWxpbmVTdGVwW10gPSBbXTtcblxuICAgIHN0ZXBzLnB1c2goLi4udGhpcy5iYXNlT3B0aW9ucy5wcmVJbnN0YWxsU3RlcHMgPz8gW10pO1xuICAgIHN0ZXBzLnB1c2gobmV3IFNpbXBsZUNvbW1hbmRTdGVwKHRoaXMucHJvamVjdCwgdGhpcy5yZW5kZXJJbnN0YWxsQ29tbWFuZHMoKSkpO1xuXG4gICAgc3RlcHMucHVzaCguLi50aGlzLmJhc2VPcHRpb25zLnByZVN5bnRoU3RlcHMgPz8gW10pO1xuICAgIHN0ZXBzLnB1c2gobmV3IFNpbXBsZUNvbW1hbmRTdGVwKHRoaXMucHJvamVjdCwgdGhpcy5yZW5kZXJTeW50aENvbW1hbmRzKCkpKTtcbiAgICBzdGVwcy5wdXNoKC4uLnRoaXMuYmFzZU9wdGlvbnMucG9zdFN5bnRoU3RlcHMgPz8gW10pO1xuXG4gICAgc3RlcHMucHVzaChuZXcgVXBsb2FkQXJ0aWZhY3RTdGVwKHRoaXMucHJvamVjdCwge1xuICAgICAgbmFtZTogJ2Nsb3VkLWFzc2VtYmx5JyxcbiAgICAgIHBhdGg6IGAke3RoaXMuYXBwLmNka0NvbmZpZy5jZGtvdXR9L2AsXG4gICAgfSkpO1xuXG4gICAgY29uc3QgY29kZUNhdGFseXN0U3RlcHMgPSBzdGVwcy5tYXAocyA9PiBzLnRvQ29kZUNhdGFseXN0KCkpO1xuXG4gICAgY29uc3QgY21kczogc3RyaW5nW10gPSBbXTtcbiAgICBjbWRzLnB1c2goLi4udGhpcy5yZW5kZXJJbnN0YWxsQ29tbWFuZHMoKSk7XG4gICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVyU3ludGhDb21tYW5kcygpKTtcbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogJ1N5bnRoQ0RLQXBwbGljYXRpb24nLFxuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgU291cmNlczogWydXb3JrZmxvd1NvdXJjZSddLFxuICAgICAgICBWYXJpYWJsZXM6IHtcbiAgICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHN0ZXBzOlxuICAgICAgWy4uLmNvZGVDYXRhbHlzdFN0ZXBzLmZsYXRNYXAocyA9PiBzLmNvbW1hbmRzKV0sXG4gICAgICAvLyBGSVhNRSBpcyB0aGVyZSBpcyBhbiBlbnZpcm9ubWVudCwgY29ubmVjdCBpdCB0byB0aGUgd29ya2Zsb3dcbiAgICAgIC8vIG5lZWRzIHRvIHJlYWN0IG9uIHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucz8uc3ludGhcbiAgICAgIC8vZW52aXJvbm1lbnQ6IGVudmlyb25tZW50ICYmIGNvbnZlcnRUb1dvcmtmbG93RW52aXJvbm1lbnQoZW52aXJvbm1lbnQpLFxuXG4gICAgICAvLyBGSVhNRSB3aGF0IGFib3V0IHRoZSBwZXJtaXNzaW9ucz9cbiAgICAgIC8vIHBlcm1pc3Npb25zOiB7IGlkVG9rZW46IEpvYlBlcm1pc3Npb24uV1JJVEUsIGNvbnRlbnRzOiBKb2JQZXJtaXNzaW9uLlJFQUQgfSxcbiAgICAgIGVudmlyb25tZW50OiBjb252ZXJ0VG9Xb3JrZmxvd0Vudmlyb25tZW50KHRoaXMuZW52aXJvbm1lbnRzLmdldCgnZGVmYXVsdCcpKSxcbiAgICAgIG91dHB1dDoge30sXG4gICAgfSk7XG5cbiAgICAvKlxubm90IHJlcXVpcmVkIGJlY2F1c2UgY29kZWNhdGFseXN0IGF1dG9tYXRpY2FsbHkgdXBsb2FkcyBhcnRpZmFjdHNcbkZJWE1FIG9yIGRvIHdlIG5lZWQgdG8gY3JlYXRlIFwiYXJ0aWZhY3RzXCIgaGVyZSBhbmQgdXBsb2FkP1xuc3RlcHMucHVzaCh7XG4gICAgICB1c2VzOiAnYWN0aW9ucy91cGxvYWQtYXJ0aWZhY3RAdjMnLFxuICAgICAgd2l0aDoge1xuICAgICAgICBuYW1lOiAnY2xvdWQtYXNzZW1ibHknLFxuICAgICAgICBwYXRoOiBgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fS9gLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICAqL1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZUFzc2V0VXBsb2FkKCk6IHZvaWQge1xuXG4gICAgY29uc3QgY21kczogc3RyaW5nW10gPSBbXTtcbiAgICBjbWRzLnB1c2goLi4udGhpcy5yZW5kZXJBc3NldFVwbG9hZENvbW1hbmRzKCkpO1xuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93QnVpbGRlci5hZGRCdWlsZEFjdGlvbih7XG4gICAgICBhY3Rpb25OYW1lOiAnUHVibGlzaEFzc2V0c1RvQVdTJyxcbiAgICAgIGRlcGVuZHNPbjogWydTeW50aENES0FwcGxpY2F0aW9uJ10sXG4gICAgICBpbnB1dDoge1xuICAgICAgICBTb3VyY2VzOiBbJ1dvcmtmbG93U291cmNlJ10sXG4gICAgICAgIFZhcmlhYmxlczoge1xuICAgICAgICAgIENJOiAndHJ1ZScsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgc3RlcHM6XG4gICAgICAgIGNtZHMsXG4gICAgICAvLyBGSVhNRSBpcyB0aGVyZSBpcyBhbiBlbnZpcm9ubWVudCwgY29ubmVjdCBpdCB0byB0aGUgd29ya2Zsb3dcbiAgICAgIC8vIG5lZWRzIHRvIHJlYWN0IG9uIHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucz8uc3ludGhcbiAgICAgIC8vZW52aXJvbm1lbnQ6IGVudmlyb25tZW50ICYmIGNvbnZlcnRUb1dvcmtmbG93RW52aXJvbm1lbnQoZW52aXJvbm1lbnQpLFxuXG4gICAgICAvLyBGSVhNRSB3aGF0IGFib3V0IHRoZSBwZXJtaXNzaW9ucz9cbiAgICAgIC8vIHBlcm1pc3Npb25zOiB7IGlkVG9rZW46IEpvYlBlcm1pc3Npb24uV1JJVEUsIGNvbnRlbnRzOiBKb2JQZXJtaXNzaW9uLlJFQUQgfSxcblxuICAgICAgb3V0cHV0OiB7fSxcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVEZXBsb3ltZW50KHN0YWdlOiBEZXBsb3ltZW50U3RhZ2UpOiB2b2lkIHtcbiAgICBsZXQgZGVwZW5kc09uID0gYGRlcGxveV8ke3RoaXMuZGVwbG95bWVudFN0YWdlcy5hdCgtMSkhfWA7XG4gICAgaWYgKHN0YWdlLm1hbnVhbEFwcHJvdmFsID09PSB0cnVlKSB7XG4gICAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkR2VuZXJpY0FjdGlvbih7XG4gICAgICAgIElkZW50aWZpZXI6ICdhd3MvYXBwcm92YWxAdjEnLFxuICAgICAgICBhY3Rpb25OYW1lOiBgYXBwcm92ZV8ke3N0YWdlLm5hbWV9YCxcbiAgICAgICAgRGVwZW5kc09uOiBbYGRlcGxveV8ke3RoaXMuZGVwbG95bWVudFN0YWdlcy5hdCgtMSkhfWBdLFxuICAgICAgICBDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgQXBwcm92YWxzUmVxdWlyZWQ6IDEsXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGRlcGVuZHNPbiA9IGBhcHByb3ZlXyR7c3RhZ2UubmFtZX1gO1xuICAgIH1cbiAgICAvLyBBZGQgZGVwbG95bWVudCB0byBleGlzdGluZyB3b3JrZmxvd1xuICAgIGNvbnN0IGNtZHM6IHN0cmluZ1tdID0gW107XG4gICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVySW5zdGFsbENvbW1hbmRzKCkpO1xuICAgIGNtZHMucHVzaCguLi50aGlzLnJlbmRlckRlcGxveUNvbW1hbmRzKHN0YWdlLm5hbWUpKTtcbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogYGRlcGxveV8ke3N0YWdlLm5hbWV9YCxcbiAgICAgIGRlcGVuZHNPbjogdGhpcy5kZXBsb3ltZW50U3RhZ2VzLmxlbmd0aCA+IDAgPyBbJ1B1Ymxpc2hBc3NldHNUb0FXUycsIGRlcGVuZHNPbl0gOiBbJ1B1Ymxpc2hBc3NldHNUb0FXUyddLFxuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgU291cmNlczogWydXb3JrZmxvd1NvdXJjZSddLFxuICAgICAgICBWYXJpYWJsZXM6IHtcbiAgICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHN0ZXBzOlxuICAgICAgICBjbWRzLFxuICAgICAgLy8gRklYTUUgaXMgdGhlcmUgaXMgYW4gZW52aXJvbm1lbnQsIGNvbm5lY3QgaXQgdG8gdGhlIHdvcmtmbG93XG4gICAgICAvLyBuZWVkcyB0byByZWFjdCBvbiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LnN5bnRoXG4gICAgICAvL2Vudmlyb25tZW50OiBlbnZpcm9ubWVudCAmJiBjb252ZXJ0VG9Xb3JrZmxvd0Vudmlyb25tZW50KGVudmlyb25tZW50KSxcblxuICAgICAgLy8gRklYTUUgd2hhdCBhYm91dCB0aGUgcGVybWlzc2lvbnM/XG4gICAgICAvLyBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG5cbiAgICAgIG91dHB1dDoge30sXG4gICAgICBlbnZpcm9ubWVudDogY29udmVydFRvV29ya2Zsb3dFbnZpcm9ubWVudCh0aGlzLmVudmlyb25tZW50cy5nZXQoc3RhZ2UubmFtZSkpLFxuICAgIH0pO1xuXG4gICAgdGhpcy5kZXBsb3ltZW50U3RhZ2VzLnB1c2goc3RhZ2UubmFtZSk7XG4gIH1cblxuICBwdWJsaWMgY3JlYXRlSW5kZXBlbmRlbnREZXBsb3ltZW50KHN0YWdlOiBEZXBsb3ltZW50U3RhZ2UpOiB2b2lkIHtcbiAgICBsZXQgZGVwZW5kc09uID0gJ1B1Ymxpc2hBc3NldHNUb0FXUyc7XG4gICAgaWYgKHN0YWdlLm1hbnVhbEFwcHJvdmFsID09PSB0cnVlKSB7XG4gICAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkR2VuZXJpY0FjdGlvbih7XG4gICAgICAgIElkZW50aWZpZXI6ICdhd3MvYXBwcm92YWxAdjEnLFxuICAgICAgICBhY3Rpb25OYW1lOiBgYXBwcm92ZV8ke3N0YWdlLm5hbWV9YCxcbiAgICAgICAgRGVwZW5kc09uOiBbYGRlcGxveV8ke3RoaXMuZGVwbG95bWVudFN0YWdlcy5hdCgtMSkhfWBdLFxuICAgICAgICBDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgQXBwcm92YWxzUmVxdWlyZWQ6IDEsXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGRlcGVuZHNPbiA9IGBhcHByb3ZlXyR7c3RhZ2UubmFtZX1gO1xuICAgIH1cbiAgICAvLyBBZGQgZGVwbG95bWVudCB0byBleGlzdGluZyB3b3JrZmxvd1xuICAgIGNvbnN0IGNtZHM6IHN0cmluZ1tdID0gW107XG4gICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVySW5zdGFsbENvbW1hbmRzKCkpO1xuICAgIGNtZHMucHVzaCguLi50aGlzLnJlbmRlckRlcGxveUNvbW1hbmRzKHN0YWdlLm5hbWUpKTtcbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogYGluZGVwbG95XyR7c3RhZ2UubmFtZX1gLFxuICAgICAgZGVwZW5kc09uOiBbZGVwZW5kc09uXSxcbiAgICAgIGlucHV0OiB7XG4gICAgICAgIFNvdXJjZXM6IFsnV29ya2Zsb3dTb3VyY2UnXSxcbiAgICAgICAgVmFyaWFibGVzOiB7XG4gICAgICAgICAgQ0k6ICd0cnVlJyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBzdGVwczpcbiAgICAgICAgY21kcyxcbiAgICAgIC8vIEZJWE1FIGlzIHRoZXJlIGlzIGFuIGVudmlyb25tZW50LCBjb25uZWN0IGl0IHRvIHRoZSB3b3JrZmxvd1xuICAgICAgLy8gbmVlZHMgdG8gcmVhY3Qgb24gdGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zPy5zeW50aFxuICAgICAgLy9lbnZpcm9ubWVudDogZW52aXJvbm1lbnQgJiYgY29udmVydFRvV29ya2Zsb3dFbnZpcm9ubWVudChlbnZpcm9ubWVudCksXG5cbiAgICAgIC8vIEZJWE1FIHdoYXQgYWJvdXQgdGhlIHBlcm1pc3Npb25zP1xuICAgICAgLy8gcGVybWlzc2lvbnM6IHsgaWRUb2tlbjogSm9iUGVybWlzc2lvbi5XUklURSwgY29udGVudHM6IEpvYlBlcm1pc3Npb24uUkVBRCB9LFxuXG4gICAgICBvdXRwdXQ6IHt9LFxuICAgIH0pO1xuICB9XG5cbn1cbiJdfQ==