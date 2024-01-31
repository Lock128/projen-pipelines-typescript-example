"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeCatalystCDKPipeline = void 0;
const JSII_RTTI_SYMBOL_1 = Symbol.for("jsii.rtti");
const blueprint_component_workflows_1 = require("@amazon-codecatalyst/blueprint-component.workflows");
const projen_1 = require("projen");
const base_1 = require("./base");
const blueprint_1 = require("./codecatalyst/blueprint");
class CodeCatalystCDKPipeline extends base_1.CDKPipeline {
    constructor(app, options) {
        super(app, options);
        this.options = options;
        this.deploymentStages = [];
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
        cmds.push(...this.getAssetUploadCommands(this.needsVersionedArtifacts));
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
                actionName: `deploy-${stage.name}`,
                dependsOn: this.deploymentStages.length > 0 ? ['Publish assets to AWS', `deploy-${this.deploymentStages.at(-1)}`] : ['Publish assets to AWS'],
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
            actionName: `deploy-${stage.name}`,
            // needs: this.deploymentStages.length > 0 ? ['assetUpload', `deploy-${this.deploymentStages.at(-1)!}`] : ['assetUpload'],
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29kZWNhdGFseXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2F3c2Nkay9jb2RlY2F0YWx5c3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxzR0FBcUY7QUFDckYsbUNBQTBDO0FBQzFDLGlDQUEwRTtBQUUxRSx3REFBcUQ7QUFjckQsTUFBYSx1QkFBd0IsU0FBUSxrQkFBVztJQVN0RCxZQUFZLEdBQStCLEVBQVUsT0FBdUM7UUFDMUYsS0FBSyxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUQrQixZQUFPLEdBQVAsT0FBTyxDQUFnQztRQUpwRixxQkFBZ0IsR0FBYSxFQUFFLENBQUM7UUFFaEMsT0FBRSxHQUFjLElBQUkscUJBQVMsQ0FBQyxFQUFFLE1BQU0sRUFBRSx5QkFBeUIsRUFBRSxDQUFDLENBQUM7UUFLM0UsSUFBSSxDQUFDLHlCQUF5QixHQUFHLElBQUksK0NBQWUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFOUQsSUFBSSxDQUFDLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNqRCxJQUFJLENBQUMseUJBQXlCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBRTFELElBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsY0FBYyxLQUFLLElBQUksQ0FBQyxLQUFLLFNBQVMsQ0FBQztRQUV0RyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFbkIsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFFekIsS0FBSyxNQUFNLEtBQUssSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFO1lBQ2xDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUM5QjtRQUVELE1BQU0sR0FBRyxHQUFH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LGdCQUFnQixDQUFDO2dCQUMzQixTQUFTLEVBQUU7b0JBQ1QsRUFBRSxFQUFFLE1BQU07aUJBQ1g7YUFDRjtZQUNELEtBQUssRUFDVCxJQUFJO1lBQ0EsK0RBQStEO1lBQy9ELG9EQUFvRDtZQUNwRCx3RUFBd0U7WUFFeEUsb0NBQW9DO1lBQ3BDLCtFQUErRTtZQUUvRSxNQUFNLEVBQUUsRUFBRTtTQUNYLENBQUMsQ0FBQztRQUVILE1BQU0sR0FBRyxHQUFHLElBQUksaUJBQVEsQ0FBQyxJQUFJLEVBQUUsbUNBQW1DLEtBQUssQ0FBQyxJQUFJLE9BQU8sRUFBRTtZQUNuRixHQUFHLEVBQUUsOEJBQThCLENBQUMsYUFBYSxFQUFFO1NBRXBELENBQUMsQ0FBQztRQUNILEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQztJQUNuQixDQUFDOztBQTNLSCwwREE2S0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBXb3JrZmxvd0J1aWxkZXIgfSBmcm9tICdAYW1hem9uLWNvZGVjYXRhbHlzdC9ibHVlcHJpbnQtY29tcG9uZW50LndvcmtmbG93cyc7XG5pbXBvcnQgeyBZYW1sRmlsZSwgYXdzY2RrIH0gZnJvbSAncHJvamVuJztcbmltcG9ydCB7IENES1BpcGVsaW5lLCBDREtQaXBlbGluZU9wdGlvbnMsIERlcGxveW1lbnRTdGFnZSB9IGZyb20gJy4vYmFzZSc7XG5cbmltcG9ydCB7IEJsdWVwcmludCB9IGZyb20gJy4vY29kZWNhdGFseXN0L2JsdWVwcmludCc7XG5cblxuZXhwb3J0IGludGVyZmFjZSBDb2RlQ2F0YWx5c3RJYW1Sb2xlQ29uZmlnIHtcbiAgcmVhZG9ubHkgZGVmYXVsdD86IHN0cmluZztcbiAgcmVhZG9ubHkgc3ludGg/OiBzdHJpbmc7XG4gIHJlYWRvbmx5IGFzc2V0UHVibGlzaGluZz86IHN0cmluZztcbiAgcmVhZG9ubHkgZGVwbG95bWVudD86IHsgW3N0YWdlOiBzdHJpbmddOiBzdHJpbmcgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb2RlQ2F0YWx5c3RDREtQaXBlbGluZU9wdGlvbnMgZXh0ZW5kcyBDREtQaXBlbGluZU9wdGlvbnMge1xuICByZWFkb25seSBpYW1Sb2xlQXJuczogQ29kZUNhdGFseXN0SWFtUm9sZUNvbmZpZztcbn1cblxuZXhwb3J0IGNsYXNzIENvZGVDYXRhbHlzdENES1BpcGVsaW5lIGV4dGVuZHMgQ0RLUGlwZWxpbmUge1xuXG4gIHB1YmxpYyByZWFkb25seSBuZWVkc1ZlcnNpb25lZEFydGlmYWN0czogYm9vbGVhbjtcblxuICBwcml2YXRlIGRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXI6IFdvcmtmbG93QnVpbGRlcjtcbiAgcHJpdmF0ZSBkZXBsb3ltZW50U3RhZ2VzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHByaXZhdGUgYnA6IEJsdWVwcmludCA9IG5ldyBCbHVlcHJpbnQoeyBvdXRkaXI6ICcuY29kZWNhdGFseXN0L3dvcmtmbG93cycgfSk7XG5cbiAgY29uc3RydWN0b3IoYXBwOiBhd3NjZGsuQXdzQ2RrVHlwZVNjcmlwdEFwcCwgcHJpdmF0ZSBvcHRpb25zOiBDb2RlQ2F0YWx5c3RDREtQaXBlbGluZU9wdGlvbnMpIHtcbiAgICBzdXBlcihhcHAsIG9wdGlvbnMpO1xuXG4gICAgdGhpcy5kZXBsb3ltZW50V29ya2Zsb3dCdWlsZGVyID0gbmV3IFdvcmtmbG93QnVpbGRlcih0aGlzLmJwKTtcblxuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93QnVpbGRlci5zZXROYW1lKCdkZXBsb3knKTtcbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkQnJhbmNoVHJpZ2dlcihbJ21haW4nXSk7XG5cbiAgICB0aGlzLm5lZWRzVmVyc2lvbmVkQXJ0aWZhY3RzID0gdGhpcy5vcHRpb25zLnN0YWdlcy5maW5kKHMgPT4gcy5tYW51YWxBcHByb3ZhbCA9PT0gdHJ1ZSkgIT09IHVuZGVmaW5lZDtcblxuICAgIHRoaXMuY3JlYXRlU3ludGgoKTtcblxuICAgIHRoaXMuY3JlYXRlQXNzZXRVcGxvYWQoKTtcblxuICAgIGZvciAoY29uc3Qgc3RhZ2Ugb2Ygb3B0aW9ucy5zdGFnZXMpIHtcbiAgICAgIHRoaXMuY3JlYXRlRGVwbG95bWVudChzdGFnZSk7XG4gICAgfVxuXG4gICAgY29uc3QgeW1sID0gbmV3IFlhbWxGaWxlKHRoaXMsICcuY29kZWNhdGFseXN0L3dvcmtmbG93cy9kZXBsb3kueWFtbCcsIHtcbiAgICAgIG9iajogdGhpcy5kZXBsb3ltZW50V29ya2Zsb3dCdWlsZGVyLmdldERlZmluaXRpb24oKSxcblxuICAgIH0pO1xuICAgIHltbC5zeW50aGVzaXplKCk7XG5cblxuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVTeW50aCgpOiB2b2lkIHtcblxuICAgIGNvbnN0IGNtZHM6IHN0cmluZ1tdID0gW107XG4gICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVyU3ludGhDb21tYW5kcygpKTtcbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogJ1N5bnRoQ0RLQXBwbGljYXRpb24nLFxuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgU291cmNlczogWydXb3JrZmxvd1NvdXJjZSddLFxuICAgICAgICBWYXJpYWJsZXM6IHtcbiAgICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHN0ZXBzOlxuICAgICAgICBjbWRzLFxuICAgICAgLy8gRklYTUUgaXMgdGhlcmUgaXMgYW4gZW52aXJvbm1lbnQsIGNvbm5lY3QgaXQgdG8gdGhlIHdvcmtmbG93XG4gICAgICAvLyBuZWVkcyB0byByZWFjdCBvbiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LnN5bnRoXG4gICAgICAvL2Vudmlyb25tZW50OiBlbnZpcm9ubWVudCAmJiBjb252ZXJ0VG9Xb3JrZmxvd0Vudmlyb25tZW50KGVudmlyb25tZW50KSxcblxuICAgICAgLy8gRklYTUUgd2hhdCBhYm91dCB0aGUgcGVybWlzc2lvbnM/XG4gICAgICAvLyBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG5cbiAgICAgIG91dHB1dDoge30sXG4gICAgfSk7XG5cbiAgICAvKlxubm90IHJlcXVpcmVkIGJlY2F1c2UgY29kZWNhdGFseXN0IGF1dG9tYXRpY2FsbHkgdXBsb2FkcyBhcnRpZmFjdHNcbnN0ZXBzLnB1c2goe1xuICAgICAgdXNlczogJ2FjdGlvbnMvdXBsb2FkLWFydGlmYWN0QHYzJyxcbiAgICAgIHdpdGg6IHtcbiAgICAgICAgbmFtZTogJ2Nsb3VkLWFzc2VtYmx5JyxcbiAgICAgICAgcGF0aDogYCR7dGhpcy5hcHAuY2RrQ29uZmlnLmNka291dH0vYCxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgKi9cbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVBc3NldFVwbG9hZCgpOiB2b2lkIHtcblxuICAgIGNvbnN0IGNtZHM6IHN0cmluZ1tdID0gW107XG4gICAgY21kcy5wdXNoKC4uLnRoaXMuZ2V0QXNzZXRVcGxvYWRDb21tYW5kcyh0aGlzLm5lZWRzVmVyc2lvbmVkQXJ0aWZhY3RzKSk7XG4gICAgdGhpcy5kZXBsb3ltZW50V29ya2Zsb3dCdWlsZGVyLmFkZEJ1aWxkQWN0aW9uKHtcbiAgICAgIGFjdGlvbk5hbWU6ICdQdWJsaXNoQXNzZXRzVG9BV1MnLFxuICAgICAgZGVwZW5kc09uOiBbJ1N5bnRoQ0RLQXBwbGljYXRpb24nXSxcbiAgICAgIGlucHV0OiB7XG4gICAgICAgIFNvdXJjZXM6IFsnV29ya2Zsb3dTb3VyY2UnXSxcbiAgICAgICAgVmFyaWFibGVzOiB7XG4gICAgICAgICAgQ0k6ICd0cnVlJyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBzdGVwczpcbiAgICAgICAgY21kcyxcbiAgICAgIC8vIEZJWE1FIGlzIHRoZXJlIGlzIGFuIGVudmlyb25tZW50LCBjb25uZWN0IGl0IHRvIHRoZSB3b3JrZmxvd1xuICAgICAgLy8gbmVlZHMgdG8gcmVhY3Qgb24gdGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zPy5zeW50aFxuICAgICAgLy9lbnZpcm9ubWVudDogZW52aXJvbm1lbnQgJiYgY29udmVydFRvV29ya2Zsb3dFbnZpcm9ubWVudChlbnZpcm9ubWVudCksXG5cbiAgICAgIC8vIEZJWE1FIHdoYXQgYWJvdXQgdGhlIHBlcm1pc3Npb25zP1xuICAgICAgLy8gcGVybWlzc2lvbnM6IHsgaWRUb2tlbjogSm9iUGVybWlzc2lvbi5XUklURSwgY29udGVudHM6IEpvYlBlcm1pc3Npb24uUkVBRCB9LFxuXG4gICAgICBvdXRwdXQ6IHt9LFxuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZURlcGxveW1lbnQoc3RhZ2U6IERlcGxveW1lbnRTdGFnZSk6IHZvaWQge1xuICAgIGlmIChzdGFnZS5tYW51YWxBcHByb3ZhbCA9PT0gdHJ1ZSkge1xuICAgICAgLy8gQ3JlYXRlIG5ldyBkZXBsb3ltZW50IHdvcmtmbG93IGZvciBzdGFnZVxuICAgICAgdGhpcy5jcmVhdGVXb3JrZmxvd0ZvclN0YWdlKHN0YWdlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQWRkIGRlcGxveW1lbnQgdG8gZXhpc3Rpbmcgd29ya2Zsb3dcbiAgICAgIGNvbnN0IGNtZHM6IHN0cmluZ1tdID0gW107XG4gICAgICBjbWRzLnB1c2goLi4udGhpcy5yZW5kZXJJbnN0YWxsQ29tbWFuZHMoKSk7XG4gICAgICBjbWRzLnB1c2goLi4udGhpcy5yZW5kZXJEZXBsb3lDb21tYW5kcyhzdGFnZS5uYW1lKSk7XG4gICAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkQnVpbGRBY3Rpb24oe1xuICAgICAgICBhY3Rpb25OYW1lOiBgZGVwbG95LSR7c3RhZ2UubmFtZX1gLFxuICAgICAgICBkZXBlbmRzT246IHRoaXMuZGVwbG95bWVudFN0YWdlcy5sZW5ndGggPiAwID8gWydQdWJsaXNoIGFzc2V0cyB0byBBV1MnLCBgZGVwbG95LSR7dGhpcy5kZXBsb3ltZW50U3RhZ2VzLmF0KC0xKSF9YF0gOiBbJ1B1Ymxpc2ggYXNzZXRzIHRvIEFXUyddLFxuICAgICAgICBpbnB1dDoge1xuICAgICAgICAgIFNvdXJjZXM6IFsnV29ya2Zsb3dTb3VyY2UnXSxcbiAgICAgICAgICBWYXJpYWJsZXM6IHtcbiAgICAgICAgICAgIENJOiAndHJ1ZScsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgc3RlcHM6XG4gICAgICAgIGNtZHMsXG4gICAgICAgIC8vIEZJWE1FIGlzIHRoZXJlIGlzIGFuIGVudmlyb25tZW50LCBjb25uZWN0IGl0IHRvIHRoZSB3b3JrZmxvd1xuICAgICAgICAvLyBuZWVkcyB0byByZWFjdCBvbiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LnN5bnRoXG4gICAgICAgIC8vZW52aXJvbm1lbnQ6IGVudmlyb25tZW50ICYmIGNvbnZlcnRUb1dvcmtmbG93RW52aXJvbm1lbnQoZW52aXJvbm1lbnQpLFxuXG4gICAgICAgIC8vIEZJWE1FIHdoYXQgYWJvdXQgdGhlIHBlcm1pc3Npb25zP1xuICAgICAgICAvLyBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG5cbiAgICAgICAgb3V0cHV0OiB7fSxcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLmRlcGxveW1lbnRTdGFnZXMucHVzaChzdGFnZS5uYW1lKTtcbiAgICB9XG4gIH1cblxuICBjcmVhdGVXb3JrZmxvd0ZvclN0YWdlKHN0YWdlOiBEZXBsb3ltZW50U3RhZ2UpIHtcbiAgICBjb25zb2xlLmxvZyhzdGFnZSk7XG4gICAgY29uc3QgZGVwbG95bWVudFN0YWdlV29ya2Zsb3dCdWlsZGVyID0gbmV3IFdvcmtmbG93QnVpbGRlcih0aGlzLmJwKTtcblxuICAgIGRlcGxveW1lbnRTdGFnZVdvcmtmbG93QnVpbGRlci5zZXROYW1lKGByZWxlYXNlLSR7c3RhZ2UubmFtZX1gKTtcblxuICAgIC8vIEFkZCBkZXBsb3ltZW50IHRvIG5ldyB3b3JrZmxvd1xuICAgIGNvbnN0IGNtZHM6IHN0cmluZ1tdID0gW107XG4gICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVySW5zdGFsbENvbW1hbmRzKCkpO1xuICAgIGNtZHMucHVzaCguLi50aGlzLnJlbmRlckluc3RhbGxQYWNrYWdlQ29tbWFuZHMoYCR7dGhpcy5vcHRpb25zLnBrZ05hbWVzcGFjZX0vJHt0aGlzLmFwcC5uYW1lfUBcXCR7e2dpdGh1Yi5ldmVudC5pbnB1dHMudmVyc2lvbn19YCkpO1xuICAgIGNtZHMucHVzaChgbXYgLi9ub2RlX21vZHVsZXMvJHt0aGlzLm9wdGlvbnMucGtnTmFtZXNwYWNlfS8ke3RoaXMuYXBwLm5hbWV9ICR7dGhpcy5hcHAuY2RrQ29uZmlnLmNka291dH1gKTtcbiAgICBjbWRzLnB1c2goLi4udGhpcy5yZW5kZXJEZXBsb3lDb21tYW5kcyhzdGFnZS5uYW1lKSk7XG4gICAgZGVwbG95bWVudFN0YWdlV29ya2Zsb3dCdWlsZGVyLmFkZEJ1aWxkQWN0aW9uKHtcbiAgICAgIGFjdGlvbk5hbWU6IGBkZXBsb3ktJHtzdGFnZS5uYW1lfWAsXG4gICAgICAvLyBuZWVkczogdGhpcy5kZXBsb3ltZW50U3RhZ2VzLmxlbmd0aCA+IDAgPyBbJ2Fzc2V0VXBsb2FkJywgYGRlcGxveS0ke3RoaXMuZGVwbG95bWVudFN0YWdlcy5hdCgtMSkhfWBdIDogWydhc3NldFVwbG9hZCddLFxuICAgICAgZGVwZW5kc09uOiBbJ1N5bnRoQ0RLQXBwbGljYXRpb24nXSxcbiAgICAgIGlucHV0OiB7XG4gICAgICAgIFNvdXJjZXM6IFsnV29ya2Zsb3dTb3VyY2UnXSxcbiAgICAgICAgVmFyaWFibGVzOiB7XG4gICAgICAgICAgQ0k6ICd0cnVlJyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBzdGVwczpcbiAgY21kcyxcbiAgICAgIC8vIEZJWE1FIGlzIHRoZXJlIGlzIGFuIGVudmlyb25tZW50LCBjb25uZWN0IGl0IHRvIHRoZSB3b3JrZmxvd1xuICAgICAgLy8gbmVlZHMgdG8gcmVhY3Qgb24gdGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zPy5zeW50aFxuICAgICAgLy9lbnZpcm9ubWVudDogZW52aXJvbm1lbnQgJiYgY29udmVydFRvV29ya2Zsb3dFbnZpcm9ubWVudChlbnZpcm9ubWVudCksXG5cbiAgICAgIC8vIEZJWE1FIHdoYXQgYWJvdXQgdGhlIHBlcm1pc3Npb25zP1xuICAgICAgLy8gcGVybWlzc2lvbnM6IHsgaWRUb2tlbjogSm9iUGVybWlzc2lvbi5XUklURSwgY29udGVudHM6IEpvYlBlcm1pc3Npb24uUkVBRCB9LFxuXG4gICAgICBvdXRwdXQ6IHt9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgeW1sID0gbmV3IFlhbWxGaWxlKHRoaXMsIGAuY29kZWNhdGFseXN0L3dvcmtmbG93cy9yZWxlYXNlLSR7c3RhZ2UubmFtZX0ueWFtbGAsIHtcbiAgICAgIG9iajogZGVwbG95bWVudFN0YWdlV29ya2Zsb3dCdWlsZGVyLmdldERlZmluaXRpb24oKSxcblxuICAgIH0pO1xuICAgIHltbC5zeW50aGVzaXplKCk7XG4gIH1cblxufVxuIl19