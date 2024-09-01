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
}
exports.SimpleCommandStep = SimpleCommandStep;
_b = JSII_RTTI_SYMBOL_1;
SimpleCommandStep[_b] = { fqn: "projen-pipelines.SimpleCommandStep", version: "0.0.0" };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RlcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zdGVwcy9zdGVwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBaURBOztHQUVHO0FBQ0gsTUFBc0IsWUFBWTtJQUVoQzs7O09BR0c7SUFDSCxZQUFzQixPQUFnQjtRQUFoQixZQUFPLEdBQVAsT0FBTyxDQUFTO1FBQ3BDLDJEQUEyRDtJQUM3RCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxRQUFRO1FBQ2IsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFRDs7T0FFRztJQUNJLFFBQVE7UUFDYixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUVEOztPQUVHO0lBQ0ksTUFBTTtRQUNYLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM3QyxDQUFDOztBQTdCSCxvQ0E4QkM7OztBQUVEOztHQUVHO0FBQ0gsTUFBYSxpQkFBa0IsU0FBUSxZQUFZO0lBRWpEOzs7O09BSUc7SUFDSCxZQUFZLE9BQWdCLEVBQVksUUFBa0I7UUFDeEQsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRHVCLGFBQVEsR0FBUixRQUFRLENBQVU7SUFFMUQsQ0FBQztJQUVEOztPQUVHO0lBQ0ksUUFBUTtRQUNiLE9BQU87WUFDTCxVQUFVLEVBQUUsRUFBRSxFQUFFLDZDQUE2QztZQUM3RCxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxzQkFBc0I7WUFDL0MsS0FBSyxFQUFFLEVBQUUsRUFBRSxtQkFBbUI7WUFDOUIsR0FBRyxFQUFFLEVBQUUsRUFBRSw0QkFBNEI7U0FDdEMsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNJLE1BQU07UUFDWCxPQUFPO1lBQ0wsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsc0JBQXNCO1NBQ2hELENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSSxRQUFRO1FBQ2IsT0FBTztZQUNMLEtBQUssRUFBRSxFQUFFLEVBQUUsbUJBQW1CO1lBQzlCLEtBQUssRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLG1EQUFtRDtZQUNoRyxHQUFHLEVBQUUsRUFBRSxFQUFFLDRCQUE0QjtTQUN0QyxDQUFDO0lBQ0osQ0FBQzs7QUF6Q0gsOENBMENDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUHJvamVjdCB9IGZyb20gJ3Byb2plbic7XG5pbXBvcnQgeyBKb2JQZXJtaXNzaW9ucywgSm9iU3RlcCB9IGZyb20gJ3Byb2plbi9saWIvZ2l0aHViL3dvcmtmbG93cy1tb2RlbCc7XG5pbXBvcnQgeyBOZWVkIH0gZnJvbSAncHJvamVuL2xpYi9naXRsYWInO1xuXG4vKipcbiAqIENvbmZpZ3VyYXRpb24gaW50ZXJmYWNlIGZvciBhIEdpdExhYiBDSSBzdGVwLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEdpdGxhYlN0ZXBDb25maWcge1xuXG4gIC8qKiBMaXN0IG9mIGpvYiBleHRlbnNpb25zIHJlbGF0ZWQgdG8gdGhlIHN0ZXAuICovXG4gIHJlYWRvbmx5IGV4dGVuc2lvbnM6IHN0cmluZ1tdO1xuXG4gIC8qKiBEZXBlbmRlbmNpZXMgd2hpY2ggbmVlZCB0byBiZSBjb21wbGV0ZWQgYmVmb3JlIHRoaXMgc3RlcC4gKi9cbiAgcmVhZG9ubHkgbmVlZHM6IE5lZWRbXTtcblxuICAvKiogU2hlbGwgY29tbWFuZHMgdG8gZXhlY3V0ZSBpbiB0aGlzIHN0ZXAuICovXG4gIHJlYWRvbmx5IGNvbW1hbmRzOiBzdHJpbmdbXTtcblxuICAvKiogQWRkaXRpb25hbCBlbnZpcm9ubWVudCB2YXJpYWJsZXMgdG8gc2V0IGZvciB0aGlzIHN0ZXAuICovXG4gIHJlYWRvbmx5IGVudjogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfTtcbn1cblxuLyoqXG4gKiBDb25maWd1cmF0aW9uIGludGVyZmFjZSBmb3IgYSBHaXRIdWIgQWN0aW9ucyBzdGVwLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEdpdGh1YlN0ZXBDb25maWcge1xuXG4gIC8qKiBEZXBlbmRlbmNpZXMgd2hpY2ggbmVlZCB0byBiZSBjb21wbGV0ZWQgYmVmb3JlIHRoaXMgc3RlcC4gKi9cbiAgcmVhZG9ubHkgbmVlZHM6IHN0cmluZ1tdO1xuXG4gIC8qKiBDb21tYW5kcyB3cmFwcGVkIGFzIEdpdEh1YiBBY3Rpb24gam9iIHN0ZXBzLiAqL1xuICByZWFkb25seSBzdGVwczogSm9iU3RlcFtdO1xuXG4gIC8qKiBBZGRpdGlvbmFsIGVudmlyb25tZW50IHZhcmlhYmxlcyB0byBzZXQgZm9yIHRoaXMgc3RlcC4gKi9cbiAgcmVhZG9ubHkgZW52OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9O1xuXG4gIC8qKiBBZGRpdGlvbmFsIGpvYiBwZXJtaXNzaW9ucyBuZWVkZWQgKi9cbiAgcmVhZG9ubHkgcGVybWlzc2lvbnM/OiBKb2JQZXJtaXNzaW9ucztcbn1cblxuLyoqXG4gKiBDb25maWd1cmF0aW9uIGludGVyZmFjZSBmb3IgYSBiYXNoIHNjcmlwdCBzdGVwLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEJhc2hTdGVwQ29uZmlnIHtcblxuICAvKiogU2hlbGwgY29tbWFuZHMgdG8gZXhlY3V0ZS4gKi9cbiAgcmVhZG9ubHkgY29tbWFuZHM6IHN0cmluZ1tdO1xufVxuXG4vKipcbiAqIEFic3RyYWN0IGNsYXNzIGRlZmluaW5nIHRoZSBzdHJ1Y3R1cmUgb2YgYSBwaXBlbGluZSBzdGVwLlxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgUGlwZWxpbmVTdGVwIHtcblxuICAvKipcbiAgICogSW5pdGlhbGl6ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgYSBQaXBlbGluZVN0ZXAgd2l0aCBhIHJlZmVyZW5jZSB0byBhIHByb2plbiBwcm9qZWN0LlxuICAgKiBAcGFyYW0gcHJvamVjdCAtIFRoZSBwcm9qZW4gcHJvamVjdCByZWZlcmVuY2UuXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgcHJvamVjdDogUHJvamVjdCkge1xuICAgIC8vIENvbnN0cnVjdG9yIGNhbiBiZSBleHRlbmRlZCB0byBpbmNsdWRlIG1vcmUgc2V0dXAgbG9naWMuXG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGVzIGEgY29uZmlndXJhdGlvbiBmb3IgYSBHaXRMYWIgQ0kgc3RlcC4gU2hvdWxkIGJlIGltcGxlbWVudGVkIGJ5IHN1YmNsYXNzZXMuXG4gICAqL1xuICBwdWJsaWMgdG9HaXRsYWIoKTogR2l0bGFiU3RlcENvbmZpZyB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlcyBhIGNvbmZpZ3VyYXRpb24gZm9yIGEgR2l0SHViIEFjdGlvbnMgc3RlcC4gU2hvdWxkIGJlIGltcGxlbWVudGVkIGJ5IHN1YmNsYXNzZXMuXG4gICAqL1xuICBwdWJsaWMgdG9HaXRodWIoKTogR2l0aHViU3RlcENvbmZpZyB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlcyBhIGNvbmZpZ3VyYXRpb24gZm9yIGEgYmFzaCBzY3JpcHQgc3RlcC4gU2hvdWxkIGJlIGltcGxlbWVudGVkIGJ5IHN1YmNsYXNzZXMuXG4gICAqL1xuICBwdWJsaWMgdG9CYXNoKCk6IEJhc2hTdGVwQ29uZmlnIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cbn1cblxuLyoqXG4gKiBDb25jcmV0ZSBpbXBsZW1lbnRhdGlvbiBvZiBQaXBlbGluZVN0ZXAgdGhhdCBleGVjdXRlcyBzaW1wbGUgY29tbWFuZHMuXG4gKi9cbmV4cG9ydCBjbGFzcyBTaW1wbGVDb21tYW5kU3RlcCBleHRlbmRzIFBpcGVsaW5lU3RlcCB7XG5cbiAgLyoqXG4gICAqIENvbnN0cnVjdHMgYSBzaW1wbGUgY29tbWFuZCBzdGVwIHdpdGggYSBzcGVjaWZpZWQgc2V0IG9mIGNvbW1hbmRzLlxuICAgKiBAcGFyYW0gcHJvamVjdCAtIFRoZSBwcm9qZW4gcHJvamVjdCByZWZlcmVuY2UuXG4gICAqIEBwYXJhbSBjb21tYW5kcyAtIFNoZWxsIGNvbW1hbmRzIHRvIGV4ZWN1dGUuXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihwcm9qZWN0OiBQcm9qZWN0LCBwcm90ZWN0ZWQgY29tbWFuZHM6IHN0cmluZ1tdKSB7XG4gICAgc3VwZXIocHJvamVjdCk7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydHMgdGhlIHN0ZXAgaW50byBhIEdpdExhYiBDSSBjb25maWd1cmF0aW9uLlxuICAgKi9cbiAgcHVibGljIHRvR2l0bGFiKCk6IEdpdGxhYlN0ZXBDb25maWcge1xuICAgIHJldHVybiB7XG4gICAgICBleHRlbnNpb25zOiBbXSwgLy8gTm8gam9iIGV4dGVuc2lvbnMgc3BlY2lmaWVkIGZvciB0aGlzIHN0ZXAuXG4gICAgICBjb21tYW5kczogdGhpcy5jb21tYW5kcywgLy8gQ29tbWFuZHMgdG8gYmUgcnVuLlxuICAgICAgbmVlZHM6IFtdLCAvLyBObyBkZXBlbmRlbmNpZXMuXG4gICAgICBlbnY6IHt9LCAvLyBObyBlbnZpcm9ubWVudCB2YXJpYWJsZXMuXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyB0aGUgc3RlcCBpbnRvIGEgQmFzaCBzY3JpcHQgY29uZmlndXJhdGlvbi5cbiAgICovXG4gIHB1YmxpYyB0b0Jhc2goKTogQmFzaFN0ZXBDb25maWcge1xuICAgIHJldHVybiB7XG4gICAgICBjb21tYW5kczogdGhpcy5jb21tYW5kcywgLy8gQ29tbWFuZHMgdG8gYmUgcnVuLlxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydHMgdGhlIHN0ZXAgaW50byBhIEdpdEh1YiBBY3Rpb25zIHN0ZXAgY29uZmlndXJhdGlvbi5cbiAgICovXG4gIHB1YmxpYyB0b0dpdGh1YigpOiBHaXRodWJTdGVwQ29uZmlnIHtcbiAgICByZXR1cm4ge1xuICAgICAgbmVlZHM6IFtdLCAvLyBObyBkZXBlbmRlbmNpZXMuXG4gICAgICBzdGVwczogdGhpcy5jb21tYW5kcy5tYXAoYyA9PiAoeyBydW46IGMgfSkpLCAvLyBNYXBzIGVhY2ggY29tbWFuZCBpbnRvIGEgR2l0SHViIEFjdGlvbiBqb2Igc3RlcC5cbiAgICAgIGVudjoge30sIC8vIE5vIGVudmlyb25tZW50IHZhcmlhYmxlcy5cbiAgICB9O1xuICB9XG59XG4iXX0=