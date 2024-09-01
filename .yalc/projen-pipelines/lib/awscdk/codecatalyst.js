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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29kZWNhdGFseXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2F3c2Nkay9jb2RlY2F0YWx5c3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxzR0FBcUY7QUFDckYsbUNBQTBDO0FBQzFDLGlDQUEwRTtBQUUxRSx3REFBcUQ7QUFDckQsc0NBQTJDO0FBYzNDLE1BQWEsdUJBQXdCLFNBQVEsa0JBQVc7SUFTdEQsWUFBWSxHQUErQixFQUFVLE9BQXVDO1FBQzFGLEtBQUssQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFEK0IsWUFBTyxHQUFQLE9BQU8sQ0FBZ0M7UUFKcEYscUJBQWdCLEdBQWEsRUFBRSxDQUFDO1FBTXRDLGdFQUFnRTtRQUNoRSxPQUFPLENBQUMsR0FBRyxDQUFDLHFCQUFxQixHQUFDLE1BQU0sQ0FBQztRQUV6QyxJQUFJLENBQUMsRUFBRSxHQUFHLElBQUkscUJBQVMsQ0FBQyxFQUFFLE1BQU0sRUFBRSx5QkFBeUIsRUFBRSxDQUFDLENBQUM7UUFDL0QsSUFBSSxDQUFDLHlCQUF5QixHQUFHLElBQUksK0NBQWUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFOUQsSUFBSSxDQUFDLHlCQUF5QixDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNqRCxJQUFJLENBQUMseUJBQXlCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBRTFELElBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsY0FBYyxLQUFLLElBQUksQ0FBQyxLQUFLLFNBQVMsQ0FBQztRQUV0RyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDbkIsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFFekIsS0FBSyxNQUFNLEtBQUssSUFBSSxPQUFP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ciB9IGZyb20gJ0BhbWF6b24tY29kZWNhdGFseXN0L2JsdWVwcmludC1jb21wb25lbnQud29ya2Zsb3dzJztcbmltcG9ydCB7IFlhbWxGaWxlLCBhd3NjZGsgfSBmcm9tICdwcm9qZW4nO1xuaW1wb3J0IHsgQ0RLUGlwZWxpbmUsIENES1BpcGVsaW5lT3B0aW9ucywgRGVwbG95bWVudFN0YWdlIH0gZnJvbSAnLi9iYXNlJztcblxuaW1wb3J0IHsgQmx1ZXByaW50IH0gZnJvbSAnLi9jb2RlY2F0YWx5c3QvYmx1ZXByaW50JztcbmltcG9ydCB7IFBpcGVsaW5lRW5naW5lIH0gZnJvbSAnLi4vZW5naW5lJztcblxuXG5leHBvcnQgaW50ZXJmYWNlIENvZGVDYXRhbHlzdElhbVJvbGVDb25maWcge1xuICByZWFkb25seSBkZWZhdWx0Pzogc3RyaW5nO1xuICByZWFkb25seSBzeW50aD86IHN0cmluZztcbiAgcmVhZG9ubHkgYXNzZXRQdWJsaXNoaW5nPzogc3RyaW5nO1xuICByZWFkb25seSBkZXBsb3ltZW50PzogeyBbc3RhZ2U6IHN0cmluZ106IHN0cmluZyB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvZGVDYXRhbHlzdENES1BpcGVsaW5lT3B0aW9ucyBleHRlbmRzIENES1BpcGVsaW5lT3B0aW9ucyB7XG4gIHJlYWRvbmx5IGlhbVJvbGVBcm5zOiBDb2RlQ2F0YWx5c3RJYW1Sb2xlQ29uZmlnO1xufVxuXG5leHBvcnQgY2xhc3MgQ29kZUNhdGFseXN0Q0RLUGlwZWxpbmUgZXh0ZW5kcyBDREtQaXBlbGluZSB7XG5cbiAgcHVibGljIHJlYWRvbmx5IG5lZWRzVmVyc2lvbmVkQXJ0aWZhY3RzOiBib29sZWFuO1xuXG4gIHByaXZhdGUgZGVwbG95bWVudFdvcmtmbG93QnVpbGRlcjogV29ya2Zsb3dCdWlsZGVyO1xuICBwcml2YXRlIGRlcGxveW1lbnRTdGFnZXM6IHN0cmluZ1tdID0gW107XG5cbiAgcHJpdmF0ZSByZWFkb25seSBicDogQmx1ZXByaW50O1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogYXdzY2RrLkF3c0Nka1R5cGVTY3JpcHRBcHAsIHByaXZhdGUgb3B0aW9uczogQ29kZUNhdGFseXN0Q0RLUGlwZWxpbmVPcHRpb25zKSB7XG4gICAgc3VwZXIoYXBwLCBvcHRpb25zKTtcbiAgICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2F3cy9jb2RlY2F0YWx5c3QtYmx1ZXByaW50cy9pc3N1ZXMvNDc3XG4gICAgcHJvY2Vzcy5lbnYuQ09OVEVYVF9FTlZJUk9OTUVOVElEPSdwcm9kJztcblxuICAgIHRoaXMuYnAgPSBuZXcgQmx1ZXByaW50KHsgb3V0ZGlyOiAnLmNvZGVjYXRhbHlzdC93b3JrZmxvd3MnIH0pO1xuICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93QnVpbGRlciA9IG5ldyBXb3JrZmxvd0J1aWxkZXIodGhpcy5icCk7XG5cbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuc2V0TmFtZSgnZGVwbG95Jyk7XG4gICAgdGhpcy5kZXBsb3ltZW50V29ya2Zsb3dCdWlsZGVyLmFkZEJyYW5jaFRyaWdnZXIoWydtYWluJ10pO1xuXG4gICAgdGhpcy5uZWVkc1ZlcnNpb25lZEFydGlmYWN0cyA9IHRoaXMub3B0aW9ucy5zdGFnZXMuZmluZChzID0+IHMubWFudWFsQXBwcm92YWwgPT09IHRydWUpICE9PSB1bmRlZmluZWQ7XG5cbiAgICB0aGlzLmNyZWF0ZVN5bnRoKCk7XG4gICAgdGhpcy5jcmVhdGVBc3NldFVwbG9hZCgpO1xuXG4gICAgZm9yIChjb25zdCBzdGFnZSBvZiBvcHRpb25zLnN0YWdlcykge1xuICAgICAgdGhpcy5jcmVhdGVEZXBsb3ltZW50KHN0YWdlKTtcbiAgICB9XG5cbiAgICBjb25zdCB5bWwgPSBuZXcgWWFtbEZpbGUodGhpcywgJy5jb2RlY2F0YWx5c3Qvd29ya2Zsb3dzL2RlcGxveS55YW1sJywge1xuICAgICAgb2JqOiB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuZ2V0RGVmaW5pdGlvbigpLFxuXG4gICAgfSk7XG4gICAgeW1sLnN5bnRoZXNpemUoKTtcbiAgfVxuXG4gICAgLyoqIHRoZSB0eXBlIG9mIGVuZ2luZSB0aGlzIGltcGxlbWVudGF0aW9uIG9mIENES1BpcGVsaW5lIGlzIGZvciAqL1xuICAgIHB1YmxpYyBlbmdpbmVUeXBlKCk6IFBpcGVsaW5lRW5naW5lIHtcbiAgICAgIHJldHVybiBQaXBlbGluZUVuZ2luZS5DT0RFX0NBVEFMWVNUO1xuICAgIH1cblxuICBwcml2YXRlIGNyZWF0ZVN5bnRoKCk6IHZvaWQge1xuXG4gICAgY29uc3QgY21kczogc3RyaW5nW10gPSBbXTtcbiAgICBjbWRzLnB1c2goLi4udGhpcy5yZW5kZXJJbnN0YWxsQ29tbWFuZHMoKSk7XG4gICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVyU3ludGhDb21tYW5kcygpKTtcbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogJ1N5bnRoQ0RLQXBwbGljYXRpb24nLFxuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgU291cmNlczogWydXb3JrZmxvd1NvdXJjZSddLFxuICAgICAgICBWYXJpYWJsZXM6IHtcbiAgICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHN0ZXBzOlxuICAgICAgICBjbWRzLFxuICAgICAgLy8gRklYTUUgaXMgdGhlcmUgaXMgYW4gZW52aXJvbm1lbnQsIGNvbm5lY3QgaXQgdG8gdGhlIHdvcmtmbG93XG4gICAgICAvLyBuZWVkcyB0byByZWFjdCBvbiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LnN5bnRoXG4gICAgICAvL2Vudmlyb25tZW50OiBlbnZpcm9ubWVudCAmJiBjb252ZXJ0VG9Xb3JrZmxvd0Vudmlyb25tZW50KGVudmlyb25tZW50KSxcblxuICAgICAgLy8gRklYTUUgd2hhdCBhYm91dCB0aGUgcGVybWlzc2lvbnM/XG4gICAgICAvLyBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG5cbiAgICAgIG91dHB1dDoge30sXG4gICAgfSk7XG5cbiAgICAvKlxubm90IHJlcXVpcmVkIGJlY2F1c2UgY29kZWNhdGFseXN0IGF1dG9tYXRpY2FsbHkgdXBsb2FkcyBhcnRpZmFjdHNcbnN0ZXBzLnB1c2goe1xuICAgICAgdXNlczogJ2FjdGlvbnMvdXBsb2FkLWFydGlmYWN0QHYzJyxcbiAgICAgIHdpdGg6IHtcbiAgICAgICAgbmFtZTogJ2Nsb3VkLWFzc2VtYmx5JyxcbiAgICAgICAgcGF0aDogYCR7dGhpcy5hcHAuY2RrQ29uZmlnLmNka291dH0vYCxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgKi9cbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVBc3NldFVwbG9hZCgpOiB2b2lkIHtcblxuICAgIGNvbnN0IGNtZHM6IHN0cmluZ1tdID0gW107XG4gICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVyQXNzZXRVcGxvYWRDb21tYW5kcygpKTtcbiAgICB0aGlzLmRlcGxveW1lbnRXb3JrZmxvd0J1aWxkZXIuYWRkQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogJ1B1Ymxpc2hBc3NldHNUb0FXUycsXG4gICAgICBkZXBlbmRzT246IFsnU3ludGhDREtBcHBsaWNhdGlvbiddLFxuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgU291cmNlczogWydXb3JrZmxvd1NvdXJjZSddLFxuICAgICAgICBWYXJpYWJsZXM6IHtcbiAgICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHN0ZXBzOlxuICAgICAgICBjbWRzLFxuICAgICAgLy8gRklYTUUgaXMgdGhlcmUgaXMgYW4gZW52aXJvbm1lbnQsIGNvbm5lY3QgaXQgdG8gdGhlIHdvcmtmbG93XG4gICAgICAvLyBuZWVkcyB0byByZWFjdCBvbiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LnN5bnRoXG4gICAgICAvL2Vudmlyb25tZW50OiBlbnZpcm9ubWVudCAmJiBjb252ZXJ0VG9Xb3JrZmxvd0Vudmlyb25tZW50KGVudmlyb25tZW50KSxcblxuICAgICAgLy8gRklYTUUgd2hhdCBhYm91dCB0aGUgcGVybWlzc2lvbnM/XG4gICAgICAvLyBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG5cbiAgICAgIG91dHB1dDoge30sXG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgY3JlYXRlRGVwbG95bWVudChzdGFnZTogRGVwbG95bWVudFN0YWdlKTogdm9pZCB7XG4gICAgaWYgKHN0YWdlLm1hbnVhbEFwcHJvdmFsID09PSB0cnVlKSB7XG4gICAgICAvLyBDcmVhdGUgbmV3IGRlcGxveW1lbnQgd29ya2Zsb3cgZm9yIHN0YWdlXG4gICAgICB0aGlzLmNyZWF0ZVdvcmtmbG93Rm9yU3RhZ2Uoc3RhZ2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBBZGQgZGVwbG95bWVudCB0byBleGlzdGluZyB3b3JrZmxvd1xuICAgICAgY29uc3QgY21kczogc3RyaW5nW10gPSBbXTtcbiAgICAgIGNtZHMucHVzaCguLi50aGlzLnJlbmRlckluc3RhbGxDb21tYW5kcygpKTtcbiAgICAgIGNtZHMucHVzaCguLi50aGlzLnJlbmRlckRlcGxveUNvbW1hbmRzKHN0YWdlLm5hbWUpKTtcbiAgICAgIHRoaXMuZGVwbG95bWVudFdvcmtmbG93QnVpbGRlci5hZGRCdWlsZEFjdGlvbih7XG4gICAgICAgIGFjdGlvbk5hbWU6IGBkZXBsb3lfJHtzdGFnZS5uYW1lfWAsXG4gICAgICAgIGRlcGVuZHNPbjogdGhpcy5kZXBsb3ltZW50U3RhZ2VzLmxlbmd0aCA+IDAgPyBbJ1B1Ymxpc2hBc3NldHNUb0FXUycsIGBkZXBsb3lfJHt0aGlzLmRlcGxveW1lbnRTdGFnZXMuYXQoLTEpIX1gXSA6IFsnUHVibGlzaEFzc2V0c1RvQVdTJ10sXG4gICAgICAgIGlucHV0OiB7XG4gICAgICAgICAgU291cmNlczogWydXb3JrZmxvd1NvdXJjZSddLFxuICAgICAgICAgIFZhcmlhYmxlczoge1xuICAgICAgICAgICAgQ0k6ICd0cnVlJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBzdGVwczpcbiAgICAgICAgY21kcyxcbiAgICAgICAgLy8gRklYTUUgaXMgdGhlcmUgaXMgYW4gZW52aXJvbm1lbnQsIGNvbm5lY3QgaXQgdG8gdGhlIHdvcmtmbG93XG4gICAgICAgIC8vIG5lZWRzIHRvIHJlYWN0IG9uIHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucz8uc3ludGhcbiAgICAgICAgLy9lbnZpcm9ubWVudDogZW52aXJvbm1lbnQgJiYgY29udmVydFRvV29ya2Zsb3dFbnZpcm9ubWVudChlbnZpcm9ubWVudCksXG5cbiAgICAgICAgLy8gRklYTUUgd2hhdCBhYm91dCB0aGUgcGVybWlzc2lvbnM/XG4gICAgICAgIC8vIHBlcm1pc3Npb25zOiB7IGlkVG9rZW46IEpvYlBlcm1pc3Npb24uV1JJVEUsIGNvbnRlbnRzOiBKb2JQZXJtaXNzaW9uLlJFQUQgfSxcblxuICAgICAgICBvdXRwdXQ6IHt9LFxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuZGVwbG95bWVudFN0YWdlcy5wdXNoKHN0YWdlLm5hbWUpO1xuICAgIH1cbiAgfVxuXG4gIGNyZWF0ZVdvcmtmbG93Rm9yU3RhZ2Uoc3RhZ2U6IERlcGxveW1lbnRTdGFnZSkge1xuICAgIGNvbnNvbGUubG9nKHN0YWdlKTtcbiAgICBjb25zdCBkZXBsb3ltZW50U3RhZ2VXb3JrZmxvd0J1aWxkZXIgPSBuZXcgV29ya2Zsb3dCdWlsZGVyKHRoaXMuYnApO1xuXG4gICAgZGVwbG95bWVudFN0YWdlV29ya2Zsb3dCdWlsZGVyLnNldE5hbWUoYHJlbGVhc2UtJHtzdGFnZS5uYW1lfWApO1xuXG4gICAgLy8gQWRkIGRlcGxveW1lbnQgdG8gbmV3IHdvcmtmbG93XG4gICAgY29uc3QgY21kczogc3RyaW5nW10gPSBbXTtcbiAgICBjbWRzLnB1c2goLi4udGhpcy5yZW5kZXJJbnN0YWxsQ29tbWFuZHMoKSk7XG4gICAgY21kcy5wdXNoKC4uLnRoaXMucmVuZGVySW5zdGFsbFBhY2thZ2VDb21tYW5kcyhgJHt0aGlzLm9wdGlvbnMucGtnTmFtZXNwYWNlfS8ke3RoaXMuYXBwLm5hbWV9QFxcJHt7Z2l0aHViLmV2ZW50LmlucHV0cy52ZXJzaW9ufX1gKSk7XG4gICAgY21kcy5wdXNoKGBtdiAuL25vZGVfbW9kdWxlcy8ke3RoaXMub3B0aW9ucy5wa2dOYW1lc3BhY2V9LyR7dGhpcy5hcHAubmFtZX0gJHt0aGlzLmFwcC5jZGtDb25maWcuY2Rrb3V0fWApO1xuICAgIGNtZHMucHVzaCguLi50aGlzLnJlbmRlckRlcGxveUNvbW1hbmRzKHN0YWdlLm5hbWUpKTtcbiAgICBkZXBsb3ltZW50U3RhZ2VXb3JrZmxvd0J1aWxkZXIuYWRkQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogJ1N5bnRoQ0RLQXBwbGljYXRpb24nLFxuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgU291cmNlczogWydXb3JrZmxvd1NvdXJjZSddLFxuICAgICAgICBWYXJpYWJsZXM6IHtcbiAgICAgICAgICBDSTogJ3RydWUnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHN0ZXBzOlxuICAgICAgICBjbWRzLFxuICAgICAgLy8gRklYTUUgaXMgdGhlcmUgaXMgYW4gZW52aXJvbm1lbnQsIGNvbm5lY3QgaXQgdG8gdGhlIHdvcmtmbG93XG4gICAgICAvLyBuZWVkcyB0byByZWFjdCBvbiB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LnN5bnRoXG4gICAgICAvL2Vudmlyb25tZW50OiBlbnZpcm9ubWVudCAmJiBjb252ZXJ0VG9Xb3JrZmxvd0Vudmlyb25tZW50KGVudmlyb25tZW50KSxcblxuICAgICAgLy8gRklYTUUgd2hhdCBhYm91dCB0aGUgcGVybWlzc2lvbnM/XG4gICAgICAvLyBwZXJtaXNzaW9uczogeyBpZFRva2VuOiBKb2JQZXJtaXNzaW9uLldSSVRFLCBjb250ZW50czogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG5cbiAgICAgIG91dHB1dDoge30sXG4gICAgfSk7XG4gICAgZGVwbG95bWVudFN0YWdlV29ya2Zsb3dCdWlsZGVyLmFkZEJ1aWxkQWN0aW9uKHtcbiAgICAgIGFjdGlvbk5hbWU6IGBkZXBsb3lfJHtzdGFnZS5uYW1lfWAsXG4gICAgICAvLyBuZWVkczogdGhpcy5kZXBsb3ltZW50U3RhZ2VzLmxlbmd0aCA+IDAgPyBbJ2Fzc2V0VXBsb2FkJywgYGRlcGxveV8ke3RoaXMuZGVwbG95bWVudFN0YWdlcy5hdCgtMSkhfWBdIDogWydhc3NldFVwbG9hZCddLFxuICAgICAgZGVwZW5kc09uOiBbJ1N5bnRoQ0RLQXBwbGljYXRpb24nXSxcbiAgICAgIGlucHV0OiB7XG4gICAgICAgIFNvdXJjZXM6IFsnV29ya2Zsb3dTb3VyY2UnXSxcbiAgICAgICAgVmFyaWFibGVzOiB7XG4gICAgICAgICAgQ0k6ICd0cnVlJyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBzdGVwczpcbiAgY21kcyxcbiAgICAgIC8vIEZJWE1FIGlzIHRoZXJlIGlzIGFuIGVudmlyb25tZW50LCBjb25uZWN0IGl0IHRvIHRoZSB3b3JrZmxvd1xuICAgICAgLy8gbmVlZHMgdG8gcmVhY3Qgb24gdGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zPy5zeW50aFxuICAgICAgLy9lbnZpcm9ubWVudDogZW52aXJvbm1lbnQgJiYgY29udmVydFRvV29ya2Zsb3dFbnZpcm9ubWVudChlbnZpcm9ubWVudCksXG5cbiAgICAgIC8vIEZJWE1FIHdoYXQgYWJvdXQgdGhlIHBlcm1pc3Npb25zP1xuICAgICAgLy8gcGVybWlzc2lvbnM6IHsgaWRUb2tlbjogSm9iUGVybWlzc2lvbi5XUklURSwgY29udGVudHM6IEpvYlBlcm1pc3Npb24uUkVBRCB9LFxuXG4gICAgICBvdXRwdXQ6IHt9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgeW1sID0gbmV3IFlhbWxGaWxlKHRoaXMsIGAuY29kZWNhdGFseXN0L3dvcmtmbG93cy9yZWxlYXNlLSR7c3RhZ2UubmFtZX0ueWFtbGAsIHtcbiAgICAgIG9iajogZGVwbG95bWVudFN0YWdlV29ya2Zsb3dCdWlsZGVyLmdldERlZmluaXRpb24oKSxcblxuICAgIH0pO1xuICAgIHltbC5zeW50aGVzaXplKCk7XG4gIH1cblxufVxuIl19