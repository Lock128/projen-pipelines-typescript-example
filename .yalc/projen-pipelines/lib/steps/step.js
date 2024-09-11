"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleCommandStep = exports.PipelineStep = void 0;
const JSII_RTTI_SYMBOL_1 = Symbol.for("jsii.rtti");
/**
 * Abstract class defining the structure of a pipeline step.
 */
class PipelineStep {
    /**
     * Initializes a new instance of a PipelineStep with a reference to a projen project.
     * @param project - The projen project reference.
     */
    constructor(project) {
        this.project = project;
        // Constructor can be extended to include more setup logic.
    }
    /**
     * Generates a configuration for a GitLab CI step. Should be implemented by subclasses.
     */
    toGitlab() {
        throw new Error('Method not implemented.');
    }
    /**
     * Generates a configuration for a GitHub Actions step. Should be implemented by subclasses.
     */
    toGithub() {
        throw new Error('Method not implemented.');
    }
    /**
     * Generates a configuration for a CodeCatalyst Actions step. Should be implemented by subclasses.
     */
    toCodeCatalyst() {
        throw new Error('Method not implemented.');
    }
    /**
     * Generates a configuration for a bash script step. Should be implemented by subclasses.
     */
    toBash() {
        throw new Error('Method not implemented.');
    }
}
exports.PipelineStep = PipelineStep;
_a = JSII_RTTI_SYMBOL_1;
PipelineStep[_a] = { fqn: "projen-pipelines.PipelineStep", version: "0.0.0" };
/**
 * Concrete implementation of PipelineStep that executes simple commands.
 */
