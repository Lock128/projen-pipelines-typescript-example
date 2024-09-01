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
        if (stage.manualApproval === true) {
            // Create new deployment workflow for stage
            this.createWorkflowForStage(stage);
        }
        else {
            // Add deployment to existing workflow
            const cmds = [];
            cmds.push(...this.renderInstallCommands());
            cmds.push(...this.renderDeployCommands(stage.name));
            this.deploymentWorkflowBuilder.addBuildAction({
                actionName: `deploy_${stage.name}`,
                dependsOn: this.deploymentStages.length > 0 ? ['PublishAssetsToAWS', `deploy_${this.deploymentStages.at(-1)}`] : ['PublishAssetsToAWS'],
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
    }
    createWorkflowForStage(stage) {
        console.log(stage);
        const deploymentStageWorkflowBuilder = new blueprint_component_workflows_1.WorkflowBuilder(this.bp);
        deploymentStageWorkflowBuilder.setName(`release-${stage.name}`);
        // Add deployment to new workflow
        const cmds = [];
        cmds.push(...this.renderInstallCommands());
        cmds.push(...this.renderInstallPackageCommands(`${this.options.pkgNamespace}/${this.app.name}@\${{github.event.inputs.version}}`));
        cmds.push(`mv ./node_modules/${this.options.pkgNamespace}/${this.app.name} ${this.app.cdkConfig.cdkout}`);
        cmds.push(...this.renderDeployCommands(stage.name));
        deploymentStageWorkflowBuilder.addBuildAction({
            actionName: `deploy_${stage.name}`,
            // needs: this.deploymentStages.length > 0 ? ['assetUpload', `deploy_${this.deploymentStages.at(-1)!}`] : ['assetUpload'],
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
        const yml = new projen_1.YamlFile(this, `.codecatalyst/workflows/release-${stage.name}.yaml`, {
            obj: deploymentStageWorkflowBuilder.getDefinition(),
        });
        yml.synthesize();
    }
}
exports.CodeCatalystCDKPipeline = CodeCatalystCDKPipeline;
_a = JSII_RTTI_SYMBOL_1;
CodeCatalystCDKPipeline[_a] = { fqn: "projen-pipelines.CodeCatalystCDKPipeline", version: "0.0.0" };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29kZWNhdGFseXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2F3c2Nkay9jb2RlY2F0YWx5c3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxzR0FBcUY7QUFDckYsbUNBQTBDO0FBQzFDLGlDQUEwRTtBQUUxRSx3REFBcUQ7QUFDckQsc0NBQTJDO0FBYzNDLE1BQWEsdUJBQXdCLFNBQVEsa0JBQVc7SUFTdEQsWUFBWSxHQUErQixFQUFVLE9BQXVDO1FBQzFGLEtBQUssQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFEK0IsWUFBTyxHQUFQLE9BQU8sQ0FBZ0M7UUFKcEYscUJBQWdCLEdBQWEsRUFBRSxDQUFDO1FBTXRDLGdFQUFnRTtRQUNoRSxPQUFPLENBQUMsR0FBRyxDQUFDLHFCQUFxQixHQUFDLE1BQU0sQ0FBQztRQUV6QyxJQUFJLENBQUMsRUFBRSxHQUFHLElBQUkscUJBQVMsQ0FBQyxFQUFFLE1BQU0sRUFBRSx5QkFBeUIsRUFBRSxDQUFDLENBQUM7UUFDL0QsSUFBSSxDQUFDLHlCQUF5QixHQUFHLElBQUksK0NBQWUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFOUQsSUFBSSxDQUFDLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNqRCxJQUFJLENBQUMseUJBQXlCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBRTFELElBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsY0FBYyxLQUFLLElBQUksQ0FBQyxLQUFLLFNBQVMsQ0FBQztRQUV0RyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFbkIsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFFekIsS0FBSyxNQUFNLEtBQUssSUFBSSxPQUFP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LENBQUM7UUFDcEQsOEJBQThCLENBQUMsY0FBYyxDQUFDO1lBQzVDLFVBQVUsRUFBRSxVQUFVLEtBQUssQ0FBQyxJQUFJLEVBQUU7WUFDbEMsMEhBQTBIO1lBQzFILFNBQVMsRUFBRSxDQUFDLHFCQUFxQixDQUFDO1lBQ2xDLEtBQUssRUFBRTtnQkFDTCxPQUFPLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDM0IsU0FBUyxFQUFFO29CQUNULEVBQUUsRUFBRSxNQUFNO2lCQUNYO2FBQ0Y7WUFDRCxLQUFLLEVBQ1QsSUFBSTtZQUNBLCtEQUErRDtZQUMvRCxvREFBb0Q7WUFDcEQsd0VBQXdFO1lBRXhFLG9DQUFvQztZQUNwQywrRUFBK0U7WUFFL0UsTUFBTSxFQUFFLEVBQUU7U0FDWCxDQUFDLENBQUM7UUFFSCxNQUFNLEdBQUcsR0FBRyxJQUFJLGlCQUFRLENBQUMsSUFBSSxFQUFFLG1DQUFtQyxLQUFLLENBQUMsSUFBSSxPQUFPLEVBQUU7WUFDbkYsR0FBRyxFQUFFLDhCQUE4QixDQUFDLGFBQWEsRUFBRTtTQUVwRCxDQUFDLENBQUM7UUFDSCxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDbkIsQ0FBQzs7QUFqTEgsMERBbUxDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgV29ya2Zsb3dCdWlsZGVyIH0gZnJvbSAnQGFtYXpvbi1jb2RlY2F0YWx5c3QvYmx1ZXByaW50LWNvbXBvbmVudC53b3JrZmxvd3MnO1xuaW1wb3J0IHsgWWFtbEZpbGUsIGF3c2NkayB9IGZyb20gJ3Byb2plbic7XG5pbXBvcnQgeyBDREtQaXBlbGluZSwgQ0RLUGlwZWxpbmVPcHRpb25zLCBEZXBsb3ltZW50U3RhZ2UgfSBmcm9tICcuL2Jhc2UnO1xuXG5pbXBvcnQgeyBCbHVlcHJpbnQgfSBmcm9tICcuL2NvZGVjYXRhbHlzdC9ibHVlcHJpbnQnO1xuaW1wb3J0IHsgUGlwZWxpbmVFbmdpbmUgfSBmcm9tICcuLi9lbmdpbmUnO1xuXG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29kZUNhdGFseXN0SWFtUm9sZUNvbmZpZyB7XG4gIHJlYWRvbmx5IGRlZmF1bHQ/OiBzdHJpbmc7XG4gIHJlYWRvbmx5IHN5bnRoPzogc3RyaW5nO1xuICByZWFkb25seSBhc3NldFB1Ymxpc2hpbmc/OiBzdHJpbmc7XG4gIHJlYWRvbmx5IGRlcGxveW1lbnQ/OiB7IFtzdGFnZTogc3RyaW5nXTogc3RyaW5nIH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29kZUNhdGFseXN0Q0RLUGlwZWxpbmVPcHRpb25zIGV4dGVuZHMgQ0RLUGlwZWxpbmVPcHRpb25zIHtcbiAgcmVhZG9ubHkgaWFtUm9sZUFybnM6IENvZGVDYXRhbHlzdElhbVJvbGVDb25maWc7XG59XG5cbmV4cG9ydCBjbGFzcyBDb2RlQ2F0YWx5c3RDREtQaXBlbGluZSBleHRlbmRzIENES1BpcGVsaW5lIHtcblxuICBwdWJsaWMgcmVhZG9ubHkgbmVlZHNWZXJzaW9uZWRBcnRpZmFjdHM6IGJvb2xlYW47XG5cbiAgcHJpdmF0ZSBkZXBsb3ltZW50V29ya2Zsb3dCdWlsZGVyOiBXb3JrZmxvd0J1aWxkZXI7XG4gIHByaXZhdGUgZGVwbG95bWVudFN0YWdlczogc3RyaW5nW10gPSBbXTtcblxuICBwcml2YXRlIHJlYWRvbmx5IGJwOiBCbHVlcHJpbnQ7XG5cbiAgY29uc3RydWN0b3IoYXBwOiBhd3NjZGsuQXdzQ2RrVHlwZVNjcmlwdEFwcCwgcHJpdmF0ZSBvcHRpb25zOiBDb2RlQ2F0YWx5c3RDREtQaXBlbGluZU9wdGlvbnMpIHtcbiAgICBzdXBlcihhcHAsIG9wdGlvbnMpO1xuICAgIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vYXdzL2NvZGVjYXRhbHlzdC1ibHVlcHJpbnRzL2lzc3Vlcy80NzdcbiAgICBwcm9jZXNzLmVudi5DT05URVhUX0VOVklST05NRU5USUQ9J3Byb2QnO1xuXG4gICAgdGhpcy5icCA9IG5ldyBCbHVlcHJpbnQoeyBvdXRkaXI6ICcuY29kZWNhdGFseXN0L3dvcmtmbG93cycgfSk7XG4gICAgdGhpcy5kZXBsb3ltZW50V29ya2Zsb3dCdWlsZGVyID0gbmV3IFdvcmtmbG93QnVpbGRlcih0aGlzLmJwKTtcblxuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93QnVpbGRlci5zZXROYW1lKCdkZXBsb3knKTtcbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkQnJhbmNoVHJpZ2dlcihbJ21haW4nXSk7XG5cbiAgICB0aGlzLm5lZWRzVmVyc2lvbmVkQXJ0aWZhY3RzID0gdGhpcy5vcHRpb25zLnN0YWdlcy5maW5kKHMgPT4gcy5tYW51YWxBcHByb3ZhbCA9PT0gdHJ1ZSkgIT09IHVuZGVmaW5lZDtcblxuICAgIHRoaXMuY3JlYXRlU3ludGgoKTtcblxuICAgIHRoaXMuY3JlYXRlQXNzZXRVcGxvYWQoKTtcblxuICAgIGZvciAoY29uc3Qgc3RhZ2Ugb2Ygb3B0aW9ucy5zdGFnZXMpIHtcbiAgICAgIHRoaXMuY3JlYXRlRGVwbG95bWVudChzdGFnZSk7XG4gICAgfVxuXG4gICAgY29uc3QgeW1sID0gbmV3IFlhbWxGaWxlKHRoaXMsICcuY29kZWNhdGFseXN0L3dvcmtmbG93cy9kZXBsb3kueWFtbCcsIHtcbiAgICAgIG9iajogdGhpcy5kZXBsb3ltZW50V29ya2Zsb3dCdWlsZGVyLmdldERlZmluaXRpb24oKSxcblxuICAgIH0pO1xuICAgIHltbC5zeW50aGVzaXplKCk7XG4gIH1cblxuICAgIC8qKiB0aGUgdHlwZSBvZiBlbmdpbmUgdGhpcyBpbXBsZW1lbnRhdGlvbiBvZiBDREtQaXBlbGluZSBpcyBmb3IgKi9cbiAgICBwdWJsaWMgZW5naW5lVHlwZSgpOiBQaXBlbGluZUVuZ2luZSB7XG4gICAgICByZXR1cm4gUGlwZWxpbmVFbmdpbmUuQ09ERV9DQVRBTFlTVDtcbiAgICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVTeW50aCgpOiB2b2lkIHtcblxuICAgIGNvbnN0IGNtZHM6IHN0cmluZ1tdID0gW107XG4gICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVyU3ludGhDb21tYW5kcygpKTtcbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogJ1N5bnRoQ0RLQXBwbGljYXRpb24nLFxuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgU291cmNlczogWydXb3JrZmxvd1NvdXJjZSddLFxuICAgICAgICBWYXJpYWJsZXM6IHtcbiAgICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHN0ZXBzOlxuICAgICAgICBjbWRzLFxuICAgICAgLy8gRklYTUUgaXMgdGhlcmUgaXMgYW4gZW52aXJvbm1lbnQsIGNvbm5lY3QgaXQgdG8gdGhlIHdvcmtmbG93XG4gICAgICAvLyBuZWVkcyB0byByZWFjdCBvbiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LnN5bnRoXG4gICAgICAvL2Vudmlyb25tZW50OiBlbnZpcm9ubWVudCAmJiBjb252ZXJ0VG9Xb3JrZmxvd0Vudmlyb25tZW50KGVudmlyb25tZW50KSxcblxuICAgICAgLy8gRklYTUUgd2hhdCBhYm91dCB0aGUgcGVybWlzc2lvbnM/XG4gICAgICAvLyBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG5cbiAgICAgIG91dHB1dDoge30sXG4gICAgfSk7XG5cbiAgICAvKlxubm90IHJlcXVpcmVkIGJlY2F1c2UgY29kZWNhdGFseXN0IGF1dG9tYXRpY2FsbHkgdXBsb2FkcyBhcnRpZmFjdHNcbnN0ZXBzLnB1c2goe1xuICAgICAgdXNlczogJ2FjdGlvbnMvdXBsb2FkLWFydGlmYWN0QHYzJyxcbiAgICAgIHdpdGg6IHtcbiAgICAgICAgbmFtZTogJ2Nsb3VkLWFzc2VtYmx5JyxcbiAgICAgICAgcGF0aDogYCR7dGhpcy5hcHAuY2RrQ29uZmlnLmNka291dH0vYCxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgKi9cbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVBc3NldFVwbG9hZCgpOiB2b2lkIHtcblxuICAgIGNvbnN0IGNtZHM6IHN0cmluZ1tdID0gW107XG4gICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVyQXNzZXRVcGxvYWRDb21tYW5kcygpKTtcbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogJ1B1Ymxpc2hBc3NldHNUb0FXUycsXG4gICAgICBkZXBlbmRzT246IFsnU3ludGhDREtBcHBsaWNhdGlvbiddLFxuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgU291cmNlczogWydXb3JrZmxvd1NvdXJjZSddLFxuICAgICAgICBWYXJpYWJsZXM6IHtcbiAgICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHN0ZXBzOlxuICAgICAgICBjbWRzLFxuICAgICAgLy8gRklYTUUgaXMgdGhlcmUgaXMgYW4gZW52aXJvbm1lbnQsIGNvbm5lY3QgaXQgdG8gdGhlIHdvcmtmbG93XG4gICAgICAvLyBuZWVkcyB0byByZWFjdCBvbiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LnN5bnRoXG4gICAgICAvL2Vudmlyb25tZW50OiBlbnZpcm9ubWVudCAmJiBjb252ZXJ0VG9Xb3JrZmxvd0Vudmlyb25tZW50KGVudmlyb25tZW50KSxcblxuICAgICAgLy8gRklYTUUgd2hhdCBhYm91dCB0aGUgcGVybWlzc2lvbnM/XG4gICAgICAvLyBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG5cbiAgICAgIG91dHB1dDoge30sXG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgY3JlYXRlRGVwbG95bWVudChzdGFnZTogRGVwbG95bWVudFN0YWdlKTogdm9pZCB7XG4gICAgaWYgKHN0YWdlLm1hbnVhbEFwcHJvdmFsID09PSB0cnVlKSB7XG4gICAgICAvLyBDcmVhdGUgbmV3IGRlcGxveW1lbnQgd29ya2Zsb3cgZm9yIHN0YWdlXG4gICAgICB0aGlzLmNyZWF0ZVdvcmtmbG93Rm9yU3RhZ2Uoc3RhZ2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBBZGQgZGVwbG95bWVudCB0byBleGlzdGluZyB3b3JrZmxvd1xuICAgICAgY29uc3QgY21kczogc3RyaW5nW10gPSBbXTtcbiAgICAgIGNtZHMucHVzaCguLi50aGlzLnJlbmRlckluc3RhbGxDb21tYW5kcygpKTtcbiAgICAgIGNtZHMucHVzaCguLi50aGlzLnJlbmRlckRlcGxveUNvbW1hbmRzKHN0YWdlLm5hbWUpKTtcbiAgICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93QnVpbGRlci5hZGRCdWlsZEFjdGlvbih7XG4gICAgICAgIGFjdGlvbk5hbWU6IGBkZXBsb3lfJHtzdGFnZS5uYW1lfWAsXG4gICAgICAgIGRlcGVuZHNPbjogdGhpcy5kZXBsb3ltZW50U3RhZ2VzLmxlbmd0aCA+IDAgPyBbJ1B1Ymxpc2hBc3NldHNUb0FXUycsIGBkZXBsb3lfJHt0aGlzLmRlcGxveW1lbnRTdGFnZXMuYXQoLTEpIX1gXSA6IFsnUHVibGlzaEFzc2V0c1RvQVdTJ10sXG4gICAgICAgIGlucHV0OiB7XG4gICAgICAgICAgU291cmNlczogWydXb3JrZmxvd1NvdXJjZSddLFxuICAgICAgICAgIFZhcmlhYmxlczoge1xuICAgICAgICAgICAgQ0k6ICd0cnVlJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBzdGVwczpcbiAgICAgICAgY21kcyxcbiAgICAgICAgLy8gRklYTUUgaXMgdGhlcmUgaXMgYW4gZW52aXJvbm1lbnQsIGNvbm5lY3QgaXQgdG8gdGhlIHdvcmtmbG93XG4gICAgICAgIC8vIG5lZWRzIHRvIHJlYWN0IG9uIHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucz8uc3ludGhcbiAgICAgICAgLy9lbnZpcm9ubWVudDogZW52aXJvbm1lbnQgJiYgY29udmVydFRvV29ya2Zsb3dFbnZpcm9ubWVudChlbnZpcm9ubWVudCksXG5cbiAgICAgICAgLy8gRklYTUUgd2hhdCBhYm91dCB0aGUgcGVybWlzc2lvbnM/XG4gICAgICAgIC8vIHBlcm1pc3Npb25zOiB7IGlkVG9rZW46IEpvYlBlcm1pc3Npb24uV1JJVEUsIGNvbnRlbnRzOiBKb2JQZXJtaXNzaW9uLlJFQUQgfSxcblxuICAgICAgICBvdXRwdXQ6IHt9LFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuZGVwbG95bWVudFN0YWdlcy5wdXNoKHN0YWdlLm5hbWUpO1xuICAgIH1cbiAgfVxuXG4gIGNyZWF0ZVdvcmtmbG93Rm9yU3RhZ2Uoc3RhZ2U6IERlcGxveW1lbnRTdGFnZSkge1xuICAgIGNvbnNvbGUubG9nKHN0YWdlKTtcbiAgICBjb25zdCBkZXBsb3ltZW50U3RhZ2VXb3JrZmxvd0J1aWxkZXIgPSBuZXcgV29ya2Zsb3dCdWlsZGVyKHRoaXMuYnApO1xuXG4gICAgZGVwbG95bWVudFN0YWdlV29ya2Zsb3dCdWlsZGVyLnNldE5hbWUoYHJlbGVhc2UtJHtzdGFnZS5uYW1lfWApO1xuXG4gICAgLy8gQWRkIGRlcGxveW1lbnQgdG8gbmV3IHdvcmtmbG93XG4gICAgY29uc3QgY21kczogc3RyaW5nW10gPSBbXTtcbiAgICBjbWRzLnB1c2goLi4udGhpcy5yZW5kZXJJbnN0YWxsQ29tbWFuZHMoKSk7XG4gICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVySW5zdGFsbFBhY2thZ2VDb21tYW5kcyhgJHt0aGlzLm9wdGlvbnMucGtnTmFtZXNwYWNlfS8ke3RoaXMuYXBwLm5hbWV9QFxcJHt7Z2l0aHViLmV2ZW50LmlucHV0cy52ZXJzaW9ufX1gKSk7XG4gICAgY21kcy5wdXNoKGBtdiAuL25vZGVfbW9kdWxlcy8ke3RoaXMub3B0aW9ucy5wa2dOYW1lc3BhY2V9LyR7dGhpcy5hcHAubmFtZX0gJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fWApO1xuICAgIGNtZHMucHVzaCguLi50aGlzLnJlbmRlckRlcGxveUNvbW1hbmRzKHN0YWdlLm5hbWUpKTtcbiAgICBkZXBsb3ltZW50U3RhZ2VXb3JrZmxvd0J1aWxkZXIuYWRkQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogYGRlcGxveV8ke3N0YWdlLm5hbWV9YCxcbiAgICAgIC8vIG5lZWRzOiB0aGlzLmRlcGxveW1lbnRTdGFnZXMubGVuZ3RoID4gMCA/IFsnYXNzZXRVcGxvYWQnLCBgZGVwbG95XyR7dGhpcy5kZXBsb3ltZW50U3RhZ2VzLmF0KC0xKSF9YF0gOiBbJ2Fzc2V0VXBsb2FkJ10sXG4gICAgICBkZXBlbmRzT246IFsnU3ludGhDREtBcHBsaWNhdGlvbiddLFxuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgU291cmNlczogWydXb3JrZmxvd1NvdXJjZSddLFxuICAgICAgICBWYXJpYWJsZXM6IHtcbiAgICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHN0ZXBzOlxuICBjbWRzLFxuICAgICAgLy8gRklYTUUgaXMgdGhlcmUgaXMgYW4gZW52aXJvbm1lbnQsIGNvbm5lY3QgaXQgdG8gdGhlIHdvcmtmbG93XG4gICAgICAvLyBuZWVkcyB0byByZWFjdCBvbiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LnN5bnRoXG4gICAgICAvL2Vudmlyb25tZW50OiBlbnZpcm9ubWVudCAmJiBjb252ZXJ0VG9Xb3JrZmxvd0Vudmlyb25tZW50KGVudmlyb25tZW50KSxcblxuICAgICAgLy8gRklYTUUgd2hhdCBhYm91dCB0aGUgcGVybWlzc2lvbnM/XG4gICAgICAvLyBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG5cbiAgICAgIG91dHB1dDoge30sXG4gICAgfSk7XG5cbiAgICBjb25zdCB5bWwgPSBuZXcgWWFtbEZpbGUodGhpcywgYC5jb2RlY2F0YWx5c3Qvd29ya2Zsb3dzL3JlbGVhc2UtJHtzdGFnZS5uYW1lfS55YW1sYCwge1xuICAgICAgb2JqOiBkZXBsb3ltZW50U3RhZ2VXb3JrZmxvd0J1aWxkZXIuZ2V0RGVmaW5pdGlvbigpLFxuXG4gICAgfSk7XG4gICAgeW1sLnN5bnRoZXNpemUoKTtcbiAgfVxuXG59XG4iXX0=