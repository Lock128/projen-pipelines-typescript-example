"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubPackagesLoginStep = void 0;
const JSII_RTTI_SYMBOL_1 = Symbol.for("jsii.rtti");
const workflows_model_1 = require("projen/lib/github/workflows-model");
const step_1 = require("./step");
class GithubPackagesLoginStep extends step_1.PipelineStep {
    constructor(project, options) {
        super(project);
        this.options = options;
    }
    toGithub() {
        return {
            env: {},
            needs: [],
            steps: [{
                    run: 'echo "GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }}" >> $GITHUB_ENV',
                }],
            permissions: { packages: this.options.write ? workflows_model_1.JobPermission.WRITE : workflows_model_1.JobPermission.READ },
        };
    }
}
exports.GithubPackagesLoginStep = GithubPackagesLoginStep;
_a = JSII_RTTI_SYMBOL_1;
GithubPackagesLoginStep[_a] = { fqn: "projen-pipelines.GithubPackagesLoginStep", version: "0.0.0" };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaXN0cmllcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zdGVwcy9yZWdpc3RyaWVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQ0EsdUVBQWtFO0FBQ2xFLGlDQUF3RDtBQVd4RCxNQUFhLHVCQUF3QixTQUFRLG1CQUFZO0lBRXZELFlBQVksT0FBZ0IsRUFBVSxPQUF1QztRQUMzRSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFEcUIsWUFBTyxHQUFQLE9BQU8sQ0FBZ0M7SUFFN0UsQ0FBQztJQUVNLFFBQVE7UUFDYixPQUFPO1lBQ0wsR0FBRyxFQUFFLEVBQUU7WUFDUCxLQUFLLEVBQUUsRUFBRTtZQUNULEtBQUssRUFBRSxDQUFDO29CQUNOLEdBQUcsRUFBRSxnRUFBZ0U7aUJBQ3RFLENBQUM7WUFDRixXQUFXLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLCtCQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQywrQkFBYSxDQUFDLElBQUksRUFBRTtTQUN6RixDQUFDO0lBQ0osQ0FBQzs7QUFmSCwwREFnQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBQcm9qZWN0IH0gZnJvbSAncHJvamVuJztcbmltcG9ydCB7IEpvYlBlcm1pc3Npb24gfSBmcm9tICdwcm9qZW4vbGliL2dpdGh1Yi93b3JrZmxvd3MtbW9kZWwnO1xuaW1wb3J0IHsgR2l0aHViU3RlcENvbmZpZywgUGlwZWxpbmVTdGVwIH0gZnJvbSAnLi9zdGVwJztcblxuZXhwb3J0IGludGVyZmFjZSBHaXRodWJQYWNrYWdlc0xvZ2luU3RlcE9wdGlvbnMge1xuICAvKipcbiAgICogV2hldGhlciBvciBub3QgdG8gZ3JhbnQgdGhlIHN0ZXAgd3JpdGUgcGVybWlzc2lvbnMgdG8gdGhlIHJlZ2lzdHJ5LlxuICAgKlxuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgcmVhZG9ubHkgd3JpdGU/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgR2l0aHViUGFja2FnZXNMb2dpblN0ZXAgZXh0ZW5kcyBQaXBlbGluZVN0ZXAge1xuXG4gIGNvbnN0cnVjdG9yKHByb2plY3Q6IFByb2plY3QsIHByaXZhdGUgb3B0aW9uczogR2l0aHViUGFja2FnZXNMb2dpblN0ZXBPcHRpb25zKSB7XG4gICAgc3VwZXIocHJvamVjdCk7XG4gIH1cblxuICBwdWJsaWMgdG9HaXRodWIoKTogR2l0aHViU3RlcENvbmZpZyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGVudjoge30sXG4gICAgICBuZWVkczogW10sXG4gICAgICBzdGVwczogW3tcbiAgICAgICAgcnVuOiAnZWNobyBcIkdJVEhVQl9UT0tFTj0ke3sgc2VjcmV0cy5HSVRIVUJfVE9LRU4gfX1cIiA+PiAkR0lUSFVCX0VOVicsXG4gICAgICB9XSxcbiAgICAgIHBlcm1pc3Npb25zOiB7IHBhY2thZ2VzOiB0aGlzLm9wdGlvbnMud3JpdGUgPyBKb2JQZXJtaXNzaW9uLldSSVRFIDogSm9iUGVybWlzc2lvbi5SRUFEIH0sXG4gICAgfTtcbiAgfVxufSJdfQ==