class SimpleCommandStep extends PipelineStep {
    /**
     * Constructs a simple command step with a specified set of commands.
     * @param project - The projen project reference.
     * @param commands - Shell commands to execute.
     */
    constructor(project, commands) {
        super(project);
        this.commands = commands;
    }
    /**
     * Converts the step into a GitLab CI configuration.
     */
    toGitlab() {
        return {
            extensions: [], // No job extensions specified for this step.
            commands: this.commands, // Commands to be run.
            needs: [], // No dependencies.
            env: {}, // No environment variables.
        };
    }
    /**
     * Converts the step into a Bash script configuration.
     */
    toBash() {
        return {
            commands: this.commands, // Commands to be run.
        };
    }
    /**
     * Converts the step into a GitHub Actions step configuration.
     */
    toGithub() {
        return {
            needs: [], // No dependencies.
            steps: this.commands.map(c => ({ run: c })), // Maps each command into a GitHub Action job step.
            env: {}, // No environment variables.
        };
    }
    /**
     * Converts the step into a CodeCatalyst Actions step configuration.
     */
    toCodeCatalyst() {
        return {
            needs: [], // No dependencies.
            commands: this.commands.map(c => (c)), // Maps each command into a CodeCatalyst Action job step.
            env: {}, // No environment variables.
        };
    }
}
exports.SimpleCommandStep = SimpleCommandStep;
_b = JSII_RTTI_SYMBOL_1;
SimpleCommandStep[_b] = { fqn: "projen-pipelines.SimpleCommandStep", version: "0.0.0" };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RlcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zdGVwcy9zdGVwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBbUVBOztHQUVHO0FBQ0gsTUFBc0IsWUFBWTtJQUVoQzs7O09BR0c7SUFDSCxZQUFzQixPQUFnQjtRQUFoQixZQUFPLEdBQVAsT0FBTyxDQUFTO1FBQ3BDLDJEQUEyRDtJQUM3RCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxRQUFRO1FBQ2IsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFRDs7T0FFRztJQUNJLFFBQVE7UUFDYixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUVEOztPQUVHO0lBQ0ksY0FBYztRQUNuQixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUVEOztPQUVHO0lBQ0ksTUFBTTtRQUNYLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM3QyxDQUFDOztBQXBDSCxvQ0FxQ0M7OztBQUVEOztHQUVHO0FBQ0gsTUFBYSxpQkFBa0IsU0FBUSxZQUFZO0lBRWpEOzs7O09BSUc7SUFDSCxZQUFZLE9BQWdCLEVBQVksUUFBa0I7UUFDeEQsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRHVCLGFBQVEsR0FBUixRQUFRLENBQVU7SUFFMUQsQ0FBQztJQUVEOztPQUVHO0lBQ0ksUUFBUTtRQUNiLE9BQU87WUFDTCxVQUFVLEVBQUUsRUFBRSxFQUFFLDZDQUE2QztZQUM3RCxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxzQkFBc0I7WUFDL0MsS0FBSyxFQUFFLEVBQUUsRUFBRSxtQkFBbUI7WUFDOUIsR0FBRyxFQUFFLEVBQUUsRUFBRSw0QkFBNEI7U0FDdEMsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNJLE1BQU07UUFDWCxPQUFPO1lBQ0wsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsc0JBQXNCO1NBQ2hELENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSSxRQUFRO1FBQ2IsT0FBTztZQUNMLEtBQUssRUFBRSxFQUFFLEVBQUUsbUJBQW1CO1lBQzlCLEtBQUssRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLG1EQUFtRDtZQUNoRyxHQUFHLEVBQUUsRUFBRSxFQUFFLDRCQUE0QjtTQUN0QyxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0ksY0FBYztRQUNuQixPQUFPO1lBQ0wsS0FBSyxFQUFFLEVBQUUsRUFBRSxtQkFBbUI7WUFDOUIsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLHlEQUF5RDtZQUNoRyxHQUFHLEVBQUUsRUFBRSxFQUFFLDRCQUE0QjtTQUN0QyxDQUFDO0lBQ0osQ0FBQzs7QUFwREgsOENBcURDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUHJvamVjdCB9IGZyb20gJ3Byb2plbic7XG5pbXBvcnQgeyBKb2JQZXJtaXNzaW9ucywgSm9iU3RlcCB9IGZyb20gJ3Byb2plbi9saWIvZ2l0aHViL3dvcmtmbG93cy1tb2RlbCc7XG5pbXBvcnQgeyBOZWVkIH0gZnJvbSAncHJvamVuL2xpYi9naXRsYWInO1xuXG4vKipcbiAqIENvbmZpZ3VyYXRpb24gaW50ZXJmYWNlIGZvciBhIEdpdExhYiBDSSBzdGVwLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEdpdGxhYlN0ZXBDb25maWcge1xuXG4gIC8qKiBMaXN0IG9mIGpvYiBleHRlbnNpb25zIHJlbGF0ZWQgdG8gdGhlIHN0ZXAuICovXG4gIHJlYWRvbmx5IGV4dGVuc2lvbnM6IHN0cmluZ1tdO1xuXG4gIC8qKiBEZXBlbmRlbmNpZXMgd2hpY2ggbmVlZCB0byBiZSBjb21wbGV0ZWQgYmVmb3JlIHRoaXMgc3RlcC4gKi9cbiAgcmVhZG9ubHkgbmVlZHM6IE5lZWRbXTtcblxuICAvKiogU2hlbGwgY29tbWFuZHMgdG8gZXhlY3V0ZSBpbiB0aGlzIHN0ZXAuICovXG4gIHJlYWRvbmx5IGNvbW1hbmRzOiBzdHJpbmdbXTtcblxuICAvKiogQWRkaXRpb25hbCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgdG8gc2V0IGZvciB0aGlzIHN0ZXAuICovXG4gIHJlYWRvbmx5IGVudjogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfTtcbn1cblxuLyoqXG4gKiBDb25maWd1cmF0aW9uIGludGVyZmFjZSBmb3IgYSBHaXRIdWIgQWN0aW9ucyBzdGVwLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEdpdGh1YlN0ZXBDb25maWcge1xuXG4gIC8qKiBEZXBlbmRlbmNpZXMgd2hpY2ggbmVlZCB0byBiZSBjb21wbGV0ZWQgYmVmb3JlIHRoaXMgc3RlcC4gKi9cbiAgcmVhZG9ubHkgbmVlZHM6IHN0cmluZ1tdO1xuXG4gIC8qKiBDb21tYW5kcyB3cmFwcGVkIGFzIEdpdEh1YiBBY3Rpb24gam9iIHN0ZXBzLiAqL1xuICByZWFkb25seSBzdGVwczogSm9iU3RlcFtdO1xuXG4gIC8qKiBBZGRpdGlvbmFsIGVudmlyb25tZW50IHZhcmlhYmxlcyB0byBzZXQgZm9yIHRoaXMgc3RlcC4gKi9cbiAgcmVhZG9ubHkgZW52OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9O1xuXG4gIC8qKiBBZGRpdGlvbmFsIGpvYiBwZXJtaXNzaW9ucyBuZWVkZWQgKi9cbiAgcmVhZG9ubHkgcGVybWlzc2lvbnM/OiBKb2JQZXJtaXNzaW9ucztcbn1cblxuLyoqXG4gKiBDb25maWd1cmF0aW9uIGludGVyZmFjZSBmb3IgYSBDb2RlQ2F0YWx5c3QgQWN0aW9ucyBzdGVwLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvZGVDYXRhbHlzdFN0ZXBDb25maWcge1xuXG4gIC8qKiBEZXBlbmRlbmNpZXMgd2hpY2ggbmVlZCB0byBiZSBjb21wbGV0ZWQgYmVmb3JlIHRoaXMgc3RlcC4gKi9cbiAgcmVhZG9ubHkgbmVlZHM6IHN0cmluZ1tdO1xuXG4gIC8qKiBDb21tYW5kcyB3cmFwcGVkIGFzIEdpdEh1YiBBY3Rpb24gam9iIHN0ZXBzLiAqL1xuICByZWFkb25seSBjb21tYW5kczogc3RyaW5nW107XG5cbiAgLyoqIEFkZGl0aW9uYWwgZW52aXJvbm1lbnQgdmFyaWFibGVzIHRvIHNldCBmb3IgdGhpcyBzdGVwLiAqL1xuICByZWFkb25seSBlbnY6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH07XG5cbiAgLyoqIEFkZGl0aW9uYWwgam9iIHBlcm1pc3Npb25zIG5lZWRlZCAqL1xuICByZWFkb25seSBwZXJtaXNzaW9ucz86IEpvYlBlcm1pc3Npb25zO1xufVxuXG4vKipcbiAqIENvbmZpZ3VyYXRpb24gaW50ZXJmYWNlIGZvciBhIGJhc2ggc2NyaXB0IHN0ZXAuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQmFzaFN0ZXBDb25maWcge1xuXG4gIC8qKiBTaGVsbCBjb21tYW5kcyB0byBleGVjdXRlLiAqL1xuICByZWFkb25seSBjb21tYW5kczogc3RyaW5nW107XG59XG5cbi8qKlxuICogQWJzdHJhY3QgY2xhc3MgZGVmaW5pbmcgdGhlIHN0cnVjdHVyZSBvZiBhIHBpcGVsaW5lIHN0ZXAuXG4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBQaXBlbGluZVN0ZXAge1xuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplcyBhIG5ldyBpbnN0YW5jZSBvZiBhIFBpcGVsaW5lU3RlcCB3aXRoIGEgcmVmZXJlbmNlIHRvIGEgcHJvamVuIHByb2plY3QuXG4gICAqIEBwYXJhbSBwcm9qZWN0IC0gVGhlIHByb2plbiBwcm9qZWN0IHJlZmVyZW5jZS5cbiAgICovXG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCBwcm9qZWN0OiBQcm9qZWN0KSB7XG4gICAgLy8gQ29uc3RydWN0b3IgY2FuIGJlIGV4dGVuZGVkIHRvIGluY2x1ZGUgbW9yZSBzZXR1cCBsb2dpYy5cbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZXMgYSBjb25maWd1cmF0aW9uIGZvciBhIEdpdExhYiBDSSBzdGVwLiBTaG91bGQgYmUgaW1wbGVtZW50ZWQgYnkgc3ViY2xhc3Nlcy5cbiAgICovXG4gIHB1YmxpYyB0b0dpdGxhYigpOiBHaXRsYWJTdGVwQ29uZmlnIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGVzIGEgY29uZmlndXJhdGlvbiBmb3IgYSBHaXRIdWIgQWN0aW9ucyBzdGVwLiBTaG91bGQgYmUgaW1wbGVtZW50ZWQgYnkgc3ViY2xhc3Nlcy5cbiAgICovXG4gIHB1YmxpYyB0b0dpdGh1YigpOiBHaXRodWJTdGVwQ29uZmlnIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGVzIGEgY29uZmlndXJhdGlvbiBmb3IgYSBDb2RlQ2F0YWx5c3QgQWN0aW9ucyBzdGVwLiBTaG91bGQgYmUgaW1wbGVtZW50ZWQgYnkgc3ViY2xhc3Nlcy5cbiAgICovXG4gIHB1YmxpYyB0b0NvZGVDYXRhbHlzdCgpOiBDb2RlQ2F0YWx5c3RTdGVwQ29uZmlnIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGVzIGEgY29uZmlndXJhdGlvbiBmb3IgYSBiYXNoIHNjcmlwdCBzdGVwLiBTaG91bGQgYmUgaW1wbGVtZW50ZWQgYnkgc3ViY2xhc3Nlcy5cbiAgICovXG4gIHB1YmxpYyB0b0Jhc2goKTogQmFzaFN0ZXBDb25maWcge1xuICAgIHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxufVxuXG4vKipcbiAqIENvbmNyZXRlIGltcGxlbWVudGF0aW9uIG9mIFBpcGVsaW5lU3RlcCB0aGF0IGV4ZWN1dGVzIHNpbXBsZSBjb21tYW5kcy5cbiAqL1xuZXhwb3J0IGNsYXNzIFNpbXBsZUNvbW1hbmRTdGVwIGV4dGVuZHMgUGlwZWxpbmVTdGVwIHtcblxuICAvKipcbiAgICogQ29uc3RydWN0cyBhIHNpbXBsZSBjb21tYW5kIHN0ZXAgd2l0aCBhIHNwZWNpZmllZCBzZXQgb2YgY29tbWFuZHMuXG4gICAqIEBwYXJhbSBwcm9qZWN0IC0gVGhlIHByb2plbiBwcm9qZWN0IHJlZmVyZW5jZS5cbiAgICogQHBhcmFtIGNvbW1hbmRzIC0gU2hlbGwgY29tbWFuZHMgdG8gZXhlY3V0ZS5cbiAgICovXG4gIGNvbnN0cnVjdG9yKHByb2plY3Q6IFByb2plY3QsIHByb3RlY3RlZCBjb21tYW5kczogc3RyaW5nW10pIHtcbiAgICBzdXBlcihwcm9qZWN0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyB0aGUgc3RlcCBpbnRvIGEgR2l0TGFiIENJIGNvbmZpZ3VyYXRpb24uXG4gICAqL1xuICBwdWJsaWMgdG9HaXRsYWIoKTogR2l0bGFiU3RlcENvbmZpZyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGV4dGVuc2lvbnM6IFtdLCAvLyBObyBqb2IgZXh0ZW5zaW9ucyBzcGVjaWZpZWQgZm9yIHRoaXMgc3RlcC5cbiAgICAgIGNvbW1hbmRzOiB0aGlzLmNvbW1hbmRzLCAvLyBDb21tYW5kcyB0byBiZSBydW4uXG4gICAgICBuZWVkczogW10sIC8vIE5vIGRlcGVuZGVuY2llcy5cbiAgICAgIGVudjoge30sIC8vIE5vIGVudmlyb25tZW50IHZhcmlhYmxlcy5cbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnRzIHRoZSBzdGVwIGludG8gYSBCYXNoIHNjcmlwdCBjb25maWd1cmF0aW9uLlxuICAgKi9cbiAgcHVibGljIHRvQmFzaCgpOiBCYXNoU3RlcENvbmZpZyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbW1hbmRzOiB0aGlzLmNvbW1hbmRzLCAvLyBDb21tYW5kcyB0byBiZSBydW4uXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyB0aGUgc3RlcCBpbnRvIGEgR2l0SHViIEFjdGlvbnMgc3RlcCBjb25maWd1cmF0aW9uLlxuICAgKi9cbiAgcHVibGljIHRvR2l0aHViKCk6IEdpdGh1YlN0ZXBDb25maWcge1xuICAgIHJldHVybiB7XG4gICAgICBuZWVkczogW10sIC8vIE5vIGRlcGVuZGVuY2llcy5cbiAgICAgIHN0ZXBzOiB0aGlzLmNvbW1hbmRzLm1hcChjID0+ICh7IHJ1bjogYyB9KSksIC8vIE1hcHMgZWFjaCBjb21tYW5kIGludG8gYSBHaXRIdWIgQWN0aW9uIGpvYiBzdGVwLlxuICAgICAgZW52OiB7fSwgLy8gTm8gZW52aXJvbm1lbnQgdmFyaWFibGVzLlxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydHMgdGhlIHN0ZXAgaW50byBhIENvZGVDYXRhbHlzdCBBY3Rpb25zIHN0ZXAgY29uZmlndXJhdGlvbi5cbiAgICovXG4gIHB1YmxpYyB0b0NvZGVDYXRhbHlzdCgpOiBDb2RlQ2F0YWx5c3RTdGVwQ29uZmlnIHtcbiAgICByZXR1cm4ge1xuICAgICAgbmVlZHM6IFtdLCAvLyBObyBkZXBlbmRlbmNpZXMuXG4gICAgICBjb21tYW5kczogdGhpcy5jb21tYW5kcy5tYXAoYyA9PiAoYykpLCAvLyBNYXBzIGVhY2ggY29tbWFuZCBpbnRvIGEgQ29kZUNhdGFseXN0IEFjdGlvbiBqb2Igc3RlcC5cbiAgICAgIGVudjoge30sIC8vIE5vIGVudmlyb25tZW50IHZhcmlhYmxlcy5cbiAgICB9O1xuICB9XG59XG4iXX0=