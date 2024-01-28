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
            actionName: 'Synth CDK application',
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
            actionName: 'Publish assets to AWS',
            dependsOn: ['Synth CDK application'],
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
            dependsOn: ['Synth CDK application'],
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29kZWNhdGFseXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2F3c2Nkay9jb2RlY2F0YWx5c3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxzR0FBcUY7QUFDckYsbUNBQTBDO0FBQzFDLGlDQUEwRTtBQUUxRSx3REFBcUQ7QUFjckQsTUFBYSx1QkFBd0IsU0FBUSxrQkFBVztJQVN0RCxZQUFZLEdBQStCLEVBQVUsT0FBdUM7UUFDMUYsS0FBSyxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUQrQixZQUFPLEdBQVAsT0FBTyxDQUFnQztRQUpwRixxQkFBZ0IsR0FBYSxFQUFFLENBQUM7UUFFaEMsT0FBRSxHQUFjLElBQUkscUJBQVMsQ0FBQyxFQUFFLE1BQU0sRUFBRSx5QkFBeUIsRUFBRSxDQUFDLENBQUM7UUFLM0UsSUFBSSxDQUFDLHlCQUF5QixHQUFHLElBQUksK0NBQWUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFOUQsSUFBSSxDQUFDLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNqRCxJQUFJLENBQUMseUJBQXlCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBRTFELElBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsY0FBYyxLQUFLLElBQUksQ0FBQyxLQUFLLFNBQVMsQ0FBQztRQUV0RyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFbkIsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFFekIsS0FBSyxNQUFNLEtBQUssSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFO1lBQ2xDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUM5QjtRQUVELE1BQU0sR0FBRyxHQUFH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LGdCQUFnQixDQUFDO2dCQUMzQixTQUFTLEVBQUU7b0JBQ1QsRUFBRSxFQUFFLE1BQU07aUJBQ1g7YUFDRjtZQUNELEtBQUssRUFDVCxJQUFJO1lBQ0EsK0RBQStEO1lBQy9ELG9EQUFvRDtZQUNwRCx3RUFBd0U7WUFFeEUsb0NBQW9DO1lBQ3BDLCtFQUErRTtZQUUvRSxNQUFNLEVBQUUsRUFBRTtTQUNYLENBQUMsQ0FBQztRQUVILE1BQU0sR0FBRyxHQUFHLElBQUksaUJBQVEsQ0FBQyxJQUFJLEVBQUUsbUNBQW1DLEtBQUssQ0FBQyxJQUFJLE9BQU8sRUFBRTtZQUNuRixHQUFHLEVBQUUsOEJBQThCLENBQUMsYUFBYSxFQUFFO1NBRXBELENBQUMsQ0FBQztRQUNILEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQztJQUNuQixDQUFDOztBQTNLSCwwREE2S0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBXb3JrZmxvd0J1aWxkZXIgfSBmcm9tICdAYW1hem9uLWNvZGVjYXRhbHlzdC9ibHVlcHJpbnQtY29tcG9uZW50LndvcmtmbG93cyc7XG5pbXBvcnQgeyBZYW1sRmlsZSwgYXdzY2RrIH0gZnJvbSAncHJvamVuJztcbmltcG9ydCB7IENES1BpcGVsaW5lLCBDREtQaXBlbGluZU9wdGlvbnMsIERlcGxveW1lbnRTdGFnZSB9IGZyb20gJy4vYmFzZSc7XG5cbmltcG9ydCB7IEJsdWVwcmludCB9IGZyb20gJy4vY29kZWNhdGFseXN0L2JsdWVwcmludCc7XG5cblxuZXhwb3J0IGludGVyZmFjZSBDb2RlQ2F0YWx5c3RJYW1Sb2xlQ29uZmlnIHtcbiAgcmVhZG9ubHkgZGVmYXVsdD86IHN0cmluZztcbiAgcmVhZG9ubHkgc3ludGg/OiBzdHJpbmc7XG4gIHJlYWRvbmx5IGFzc2V0UHVibGlzaGluZz86IHN0cmluZztcbiAgcmVhZG9ubHkgZGVwbG95bWVudD86IHsgW3N0YWdlOiBzdHJpbmddOiBzdHJpbmcgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb2RlQ2F0YWx5c3RDREtQaXBlbGluZU9wdGlvbnMgZXh0ZW5kcyBDREtQaXBlbGluZU9wdGlvbnMge1xuICByZWFkb25seSBpYW1Sb2xlQXJuczogQ29kZUNhdGFseXN0SWFtUm9sZUNvbmZpZztcbn1cblxuZXhwb3J0IGNsYXNzIENvZGVDYXRhbHlzdENES1BpcGVsaW5lIGV4dGVuZHMgQ0RLUGlwZWxpbmUge1xuXG4gIHB1YmxpYyByZWFkb25seSBuZWVkc1ZlcnNpb25lZEFydGlmYWN0czogYm9vbGVhbjtcblxuICBwcml2YXRlIGRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXI6IFdvcmtmbG93QnVpbGRlcjtcbiAgcHJpdmF0ZSBkZXBsb3ltZW50U3RhZ2VzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIHByaXZhdGUgYnA6IEJsdWVwcmludCA9IG5ldyBCbHVlcHJpbnQoeyBvdXRkaXI6ICcuY29kZWNhdGFseXN0L3dvcmtmbG93cycgfSk7XG5cbiAgY29uc3RydWN0b3IoYXBwOiBhd3NjZGsuQXdzQ2RrVHlwZVNjcmlwdEFwcCwgcHJpdmF0ZSBvcHRpb25zOiBDb2RlQ2F0YWx5c3RDREtQaXBlbGluZU9wdGlvbnMpIHtcbiAgICBzdXBlcihhcHAsIG9wdGlvbnMpO1xuXG4gICAgdGhpcy5kZXBsb3ltZW50V29ya2Zsb3dCdWlsZGVyID0gbmV3IFdvcmtmbG93QnVpbGRlcih0aGlzLmJwKTtcblxuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93QnVpbGRlci5zZXROYW1lKCdkZXBsb3knKTtcbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkQnJhbmNoVHJpZ2dlcihbJ21haW4nXSk7XG5cbiAgICB0aGlzLm5lZWRzVmVyc2lvbmVkQXJ0aWZhY3RzID0gdGhpcy5vcHRpb25zLnN0YWdlcy5maW5kKHMgPT4gcy5tYW51YWxBcHByb3ZhbCA9PT0gdHJ1ZSkgIT09IHVuZGVmaW5lZDtcblxuICAgIHRoaXMuY3JlYXRlU3ludGgoKTtcblxuICAgIHRoaXMuY3JlYXRlQXNzZXRVcGxvYWQoKTtcblxuICAgIGZvciAoY29uc3Qgc3RhZ2Ugb2Ygb3B0aW9ucy5zdGFnZXMpIHtcbiAgICAgIHRoaXMuY3JlYXRlRGVwbG95bWVudChzdGFnZSk7XG4gICAgfVxuXG4gICAgY29uc3QgeW1sID0gbmV3IFlhbWxGaWxlKHRoaXMsICcuY29kZWNhdGFseXN0L3dvcmtmbG93cy9kZXBsb3kueWFtbCcsIHtcbiAgICAgIG9iajogdGhpcy5kZXBsb3ltZW50V29ya2Zsb3dCdWlsZGVyLmdldERlZmluaXRpb24oKSxcblxuICAgIH0pO1xuICAgIHltbC5zeW50aGVzaXplKCk7XG5cblxuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVTeW50aCgpOiB2b2lkIHtcblxuICAgIGNvbnN0IGNtZHM6IHN0cmluZ1tdID0gW107XG4gICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVyU3ludGhDb21tYW5kcygpKTtcbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogJ1N5bnRoIENESyBhcHBsaWNhdGlvbicsXG4gICAgICBpbnB1dDoge1xuICAgICAgICBTb3VyY2VzOiBbJ1dvcmtmbG93U291cmNlJ10sXG4gICAgICAgIFZhcmlhYmxlczoge1xuICAgICAgICAgIENJOiAndHJ1ZScsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgc3RlcHM6XG4gICAgICAgIGNtZHMsXG4gICAgICAvLyBGSVhNRSBpcyB0aGVyZSBpcyBhbiBlbnZpcm9ubWVudCwgY29ubmVjdCBpdCB0byB0aGUgd29ya2Zsb3dcbiAgICAgIC8vIG5lZWRzIHRvIHJlYWN0IG9uIHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucz8uc3ludGhcbiAgICAgIC8vZW52aXJvbm1lbnQ6IGVudmlyb25tZW50ICYmIGNvbnZlcnRUb1dvcmtmbG93RW52aXJvbm1lbnQoZW52aXJvbm1lbnQpLFxuXG4gICAgICAvLyBGSVhNRSB3aGF0IGFib3V0IHRoZSBwZXJtaXNzaW9ucz9cbiAgICAgIC8vIHBlcm1pc3Npb25zOiB7IGlkVG9rZW46IEpvYlBlcm1pc3Npb24uV1JJVEUsIGNvbnRlbnRzOiBKb2JQZXJtaXNzaW9uLlJFQUQgfSxcblxuICAgICAgb3V0cHV0OiB7fSxcbiAgICB9KTtcblxuICAgIC8qXG5ub3QgcmVxdWlyZWQgYmVjYXVzZSBjb2RlY2F0YWx5c3QgYXV0b21hdGljYWxseSB1cGxvYWRzIGFydGlmYWN0c1xuc3RlcHMucHVzaCh7XG4gICAgICB1c2VzOiAnYWN0aW9ucy91cGxvYWQtYXJ0aWZhY3RAdjMnLFxuICAgICAgd2l0aDoge1xuICAgICAgICBuYW1lOiAnY2xvdWQtYXNzZW1ibHknLFxuICAgICAgICBwYXRoOiBgJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fS9gLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICAqL1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZUFzc2V0VXBsb2FkKCk6IHZvaWQge1xuXG4gICAgY29uc3QgY21kczogc3RyaW5nW10gPSBbXTtcbiAgICBjbWRzLnB1c2goLi4udGhpcy5nZXRBc3NldFVwbG9hZENvbW1hbmRzKHRoaXMubmVlZHNWZXJzaW9uZWRBcnRpZmFjdHMpKTtcbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogJ1B1Ymxpc2ggYXNzZXRzIHRvIEFXUycsXG4gICAgICBkZXBlbmRzT246IFsnU3ludGggQ0RLIGFwcGxpY2F0aW9uJ10sXG4gICAgICBpbnB1dDoge1xuICAgICAgICBTb3VyY2VzOiBbJ1dvcmtmbG93U291cmNlJ10sXG4gICAgICAgIFZhcmlhYmxlczoge1xuICAgICAgICAgIENJOiAndHJ1ZScsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgc3RlcHM6XG4gICAgICAgIGNtZHMsXG4gICAgICAvLyBGSVhNRSBpcyB0aGVyZSBpcyBhbiBlbnZpcm9ubWVudCwgY29ubmVjdCBpdCB0byB0aGUgd29ya2Zsb3dcbiAgICAgIC8vIG5lZWRzIHRvIHJlYWN0IG9uIHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucz8uc3ludGhcbiAgICAgIC8vZW52aXJvbm1lbnQ6IGVudmlyb25tZW50ICYmIGNvbnZlcnRUb1dvcmtmbG93RW52aXJvbm1lbnQoZW52aXJvbm1lbnQpLFxuXG4gICAgICAvLyBGSVhNRSB3aGF0IGFib3V0IHRoZSBwZXJtaXNzaW9ucz9cbiAgICAgIC8vIHBlcm1pc3Npb25zOiB7IGlkVG9rZW46IEpvYlBlcm1pc3Npb24uV1JJVEUsIGNvbnRlbnRzOiBKb2JQZXJtaXNzaW9uLlJFQUQgfSxcblxuICAgICAgb3V0cHV0OiB7fSxcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVEZXBsb3ltZW50KHN0YWdlOiBEZXBsb3ltZW50U3RhZ2UpOiB2b2lkIHtcbiAgICBpZiAoc3RhZ2UubWFudWFsQXBwcm92YWwgPT09IHRydWUpIHtcbiAgICAgIC8vIENyZWF0ZSBuZXcgZGVwbG95bWVudCB3b3JrZmxvdyBmb3Igc3RhZ2VcbiAgICAgIHRoaXMuY3JlYXRlV29ya2Zsb3dGb3JTdGFnZShzdGFnZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEFkZCBkZXBsb3ltZW50IHRvIGV4aXN0aW5nIHdvcmtmbG93XG4gICAgICBjb25zdCBjbWRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVySW5zdGFsbENvbW1hbmRzKCkpO1xuICAgICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVyRGVwbG95Q29tbWFuZHMoc3RhZ2UubmFtZSkpO1xuICAgICAgdGhpcy5kZXBsb3ltZW50V29ya2Zsb3dCdWlsZGVyLmFkZEJ1aWxkQWN0aW9uKHtcbiAgICAgICAgYWN0aW9uTmFtZTogYGRlcGxveS0ke3N0YWdlLm5hbWV9YCxcbiAgICAgICAgZGVwZW5kc09uOiB0aGlzLmRlcGxveW1lbnRTdGFnZXMubGVuZ3RoID4gMCA/IFsnUHVibGlzaCBhc3NldHMgdG8gQVdTJywgYGRlcGxveS0ke3RoaXMuZGVwbG95bWVudFN0YWdlcy5hdCgtMSkhfWBdIDogWydQdWJsaXNoIGFzc2V0cyB0byBBV1MnXSxcbiAgICAgICAgaW5wdXQ6IHtcbiAgICAgICAgICBTb3VyY2VzOiBbJ1dvcmtmbG93U291cmNlJ10sXG4gICAgICAgICAgVmFyaWFibGVzOiB7XG4gICAgICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHN0ZXBzOlxuICAgICAgICBjbWRzLFxuICAgICAgICAvLyBGSVhNRSBpcyB0aGVyZSBpcyBhbiBlbnZpcm9ubWVudCwgY29ubmVjdCBpdCB0byB0aGUgd29ya2Zsb3dcbiAgICAgICAgLy8gbmVlZHMgdG8gcmVhY3Qgb24gdGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zPy5zeW50aFxuICAgICAgICAvL2Vudmlyb25tZW50OiBlbnZpcm9ubWVudCAmJiBjb252ZXJ0VG9Xb3JrZmxvd0Vudmlyb25tZW50KGVudmlyb25tZW50KSxcblxuICAgICAgICAvLyBGSVhNRSB3aGF0IGFib3V0IHRoZSBwZXJtaXNzaW9ucz9cbiAgICAgICAgLy8gcGVybWlzc2lvbnM6IHsgaWRUb2tlbjogSm9iUGVybWlzc2lvbi5XUklURSwgY29udGVudHM6IEpvYlBlcm1pc3Npb24uUkVBRCB9LFxuXG4gICAgICAgIG91dHB1dDoge30sXG4gICAgICB9KTtcblxuICAgICAgdGhpcy5kZXBsb3ltZW50U3RhZ2VzLnB1c2goc3RhZ2UubmFtZSk7XG4gICAgfVxuICB9XG5cbiAgY3JlYXRlV29ya2Zsb3dGb3JTdGFnZShzdGFnZTogRGVwbG95bWVudFN0YWdlKSB7XG4gICAgY29uc29sZS5sb2coc3RhZ2UpO1xuICAgIGNvbnN0IGRlcGxveW1lbnRTdGFnZVdvcmtmbG93QnVpbGRlciA9IG5ldyBXb3JrZmxvd0J1aWxkZXIodGhpcy5icCk7XG5cbiAgICBkZXBsb3ltZW50U3RhZ2VXb3JrZmxvd0J1aWxkZXIuc2V0TmFtZShgcmVsZWFzZS0ke3N0YWdlLm5hbWV9YCk7XG5cbiAgICAvLyBBZGQgZGVwbG95bWVudCB0byBuZXcgd29ya2Zsb3dcbiAgICBjb25zdCBjbWRzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNtZHMucHVzaCguLi50aGlzLnJlbmRlckluc3RhbGxDb21tYW5kcygpKTtcbiAgICBjbWRzLnB1c2goLi4udGhpcy5yZW5kZXJJbnN0YWxsUGFja2FnZUNvbW1hbmRzKGAke3RoaXMub3B0aW9ucy5wa2dOYW1lc3BhY2V9LyR7dGhpcy5hcHAubmFtZX1AXFwke3tnaXRodWIuZXZlbnQuaW5wdXRzLnZlcnNpb259fWApKTtcbiAgICBjbWRzLnB1c2goYG12IC4vbm9kZV9tb2R1bGVzLyR7dGhpcy5vcHRpb25zLnBrZ05hbWVzcGFjZX0vJHt0aGlzLmFwcC5uYW1lfSAke3RoaXMuYXBwLmNka0NvbmZpZy5jZGtvdXR9YCk7XG4gICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVyRGVwbG95Q29tbWFuZHMoc3RhZ2UubmFtZSkpO1xuICAgIGRlcGxveW1lbnRTdGFnZVdvcmtmbG93QnVpbGRlci5hZGRCdWlsZEFjdGlvbih7XG4gICAgICBhY3Rpb25OYW1lOiBgZGVwbG95LSR7c3RhZ2UubmFtZX1gLFxuICAgICAgLy8gbmVlZHM6IHRoaXMuZGVwbG95bWVudFN0YWdlcy5sZW5ndGggPiAwID8gWydhc3NldFVwbG9hZCcsIGBkZXBsb3ktJHt0aGlzLmRlcGxveW1lbnRTdGFnZXMuYXQoLTEpIX1gXSA6IFsnYXNzZXRVcGxvYWQnXSxcbiAgICAgIGRlcGVuZHNPbjogWydTeW50aCBDREsgYXBwbGljYXRpb24nXSxcbiAgICAgIGlucHV0OiB7XG4gICAgICAgIFNvdXJjZXM6IFsnV29ya2Zsb3dTb3VyY2UnXSxcbiAgICAgICAgVmFyaWFibGVzOiB7XG4gICAgICAgICAgQ0k6ICd0cnVlJyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBzdGVwczpcbiAgY21kcyxcbiAgICAgIC8vIEZJWE1FIGlzIHRoZXJlIGlzIGFuIGVudmlyb25tZW50LCBjb25uZWN0IGl0IHRvIHRoZSB3b3JrZmxvd1xuICAgICAgLy8gbmVlZHMgdG8gcmVhY3Qgb24gdGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zPy5zeW50aFxuICAgICAgLy9lbnZpcm9ubWVudDogZW52aXJvbm1lbnQgJiYgY29udmVydFRvV29ya2Zsb3dFbnZpcm9ubWVudChlbnZpcm9ubWVudCksXG5cbiAgICAgIC8vIEZJWE1FIHdoYXQgYWJvdXQgdGhlIHBlcm1pc3Npb25zP1xuICAgICAgLy8gcGVybWlzc2lvbnM6IHsgaWRUb2tlbjogSm9iUGVybWlzc2lvbi5XUklURSwgY29udGVudHM6IEpvYlBlcm1pc3Npb24uUkVBRCB9LFxuXG4gICAgICBvdXRwdXQ6IHt9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgeW1sID0gbmV3IFlhbWxGaWxlKHRoaXMsIGAuY29kZWNhdGFseXN0L3dvcmtmbG93cy9yZWxlYXNlLSR7c3RhZ2UubmFtZX0ueWFtbGAsIHtcbiAgICAgIG9iajogZGVwbG95bWVudFN0YWdlV29ya2Zsb3dCdWlsZGVyLmdldERlZmluaXRpb24oKSxcblxuICAgIH0pO1xuICAgIHltbC5zeW50aGVzaXplKCk7XG4gIH1cblxufVxuIl19