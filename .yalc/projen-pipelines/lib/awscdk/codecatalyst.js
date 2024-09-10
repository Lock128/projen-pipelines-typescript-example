"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeCatalystCDKPipeline = void 0;
const JSII_RTTI_SYMBOL_1 = Symbol.for("jsii.rtti");
const blueprint_component_workflows_1 = require("@amazon-codecatalyst/blueprint-component.workflows");
const projen_1 = require("projen");
const base_1 = require("./base");
const blueprint_1 = require("./codecatalyst/blueprint");
const engine_1 = require("../engine");
class CodeCatalystCDKPipeline extends base_1.CDKPipeline {
    constructor(app, options) {
        super(app, options);
        this.options = options;
        this.deploymentStages = [];
        // see https://github.com/aws/codecatalyst-blueprints/issues/477
        process.env.CONTEXT_ENVIRONMENTID = 'prod';
        this.bp = new blueprint_1.Blueprint({ outdir: '.codecatalyst/workflows' });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29kZWNhdGFseXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2F3c2Nkay9jb2RlY2F0YWx5c3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxzR0FBcUY7QUFDckYsbUNBQTBDO0FBQzFDLGlDQUEwRTtBQUUxRSx3REFBcUQ7QUFDckQsc0NBQTJDO0FBeUMzQyxNQUFhLHVCQUF3QixTQUFRLGtCQUFXO0lBU3RELFlBQVksR0FBK0IsRUFBVSxPQUF1QztRQUMxRixLQUFLLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBRCtCLFlBQU8sR0FBUCxPQUFPLENBQWdDO1FBSnBGLHFCQUFnQixHQUFhLEVBQUUsQ0FBQztRQU10QyxnRUFBZ0U7UUFDaEUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsR0FBQyxNQUFNLENBQUM7UUFFekMsSUFBSSxDQUFDLEVBQUUsR0FBRyxJQUFJLHFCQUFTLENBQUMsRUFBRSxNQUFNLEVBQUUseUJBQXlCLEVBQUUsQ0FBQyxDQUFDO1FBQy9ELElBQUksQ0FBQyx5QkFBeUIsR0FBRyxJQUFJLCtDQUFlLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRTlELElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDakQsSUFBSSxDQUFDLHlCQUF5QixDQUFDLGdCQUFnQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUUxRCxJQUFJLENBQUMsdUJBQXVCLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLGNBQWMsS0FBSyxJQUFJLENBQUMsS0FBSyxTQUFTLENBQUM7UUFFdEcsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ25CLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBRXpCLEtBQUssTUFBTSxLQUFLLElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ25DLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMvQixDQUFDO1FBRUQsS0FBSyxNQUFNLEtBQUssSUFBSSxDQUFDLE9BQU8sQ0FBQyxpQkFBaUIsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQ3RELElBQUksQ0FBQywyQkFBMkIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMxQyxDQUFDO1FBRUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxpQkFBUSxDQUFDLElBQUksRUFBRSxxQ0FBcUMsRUFBRTtZQUNwRSxHQUFHLEVBQUUsSUFBSSxDQUFDLHlCQUF5QixDQUFDLGFBQWEsRUFBRTtTQUVwRCxDQUFDLENBQUM7UUFDSCxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDbkIsQ0FBQztJQUVELG1FQUFtRTtJQUM1RCxVQUFVO1FBQ2YsT0FBTyx1QkFBYyxDQUFDLGFBQWEsQ0FBQztJQUN0QyxDQUFDO0lBRU8sV0FBVztRQUVqQixNQUFNLElBQUksR0FBYSxFQUFFLENBQUM7UUFDMUIsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDLENBQUM7UUFDM0MsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDLENBQUM7UUFDekMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLGNBQWMsQ0FBQztZQUM1QyxVQUFVLEVBQUUscUJBQXFCO1lBQ2pDLEtBQUssRUFBRTtnQkFDTCxPQUFPLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDM0IsU0FBUyxFQUFFO29CQUNULEVBQUUsRUFBRSxNQUFNO2lCQUNYO2FBQ0Y7WUFDRCxLQUFLLEVBQ0gsSUFBSTtZQUNOLCtEQUErRDtZQUMvRCxvREFBb0Q7WUFDcEQsd0VBQXdFO1lBRXhFLG9DQUFvQztZQUNwQywrRUFBK0U7WUFFL0UsTUFBTSxFQUFFLEVBQUU7U0FDWCxDQUFDLENBQUM7UUFFSDs7Ozs7Ozs7OztVQVVFO0lBQ0osQ0FBQztJQUVNLGlCQUFpQjtRQUV0QixNQUFNLElBQUksR0FBYSxFQUFFLENBQUM7UUFDMUIsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyx5QkFBeUIsRUFBRSxDQUFDLENBQUM7UUFDL0MsSUFBSSxDQUFDLHlCQUF5QixDQUFDLGNBQWMsQ0FBQztZQUM1QyxVQUFVLEVBQUUsb0JBQW9CO1lBQ2hDLFNBQVMsRUFBRSxDQUFDLHFCQUFxQixDQUFDO1lBQ2xDLEtBQUssRUFBRTtnQkFDTCxPQUFPLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDM0IsU0FBUyxFQUFFO29CQUNULEVBQUUsRUFBRSxNQUFNO2lCQUNYO2FBQ0Y7WUFDRCxLQUFLLEVBQ0gsSUFBSTtZQUNOLCtEQUErRDtZQUMvRCxvREFBb0Q7WUFDcEQsd0VBQXdFO1lBRXhFLG9DQUFvQztZQUNwQywrRUFBK0U7WUFFL0UsTUFBTSxFQUFFLEVBQUU7U0FDWCxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU0sZ0JBQWdCLENBQUMsS0FBc0I7UUFDNUMsSUFBSSxTQUFTLEdBQUcsVUFBVSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFFLEVBQUUsQ0FBQztRQUMxRCxJQUFJLEtBQUssQ0FBQyxjQUFjLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDbEMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLGdCQUFnQixDQUFDO2dCQUM5QyxVQUFVLEVBQUUsaUJBQWlCO2dCQUM3QixVQUFVLEVBQUUsV0FBVyxLQUFLLENBQUMsSUFBSSxFQUFFO2dCQUNuQyxTQUFTLEVBQUUsQ0FBQyxVQUFVLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUUsRUFBRSxDQUFDO2dCQUN0RCxhQUFhLEVBQUU7b0JBQ2IsaUJBQWlCLEVBQUUsQ0FBQztpQkFDckI7YUFDRixDQUFDLENBQUM7WUFDSCxTQUFTLEdBQUcsV0FBVyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDdEMsQ0FBQztRQUNELHNDQUFzQztRQUN0QyxNQUFNLElBQUksR0FBYSxFQUFFLENBQUM7UUFDMUIsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDLENBQUM7UUFDM0MsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNwRCxJQUFJLENBQUMseUJBQXlCLENBQUMsY0FBYyxDQUFDO1lBQzVDLFVBQVUsRUFBRSxVQUFVLEtBQUssQ0FBQyxJQUFJLEVBQUU7WUFDbEMsU0FBUyxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLG9CQUFvQixFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLG9CQUFvQixDQUFDO1lBQ3hHLEtBQUssRUFBRTtnQkFDTCxPQUFPLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDM0IsU0FBUyxFQUFFO29CQUNULEVBQUUsRUFBRSxNQUFNO2lCQUNYO2FBQ0Y7WUFDRCxLQUFLLEVBQ0gsSUFBSTtZQUNOLCtEQUErRDtZQUMvRCxvREFBb0Q7WUFDcEQsd0VBQXdFO1lBRXhFLG9DQUFvQztZQUNwQywrRUFBK0U7WUFFL0UsTUFBTSxFQUFFLEVBQUU7U0FDWCxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN6QyxDQUFDO0lBRU0sMkJBQTJCLENBQUMsS0FBc0I7UUFDdkQsSUFBSSxTQUFTLEdBQUcsb0JBQW9CLENBQUM7UUFDckMsSUFBSSxLQUFLLENBQUMsY0FBYyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ2xDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDOUMsVUFBVSxFQUFFLGlCQUFpQjtnQkFDN0IsVUFBVSxFQUFFLFdBQVcsS0FBSyxDQUFDLElBQUksRUFBRTtnQkFDbkMsU0FBUyxFQUFFLENBQUMsVUFBVSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFFLEVBQUUsQ0FBQztnQkFDdEQsYUFBYSxFQUFFO29CQUNiLGlCQUFpQixFQUFFLENBQUM7aUJBQ3JCO2FBQ0YsQ0FBQyxDQUFDO1lBQ0gsU0FBUyxHQUFHLFdBQVcsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3RDLENBQUM7UUFDRCxzQ0FBc0M7UUFDdEMsTUFBTSxJQUFJLEdBQWEsRUFBRSxDQUFDO1FBQzFCLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQyxDQUFDO1FBQzNDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDcEQsSUFBSSxDQUFDLHlCQUF5QixDQUFDLGNBQWMsQ0FBQztZQUM1QyxVQUFVLEVBQUUsWUFBWSxLQUFLLENBQUMsSUFBSSxFQUFFO1lBQ3BDLFNBQVMsRUFBRSxDQUFDLFNBQVMsQ0FBQztZQUN0QixLQUFLLEVBQUU7Z0JBQ0wsT0FBTyxFQUFFLENBQUMsZ0JBQWdCLENBQUM7Z0JBQzNCLFNBQVMsRUFBRTtvQkFDVCxFQUFFLEVBQUUsTUFBTTtpQkFDWDthQUNGO1lBQ0QsS0FBSyxFQUNILElBQUk7WUFDTiwrREFBK0Q7WUFDL0Qsb0RBQW9EO1lBQ3BELHdFQUF3RTtZQUV4RSxvQ0FBb0M7WUFDcEMsK0VBQStFO1lBRS9FLE1BQU0sRUFBRSxFQUFFO1NBQ1gsQ0FBQyxDQUFDO0lBQ0wsQ0FBQzs7QUEzTEgsMERBNkxDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgV29ya2Zsb3dCdWlsZGVyIH0gZnJvbSAnQGFtYXpvbi1jb2RlY2F0YWx5c3QvYmx1ZXByaW50LWNvbXBvbmVudC53b3JrZmxvd3MnO1xuaW1wb3J0IHsgWWFtbEZpbGUsIGF3c2NkayB9IGZyb20gJ3Byb2plbic7XG5pbXBvcnQgeyBDREtQaXBlbGluZSwgQ0RLUGlwZWxpbmVPcHRpb25zLCBEZXBsb3ltZW50U3RhZ2UgfSBmcm9tICcuL2Jhc2UnO1xuXG5pbXBvcnQgeyBCbHVlcHJpbnQgfSBmcm9tICcuL2NvZGVjYXRhbHlzdC9ibHVlcHJpbnQnO1xuaW1wb3J0IHsgUGlwZWxpbmVFbmdpbmUgfSBmcm9tICcuLi9lbmdpbmUnO1xuXG4vKlxuTmVlZHMgdG8gY3JlYXRlOlxuLSBidWlsZC55bWwgKGNyZWF0ZXMgYW5kIG11dGF0ZXMgcGlwZWxpbmUgYnkgZXhlY3V0aW5nIHByb2plbiBidWlsZCkgLSBjb21lcyBmcm9tIHByb2plblxuLSBkZXBsb3kueWFtbCAoYnVpbGQgKyBkZXBsb3kgdG8gZGV2KVxuLSBwdWxsLXJlcXVlc3QtbGludC55bWwgKGV4ZWN1dGVzIGFtYW5ubi9hY3Rpb24tc2VtYW50aWMtcHVsbC1yZXF1ZXN0QHY1LjAuMikgLSBjb21lcyBmcm9tIHByb2plblxuLSByZWxlYXNlLXByb2QueWFtbCAoZGVwbG95IHRvIHByb2QgLSBub3QgcmVxdWlyZWQsIG1vdmUgb3ZlciB0byBcIm1hbnVhbCBhcHByb3ZhbHNcIiBpbiBkZXBsbylcbi0gdXBncmFkZS55YW1sICh1cGdyYWRlIGRlcGVuZGVuY2llcykgIC0gY29tZXMgZnJvbSBwcm9qZW5cblxuKiBzeW50aCAtPiBjcmVhdGUgYXJ0aWZhY3RzXG4qIHVwbG9hZCBjZGsgYXNzZXRzIC0+ICBzYXZlIGFzc2V0cyBpbiBzMyAobGFtYmRhKSwgYnVpbGQgY29udGFpbmVyIGltYWdlcyAocHVzaCB0byBFQ1IpIC0tIGV2ZXJ5dGhpbmcgaW4gQVdTXG4qIGRlcGxveSBmb3IgZWFjaCBzdGFnZSB0aGF0IGlzIG5vbi1wcm9kdWN0aW9uXG4qIGRlcGxveSB0byBwcm9kIChtYW51YWwgYXBwcm92YWwpXG5cblRPRE86XG4tIGFjY291bnQgdGFyZ2V0XG4tIG1hbnVhbCBhcHByb3ZhbCBmb3Igc3RhZ2VzIC0tIERPTkVcbi0gSUFNIHJvbGUgcGVyIHN0YWdlLCBzeW50aCwgYXNzZXRcbi0gaW5kZXBlbmRlbmQgc3RhZ2VzIChhbGwgcGFyYWxsZWwgdG8gZWFjaCBvdGhlcikgYWZ0ZXIgc3ludGgmYXNzZXRzXG4tIGVudmlyb25tZW50cyBzdXBwb3J0XG4tIHN0ZXBzIHBlciBzdGFnZSAtIHByZUluc3RhbGwsIHByZVN5bnRoLCAuLi5cblxuZXhhbXBsZTogaHR0cHM6Ly9naXRodWIuY29tL2F3cy1jb21tdW5pdHktZGFjaC9ldmVudC1zeXN0ZW0tYmFja2VuZFxuXG50ZXN0IGRvY2dlbjogaHR0cHM6Ly9naXRodWIuY29tL29wZW4tY29uc3RydWN0cy9hd3MtY2RrLWxpYnJhcnlcblxuXG4qL1xuXG5leHBvcnQgaW50ZXJmYWNlIENvZGVDYXRhbHlzdElhbVJvbGVDb25maWcge1xuICByZWFkb25seSBkZWZhdWx0Pzogc3RyaW5nO1xuICByZWFkb25seSBzeW50aD86IHN0cmluZztcbiAgcmVhZG9ubHkgYXNzZXRQdWJsaXNoaW5nPzogc3RyaW5nO1xuICByZWFkb25seSBkZXBsb3ltZW50PzogeyBbc3RhZ2U6IHN0cmluZ106IHN0cmluZyB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvZGVDYXRhbHlzdENES1BpcGVsaW5lT3B0aW9ucyBleHRlbmRzIENES1BpcGVsaW5lT3B0aW9ucyB7XG4gIHJlYWRvbmx5IGlhbVJvbGVBcm5zOiBDb2RlQ2F0YWx5c3RJYW1Sb2xlQ29uZmlnO1xufVxuXG5leHBvcnQgY2xhc3MgQ29kZUNhdGFseXN0Q0RLUGlwZWxpbmUgZXh0ZW5kcyBDREtQaXBlbGluZSB7XG5cbiAgcHVibGljIHJlYWRvbmx5IG5lZWRzVmVyc2lvbmVkQXJ0aWZhY3RzOiBib29sZWFuO1xuXG4gIHByaXZhdGUgZGVwbG95bWVudFdvcmtmbG93QnVpbGRlcjogV29ya2Zsb3dCdWlsZGVyO1xuICBwcml2YXRlIGRlcGxveW1lbnRTdGFnZXM6IHN0cmluZ1tdID0gW107XG5cbiAgcHJpdmF0ZSByZWFkb25seSBicDogQmx1ZXByaW50O1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogYXdzY2RrLkF3c0Nka1R5cGVTY3JpcHRBcHAsIHByaXZhdGUgb3B0aW9uczogQ29kZUNhdGFseXN0Q0RLUGlwZWxpbmVPcHRpb25zKSB7XG4gICAgc3VwZXIoYXBwLCBvcHRpb25zKTtcbiAgICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2F3cy9jb2RlY2F0YWx5c3QtYmx1ZXByaW50cy9pc3N1ZXMvNDc3XG4gICAgcHJvY2Vzcy5lbnYuQ09OVEVYVF9FTlZJUk9OTUVOVElEPSdwcm9kJztcblxuICAgIHRoaXMuYnAgPSBuZXcgQmx1ZXByaW50KHsgb3V0ZGlyOiAnLmNvZGVjYXRhbHlzdC93b3JrZmxvd3MnIH0pO1xuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93QnVpbGRlciA9IG5ldyBXb3JrZmxvd0J1aWxkZXIodGhpcy5icCk7XG5cbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuc2V0TmFtZSgnZGVwbG95Jyk7XG4gICAgdGhpcy5kZXBsb3ltZW50V29ya2Zsb3dCdWlsZGVyLmFkZEJyYW5jaFRyaWdnZXIoWydtYWluJ10pO1xuXG4gICAgdGhpcy5uZWVkc1ZlcnNpb25lZEFydGlmYWN0cyA9IHRoaXMub3B0aW9ucy5zdGFnZXMuZmluZChzID0+IHMubWFudWFsQXBwcm92YWwgPT09IHRydWUpICE9PSB1bmRlZmluZWQ7XG5cbiAgICB0aGlzLmNyZWF0ZVN5bnRoKCk7XG4gICAgdGhpcy5jcmVhdGVBc3NldFVwbG9hZCgpO1xuXG4gICAgZm9yIChjb25zdCBzdGFnZSBvZiBvcHRpb25zLnN0YWdlcykge1xuICAgICAgdGhpcy5jcmVhdGVEZXBsb3ltZW50KHN0YWdlKTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHN0YWdlIG9mIChvcHRpb25zLmluZGVwZW5kZW50U3RhZ2VzID8/IFtdKSkge1xuICAgICAgdGhpcy5jcmVhdGVJbmRlcGVuZGVudERlcGxveW1lbnQoc3RhZ2UpO1xuICAgIH1cblxuICAgIGNvbnN0IHltbCA9IG5ldyBZYW1sRmlsZSh0aGlzLCAnLmNvZGVjYXRhbHlzdC93b3JrZmxvd3MvZGVwbG95LnlhbWwnLCB7XG4gICAgICBvYmo6IHRoaXMuZGVwbG95bWVudFdvcmtmbG93QnVpbGRlci5nZXREZWZpbml0aW9uKCksXG5cbiAgICB9KTtcbiAgICB5bWwuc3ludGhlc2l6ZSgpO1xuICB9XG5cbiAgLyoqIHRoZSB0eXBlIG9mIGVuZ2luZSB0aGlzIGltcGxlbWVudGF0aW9uIG9mIENES1BpcGVsaW5lIGlzIGZvciAqL1xuICBwdWJsaWMgZW5naW5lVHlwZSgpOiBQaXBlbGluZUVuZ2luZSB7XG4gICAgcmV0dXJuIFBpcGVsaW5lRW5naW5lLkNPREVfQ0FUQUxZU1Q7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVN5bnRoKCk6IHZvaWQge1xuXG4gICAgY29uc3QgY21kczogc3RyaW5nW10gPSBbXTtcbiAgICBjbWRzLnB1c2goLi4udGhpcy5yZW5kZXJJbnN0YWxsQ29tbWFuZHMoKSk7XG4gICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVyU3ludGhDb21tYW5kcygpKTtcbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogJ1N5bnRoQ0RLQXBwbGljYXRpb24nLFxuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgU291cmNlczogWydXb3JrZmxvd1NvdXJjZSddLFxuICAgICAgICBWYXJpYWJsZXM6IHtcbiAgICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHN0ZXBzOlxuICAgICAgICBjbWRzLFxuICAgICAgLy8gRklYTUUgaXMgdGhlcmUgaXMgYW4gZW52aXJvbm1lbnQsIGNvbm5lY3QgaXQgdG8gdGhlIHdvcmtmbG93XG4gICAgICAvLyBuZWVkcyB0byByZWFjdCBvbiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LnN5bnRoXG4gICAgICAvL2Vudmlyb25tZW50OiBlbnZpcm9ubWVudCAmJiBjb252ZXJ0VG9Xb3JrZmxvd0Vudmlyb25tZW50KGVudmlyb25tZW50KSxcblxuICAgICAgLy8gRklYTUUgd2hhdCBhYm91dCB0aGUgcGVybWlzc2lvbnM/XG4gICAgICAvLyBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG5cbiAgICAgIG91dHB1dDoge30sXG4gICAgfSk7XG5cbiAgICAvKlxubm90IHJlcXVpcmVkIGJlY2F1c2UgY29kZWNhdGFseXN0IGF1dG9tYXRpY2FsbHkgdXBsb2FkcyBhcnRpZmFjdHNcbkZJWE1FIG9yIGRvIHdlIG5lZWQgdG8gY3JlYXRlIFwiYXJ0aWZhY3RzXCIgaGVyZSBhbmQgdXBsb2FkP1xuc3RlcHMucHVzaCh7XG4gICAgICB1c2VzOiAnYWN0aW9ucy91cGxvYWQtYXJ0aWZhY3RAdjMnLFxuICAgICAgd2l0aDoge1xuICAgICAgICBuYW1lOiAnY2xvdWQtYXNzZW1ibHknLFxuICAgICAgICBwYXRoOiBgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fS9gLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICAqL1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZUFzc2V0VXBsb2FkKCk6IHZvaWQge1xuXG4gICAgY29uc3QgY21kczogc3RyaW5nW10gPSBbXTtcbiAgICBjbWRzLnB1c2goLi4udGhpcy5yZW5kZXJBc3NldFVwbG9hZENvbW1hbmRzKCkpO1xuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93QnVpbGRlci5hZGRCdWlsZEFjdGlvbih7XG4gICAgICBhY3Rpb25OYW1lOiAnUHVibGlzaEFzc2V0c1RvQVdTJyxcbiAgICAgIGRlcGVuZHNPbjogWydTeW50aENES0FwcGxpY2F0aW9uJ10sXG4gICAgICBpbnB1dDoge1xuICAgICAgICBTb3VyY2VzOiBbJ1dvcmtmbG93U291cmNlJ10sXG4gICAgICAgIFZhcmlhYmxlczoge1xuICAgICAgICAgIENJOiAndHJ1ZScsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgc3RlcHM6XG4gICAgICAgIGNtZHMsXG4gICAgICAvLyBGSVhNRSBpcyB0aGVyZSBpcyBhbiBlbnZpcm9ubWVudCwgY29ubmVjdCBpdCB0byB0aGUgd29ya2Zsb3dcbiAgICAgIC8vIG5lZWRzIHRvIHJlYWN0IG9uIHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucz8uc3ludGhcbiAgICAgIC8vZW52aXJvbm1lbnQ6IGVudmlyb25tZW50ICYmIGNvbnZlcnRUb1dvcmtmbG93RW52aXJvbm1lbnQoZW52aXJvbm1lbnQpLFxuXG4gICAgICAvLyBGSVhNRSB3aGF0IGFib3V0IHRoZSBwZXJtaXNzaW9ucz9cbiAgICAgIC8vIHBlcm1pc3Npb25zOiB7IGlkVG9rZW46IEpvYlBlcm1pc3Npb24uV1JJVEUsIGNvbnRlbnRzOiBKb2JQZXJtaXNzaW9uLlJFQUQgfSxcblxuICAgICAgb3V0cHV0OiB7fSxcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVEZXBsb3ltZW50KHN0YWdlOiBEZXBsb3ltZW50U3RhZ2UpOiB2b2lkIHtcbiAgICBsZXQgZGVwZW5kc09uID0gYGRlcGxveV8ke3RoaXMuZGVwbG95bWVudFN0YWdlcy5hdCgtMSkhfWA7XG4gICAgaWYgKHN0YWdlLm1hbnVhbEFwcHJvdmFsID09PSB0cnVlKSB7XG4gICAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkR2VuZXJpY0FjdGlvbih7XG4gICAgICAgIElkZW50aWZpZXI6ICdhd3MvYXBwcm92YWxAdjEnLFxuICAgICAgICBhY3Rpb25OYW1lOiBgYXBwcm92ZV8ke3N0YWdlLm5hbWV9YCxcbiAgICAgICAgRGVwZW5kc09uOiBbYGRlcGxveV8ke3RoaXMuZGVwbG95bWVudFN0YWdlcy5hdCgtMSkhfWBdLFxuICAgICAgICBDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgQXBwcm92YWxzUmVxdWlyZWQ6IDEsXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICAgIGRlcGVuZHNPbiA9IGBhcHByb3ZlXyR7c3RhZ2UubmFtZX1gO1xuICAgIH1cbiAgICAvLyBBZGQgZGVwbG95bWVudCB0byBleGlzdGluZyB3b3JrZmxvd1xuICAgIGNvbnN0IGNtZHM6IHN0cmluZ1tdID0gW107XG4gICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVySW5zdGFsbENvbW1hbmRzKCkpO1xuICAgIGNtZHMucHVzaCguLi50aGlzLnJlbmRlckRlcGxveUNvbW1hbmRzKHN0YWdlLm5hbWUpKTtcbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogYGRlcGxveV8ke3N0YWdlLm5hbWV9YCxcbiAgICAgIGRlcGVuZHNPbjogdGhpcy5kZXBsb3ltZW50U3RhZ2VzLmxlbmd0aCA+IDAgPyBbJ1B1Ymxpc2hBc3NldHNUb0FXUycsIGRlcGVuZHNPbl0gOiBbJ1B1Ymxpc2hBc3NldHNUb0FXUyddLFxuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgU291cmNlczogWydXb3JrZmxvd1NvdXJjZSddLFxuICAgICAgICBWYXJpYWJsZXM6IHtcbiAgICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHN0ZXBzOlxuICAgICAgICBjbWRzLFxuICAgICAgLy8gRklYTUUgaXMgdGhlcmUgaXMgYW4gZW52aXJvbm1lbnQsIGNvbm5lY3QgaXQgdG8gdGhlIHdvcmtmbG93XG4gICAgICAvLyBuZWVkcyB0byByZWFjdCBvbiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LnN5bnRoXG4gICAgICAvL2Vudmlyb25tZW50OiBlbnZpcm9ubWVudCAmJiBjb252ZXJ0VG9Xb3JrZmxvd0Vudmlyb25tZW50KGVudmlyb25tZW50KSxcblxuICAgICAgLy8gRklYTUUgd2hhdCBhYm91dCB0aGUgcGVybWlzc2lvbnM/XG4gICAgICAvLyBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG5cbiAgICAgIG91dHB1dDoge30sXG4gICAgfSk7XG5cbiAgICB0aGlzLmRlcGxveW1lbnRTdGFnZXMucHVzaChzdGFnZS5uYW1lKTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVJbmRlcGVuZGVudERlcGxveW1lbnQoc3RhZ2U6IERlcGxveW1lbnRTdGFnZSk6IHZvaWQge1xuICAgIGxldCBkZXBlbmRzT24gPSAnUHVibGlzaEFzc2V0c1RvQVdTJztcbiAgICBpZiAoc3RhZ2UubWFudWFsQXBwcm92YWwgPT09IHRydWUpIHtcbiAgICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93QnVpbGRlci5hZGRHZW5lcmljQWN0aW9uKHtcbiAgICAgICAgSWRlbnRpZmllcjogJ2F3cy9hcHByb3ZhbEB2MScsXG4gICAgICAgIGFjdGlvbk5hbWU6IGBhcHByb3ZlXyR7c3RhZ2UubmFtZX1gLFxuICAgICAgICBEZXBlbmRzT246IFtgZGVwbG95XyR7dGhpcy5kZXBsb3ltZW50U3RhZ2VzLmF0KC0xKSF9YF0sXG4gICAgICAgIENvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICBBcHByb3ZhbHNSZXF1aXJlZDogMSxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgICAgZGVwZW5kc09uID0gYGFwcHJvdmVfJHtzdGFnZS5uYW1lfWA7XG4gICAgfVxuICAgIC8vIEFkZCBkZXBsb3ltZW50IHRvIGV4aXN0aW5nIHdvcmtmbG93XG4gICAgY29uc3QgY21kczogc3RyaW5nW10gPSBbXTtcbiAgICBjbWRzLnB1c2goLi4udGhpcy5yZW5kZXJJbnN0YWxsQ29tbWFuZHMoKSk7XG4gICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVyRGVwbG95Q29tbWFuZHMoc3RhZ2UubmFtZSkpO1xuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93QnVpbGRlci5hZGRCdWlsZEFjdGlvbih7XG4gICAgICBhY3Rpb25OYW1lOiBgaW5kZXBsb3lfJHtzdGFnZS5uYW1lfWAsXG4gICAgICBkZXBlbmRzT246IFtkZXBlbmRzT25dLFxuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgU291cmNlczogWydXb3JrZmxvd1NvdXJjZSddLFxuICAgICAgICBWYXJpYWJsZXM6IHtcbiAgICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHN0ZXBzOlxuICAgICAgICBjbWRzLFxuICAgICAgLy8gRklYTUUgaXMgdGhlcmUgaXMgYW4gZW52aXJvbm1lbnQsIGNvbm5lY3QgaXQgdG8gdGhlIHdvcmtmbG93XG4gICAgICAvLyBuZWVkcyB0byByZWFjdCBvbiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LnN5bnRoXG4gICAgICAvL2Vudmlyb25tZW50OiBlbnZpcm9ubWVudCAmJiBjb252ZXJ0VG9Xb3JrZmxvd0Vudmlyb25tZW50KGVudmlyb25tZW50KSxcblxuICAgICAgLy8gRklYTUUgd2hhdCBhYm91dCB0aGUgcGVybWlzc2lvbnM/XG4gICAgICAvLyBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG5cbiAgICAgIG91dHB1dDoge30sXG4gICAgfSk7XG4gIH1cblxufVxuIl19