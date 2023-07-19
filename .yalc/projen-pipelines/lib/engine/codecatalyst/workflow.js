"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeCatalystWorkflow = void 0;
const case_1 = require("case");
const _resolve_1 = require("projen/lib/_resolve");
const component_1 = require("projen/lib/component");
const util_1 = require("projen/lib/util");
const yaml_1 = require("projen/lib/yaml");
/**
 * Workflow for CodeCatalyst.
 *
 * A workflow is a configurable automated process made up of one or more jobs.
 *
 * @see https://docs.aws.amazon.com/codecatalyst/latest/userguide/workflow-reference.html
 */
class CodeCatalystWorkflow extends component_1.Component {
    constructor(codecatalyst, name, options = {}) {
        super(codecatalyst.project);
        this.events = {};
        this.jobs = {};
        this.name = name;
        this.concurrency = options.concurrency;
        this.projenCredentials = codecatalyst.projenCredentials;
        this.actions = codecatalyst.actions;
        const workflowsEnabled = codecatalyst.workflowsEnabled || options.force;
        if (workflowsEnabled) {
            this.file = new yaml_1.YamlFile(this.project, `.codecatalyst/workflows/${name.toLocaleLowerCase()}.yml`, {
                obj: () => this.renderWorkflow(),
                // GitHub needs to read the file from the repository in order to work.
                committed: true,
            });
        }
    }
    /**
      * Add events to triggers the workflow.
      *
      * @param events The event(s) to trigger the workflow.
      */
    on(events) {
        this.events = {
            ...this.events,
            ...events,
        };
    }
    /**
      * Adds a single job to the workflow.
      * @param id The job name (unique within the workflow)
      * @param job The job specification
      */
    addJob(id, job) {
        this.addJobs({ [id]: job });
    }
    /**
      * Add jobs to the workflow.
      *
      * @param jobs Jobs to add.
      */
    addJobs(jobs) {
        verifyJobConstraints(jobs);
        this.jobs = {
            ...this.jobs,
            ...jobs,
        };
    }
    /**
      * Get a single job from the workflow.
      * @param id The job name (unique within the workflow)
      */
    getJob(id) {
        return this.jobs[id];
    }
    /**
      * Updates a single job to the workflow.
      * @param id The job name (unique within the workflow)
      */
    updateJob(id, job) {
        this.updateJobs({ [id]: job });
    }
    /**
      * Updates jobs for this worklow
      * Does a complete replace, it does not try to merge the jobs
      *
      * @param jobs Jobs to update.
      */
    updateJobs(jobs) {
        verifyJobConstraints(jobs);
        const newJobIds = Object.keys(jobs);
        const updatedJobs = Object.entries(this.jobs).map(([jobId, job]) => {
            if (newJobIds.includes(jobId)) {
                return [jobId, jobs[jobId]];
            }
            return [jobId, job];
        });
        this.jobs = {
            ...Object.fromEntries(updatedJobs),
        };
    }
    /**
      * Removes a single job to the workflow.
      * @param id The job name (unique within the workflow)
      */
    removeJob(id) {
        const updatedJobs = Object.entries(this.jobs).filter(([jobId]) => jobId !== id);
        this.jobs = {
            ...Object.fromEntries(updatedJobs),
        };
    }
    renderWorkflow() {
        return {
            'name': this.name,
            'run-name': this.runName,
            'on': snakeCaseKeys(this.events),
            'concurrency': this.concurrency,
            'jobs': renderJobs(this.jobs, this.actions),
        };
    }
}
exports.CodeCatalystWorkflow = CodeCatalystWorkflow;
function snakeCaseKeys(obj) {
    if (typeof obj !== 'object' || obj == null) {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(snakeCaseKeys);
    }
    const result = {};
    for (let [k, v] of Object.entries(obj)) {
        if (typeof v === 'object' && v != null) {
            v = snakeCaseKeys(v);
        }
        result[(0, case_1.snake)(k)] = v;
    }
    return result;
}
function renderJobs(jobs, actions) {
    const result = {};
    for (const [name, job] of Object.entries(jobs)) {
        result[name] = renderJob(job);
    }
    return result;
    /** @see https://docs.aws.amazon.com/codecatalyst/latest/userguide/workflow-reference.html */
    function renderJob(job) {
        const steps = new Array();
        // https://docs.github.com/en/actions/using-workflows/reusing-workflows#supported-keywords-for-jobs-that-call-a-reusable-workflow
        // https://docs.aws.amazon.com/codecatalyst/latest/userguide/workflow-reference.html
        if ('uses' in job) {
            return {
                name: job.name,
                needs: arrayOrScalar(job.needs),
                if: job.if,
                permissions: (0, util_1.kebabCaseKeys)(job.permissions),
                concurrency: job.concurrency,
                uses: job.uses,
                with: job.with,
                secrets: job.secrets,
                strategy: renderJobStrategy(job.strategy),
            };
        }
        if (job.tools) {
            steps.push(...setupTools(job.tools));
        }
        const userDefinedSteps = (0, util_1.kebabCaseKeys)((0, _resolve_1.resolve)(job.steps), false);
        steps.push(...userDefinedSteps);
        return {
            'name': job.name,
            'needs': arrayOrScalar(job.needs),
            'runs-on': arrayOrScalar(job.runsOn),
            'permissions': (0, util_1.kebabCaseKeys)(job.permissions),
            'environment': job.environment,
            'concurrency': job.concurrency,
            'outputs': renderJobOutputs(job.outputs),
            'env': job.env,
            'defaults': (0, util_1.kebabCaseKeys)(job.defaults),
            'if': job.if,
            'steps': steps.map(renderStep),
            'timeout-minutes': job.timeoutMinutes,
            'strategy': renderJobStrategy(job.strategy),
            'continue-on-error': job.continueOnError,
            'container': job.container,
            'services': job.services,
        };
    }
    function renderJobOutputs(output) {
        if (output == null) {
            return undefined;
        }
        const rendered = {};
        for (const [name, { stepId, outputName }] of Object.entries(output)) {
            rendered[name] = `\${{ steps.${stepId}.outputs.${outputName} }}`;
        }
        return rendered;
    }
    function renderJobStrategy(strategy) {
        var _a;
        if (strategy == null) {
            return undefined;
        }
        const rendered = {
            'max-parallel': strategy.maxParallel,
            'fail-fast': strategy.failFast,
        };
        if (strategy.matrix) {
            const matrix = {
                include: strategy.matrix.include,
                exclude: strategy.matrix.exclude,
            };
            for (const [key, values] of Object.entries((_a = strategy.matrix.domain) !== null && _a !== void 0 ? _a : {})) {
                if (key in matrix) {
                    // A domain key was set to `include`, or `exclude`:
                    throw new Error(`Illegal job strategy matrix key: ${key}`);
                }
                matrix[key] = values;
            }
            rendered.matrix = matrix;
        }
        return rendered;
    }
    function renderStep(step) {
        return {
            'name': step.name,
            'id': step.id,
            'if': step.if,
            'uses': step.uses && actions.get(step.uses),
            'env': step.env,
            'run': step.run,
            'with': step.with,
            'continue-on-error': step.continueOnError,
            'timeout-minutes': step.timeoutMinutes,
            'working-directory': step.workingDirectory,
        };
    }
}
function arrayOrScalar(arr) {
    if (arr == null || arr.length === 0) {
        return arr;
    }
    if (arr.length === 1) {
        return arr[0];
    }
    return arr;
}
function setupTools(tools) {
    const steps = [];
    if (tools.java) {
        steps.push({
            uses: 'actions/setup-java@v3',
            with: { 'distribution': 'temurin', 'java-version': tools.java.version },
        });
    }
    if (tools.node) {
        steps.push({
            uses: 'actions/setup-node@v3',
            with: { 'node-version': tools.node.version },
        });
    }
    if (tools.python) {
        steps.push({
            uses: 'actions/setup-python@v4',
            with: { 'python-version': tools.python.version },
        });
    }
    if (tools.go) {
        steps.push({
            uses: 'actions/setup-go@v3',
            with: { 'go-version': tools.go.version },
        });
    }
    if (tools.dotnet) {
        steps.push({
            uses: 'actions/setup-dotnet@v3',
            with: { 'dotnet-version': tools.dotnet.version },
        });
    }
    return steps;
}
function verifyJobConstraints(jobs) {
    // verify that job has a "permissions" statement to ensure workflow can
    // operate in repos with default tokens set to readonly
    for (const [id, job] of Object.entries(jobs)) {
        if (!job.permissions) {
            throw new Error(`${id}: all workflow jobs must have a "permissions" clause to ensure workflow can operate in restricted repositories`);
        }
    }
    // verify that job has a "runsOn" statement to ensure a worker can be selected appropriately
    for (const [id, job] of Object.entries(jobs)) {
        if (!('uses' in job)) {
            if ('runsOn' in job && job.runsOn.length === 0) {
                throw new Error(`${id}: at least one runner selector labels must be provided in "runsOn" to ensure a runner instance can be selected`);
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2Zsb3cuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvZW5naW5lL2NvZGVjYXRhbHlzdC93b3JrZmxvdy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSwrQkFBNkI7QUFDN0Isa0RBQThDO0FBQzlDLG9EQUFpRDtBQUlqRCwwQ0FBZ0Q7QUFDaEQsMENBQTJDO0FBc0IzQzs7Ozs7O0dBTUc7QUFDSCxNQUFhLG9CQUFxQixTQUFRLHFCQUFTO0lBNENqRCxZQUNFLFlBQTBCLEVBQzFCLElBQVksRUFDWixVQUF1QyxFQUFFO1FBRXpDLEtBQUssQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7UUFYdEIsV0FBTSxHQUF1QixFQUFFLENBQUM7UUFDaEMsU0FBSSxHQUdSLEVBQUUsQ0FBQztRQVNMLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQztRQUN2QyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsWUFBWSxDQUFDLGlCQUFpQixDQUFDO1FBQ3hELElBQUksQ0FBQyxPQUFPLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQztRQUVwQyxNQUFNLGdCQUFnQixHQUFHLFlBQVksQ0FBQyxnQkFBZ0IsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDO1FBQ3hFLElBQUksZ0JBQWdCLEVBQUU7WUFDcEIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLGVBQVEsQ0FDdEIsSUFBSSxDQUFDLE9BQU8sRUFDWiwyQkFBMkIsSUFBSSxDQUFDLGlCQUFpQixFQUFFLE1BQU0sRUFDekQ7Z0JBQ0UsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUU7Z0JBQ2hDLHNFQUFzRTtnQkFDdEUsU0FBUyxFQUFFLElBQUk7YUFDaEIsQ0FDRixDQUFDO1NBQ0g7SUFDSCxDQUFDO0lBRUQ7Ozs7UUFJSTtJQUNHLEVBQUUsQ0FBQyxNQUEw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QVMsb0JBQW9CLENBQzNCLElBQTBFO0lBRTFFLHVFQUF1RTtJQUN2RSx1REFBdUQ7SUFDdkQsS0FBSyxNQUFNLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDNUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUU7WUFDcEIsTUFBTSxJQUFJLEtBQUssQ0FDYixHQUFHLEVBQUUsZ0hBQWdILENBQ3RILENBQUM7U0FDSDtLQUNGO0lBRUQsNEZBQTRGO0lBQzVGLEtBQUssTUFBTSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQzVDLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxHQUFHLENBQUMsRUFBRTtZQUNwQixJQUFJLFFBQVEsSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO2dCQUM5QyxNQUFNLElBQUksS0FBSyxDQUNiLEdBQUcsRUFBRSxnSEFBZ0gsQ0FDdEgsQ0FBQzthQUNIO1NBQ0Y7S0FDRjtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBzbmFrZSB9IGZyb20gJ2Nhc2UnO1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ3Byb2plbi9saWIvX3Jlc29sdmUnO1xuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAncHJvamVuL2xpYi9jb21wb25lbnQnO1xuaW1wb3J0IHsgR2l0SHViQWN0aW9uc1Byb3ZpZGVyIH0gZnJvbSAncHJvamVuL2xpYi9naXRodWIvYWN0aW9ucy1wcm92aWRlcic7XG5pbXBvcnQgeyBHaXRodWJDcmVkZW50aWFscyB9IGZyb20gJ3Byb2plbi9saWIvZ2l0aHViL2dpdGh1Yi1jcmVkZW50aWFscyc7XG5pbXBvcnQgKiBhcyB3b3JrZmxvd3MgZnJvbSAncHJvamVuL2xpYi9naXRodWIvd29ya2Zsb3dzLW1vZGVsJztcbmltcG9ydCB7IGtlYmFiQ2FzZUtleXMgfSBmcm9tICdwcm9qZW4vbGliL3V0aWwnO1xuaW1wb3J0IHsgWWFtbEZpbGUgfSBmcm9tICdwcm9qZW4vbGliL3lhbWwnO1xuaW1wb3J0IHsgQ29kZUNhdGFseXN0IH0gZnJvbSAnLi9jb2RlY2F0YWx5c3QnO1xuXG4vKipcbiAqIE9wdGlvbnMgZm9yIGBDb2RlQ2F0YWx5c3RXb3JrZmxvd2AuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ29kZUNhdGFseXN0V29ya2Zsb3dPcHRpb25zIHtcbiAgLyoqXG4gICAgKiBGb3JjZSB0aGUgY3JlYXRpb24gb2YgdGhlIHdvcmtmbG93IGV2ZW4gaWYgYHdvcmtmbG93c2AgaXMgZGlzYWJsZWQgaW4gYEdpdEh1YmAuXG4gICAgKlxuICAgICogQGRlZmF1bHQgZmFsc2VcbiAgICAqL1xuICByZWFkb25seSBmb3JjZT86IGJvb2xlYW47XG4gIC8qKlxuICAgICogQ29uY3VycmVuY3kgZW5zdXJlcyB0aGF0IG9ubHkgYSBzaW5nbGUgam9iIG9yIHdvcmtmbG93IHVzaW5nIHRoZSBzYW1lIGNvbmN1cnJlbmN5IGdyb3VwIHdpbGwgcnVuIGF0IGEgdGltZS4gQ3VycmVudGx5IGluIGJldGEuXG4gICAgKlxuICAgICogQGRlZmF1bHQgLSBkaXNhYmxlZFxuICAgICogQHNlZSBodHRwczovL2RvY3MuYXdzLmFtYXpvbi5jb20vY29kZWNhdGFseXN0L2xhdGVzdC91c2VyZ3VpZGUvd29ya2Zsb3dzLWNvbmZpZ3VyZS1ydW5zLmh0bWxcbiAgICAqL1xuICByZWFkb25seSBjb25jdXJyZW5jeT86IHN0cmluZztcbn1cblxuLyoqXG4gKiBXb3JrZmxvdyBmb3IgQ29kZUNhdGFseXN0LlxuICpcbiAqIEEgd29ya2Zsb3cgaXMgYSBjb25maWd1cmFibGUgYXV0b21hdGVkIHByb2Nlc3MgbWFkZSB1cCBvZiBvbmUgb3IgbW9yZSBqb2JzLlxuICpcbiAqIEBzZWUgaHR0cHM6Ly9kb2NzLmF3cy5hbWF6b24uY29tL2NvZGVjYXRhbHlzdC9sYXRlc3QvdXNlcmd1aWRlL3dvcmtmbG93LXJlZmVyZW5jZS5odG1sXG4gKi9cbmV4cG9ydCBjbGFzcyBDb2RlQ2F0YWx5c3RXb3JrZmxvdyBleHRlbmRzIENvbXBvbmVudCB7XG4gIC8qKlxuICAgICogVGhlIG5hbWUgb2YgdGhlIHdvcmtmbG93LlxuICAgICovXG4gIHB1YmxpYyByZWFkb25seSBuYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAgKiBDb25jdXJyZW5jeSBlbnN1cmVzIHRoYXQgb25seSBhIHNpbmdsZSBqb2Igb3Igd29ya2Zsb3cgdXNpbmcgdGhlIHNhbWUgY29uY3VycmVuY3kgZ3JvdXAgd2lsbCBydW4gYXQgYSB0aW1lLlxuICAgICpcbiAgICAqIEBkZWZhdWx0IGRpc2FibGVkXG4gICAgKiBAZXhwZXJpbWVudGFsXG4gICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGNvbmN1cnJlbmN5Pzogc3RyaW5nO1xuXG4gIC8qKlxuICAgICogVGhlIHdvcmtmbG93IFlBTUwgZmlsZS4gTWF5IG5vdCBleGlzdCBpZiBgd29ya2Zsb3dzRW5hYmxlZGAgaXMgZmFsc2Ugb24gYEdpdEh1YmAuXG4gICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGZpbGU6IFlhbWxGaWxlIHwgdW5kZWZpbmVkO1xuXG4gIC8qKlxuICAgICogR2l0SHViIEFQSSBhdXRoZW50aWNhdGlvbiBtZXRob2QgdXNlZCBieSBwcm9qZW4gd29ya2Zsb3dzLlxuICAgICovXG4gIHB1YmxpYyByZWFkb25seSBwcm9qZW5DcmVkZW50aWFsczogR2l0aHViQ3JlZGVudGlhbHM7XG5cbiAgLyoqXG4gICAgKiBUaGUgbmFtZSBmb3Igd29ya2Zsb3cgcnVucyBnZW5lcmF0ZWQgZnJvbSB0aGUgd29ya2Zsb3cuIEdpdEh1YiBkaXNwbGF5cyB0aGVcbiAgICAqIHdvcmtmbG93IHJ1biBuYW1lIGluIHRoZSBsaXN0IG9mIHdvcmtmbG93IHJ1bnMgb24geW91ciByZXBvc2l0b3J5J3NcbiAgICAqIFwiQWN0aW9uc1wiIHRhYi4gSWYgYHJ1bi1uYW1lYCBpcyBvbWl0dGVkIG9yIGlzIG9ubHkgd2hpdGVzcGFjZSwgdGhlbiB0aGUgcnVuXG4gICAgKiBuYW1lIGlzIHNldCB0byBldmVudC1zcGVjaWZpYyBpbmZvcm1hdGlvbiBmb3IgdGhlIHdvcmtmbG93IHJ1bi4gRm9yXG4gICAgKiBleGFtcGxlLCBmb3IgYSB3b3JrZmxvdyB0cmlnZ2VyZWQgYnkgYSBgcHVzaGAgb3IgYHB1bGxfcmVxdWVzdGAgZXZlbnQsIGl0XG4gICAgKiBpcyBzZXQgYXMgdGhlIGNvbW1pdCBtZXNzYWdlLlxuICAgICpcbiAgICAqIFRoaXMgdmFsdWUgY2FuIGluY2x1ZGUgZXhwcmVzc2lvbnMgYW5kIGNhbiByZWZlcmVuY2UgYGdpdGh1YmAgYW5kIGBpbnB1dHNgXG4gICAgKiBjb250ZXh0cy5cbiAgICAqL1xuICBwdWJsaWMgcnVuTmFtZT86IHN0cmluZztcblxuICBwcml2YXRlIGFjdGlvbnM6IEdpdEh1YkFjdGlvbnNQcm92aWRlcjtcbiAgcHJpdmF0ZSBldmVudHM6IHdvcmtmbG93cy5UcmlnZ2VycyA9IHt9O1xuICBwcml2YXRlIGpvYnM6IFJlY29yZDxcbiAgc3RyaW5nLFxuICB3b3JrZmxvd3MuSm9iIHwgd29ya2Zsb3dzLkpvYkNhbGxpbmdSZXVzYWJsZVdvcmtmbG93XG4gID4gPSB7fTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBjb2RlY2F0YWx5c3Q6IENvZGVDYXRhbHlzdCxcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgb3B0aW9uczogQ29kZUNhdGFseXN0V29ya2Zsb3dPcHRpb25zID0ge30sXG4gICkge1xuICAgIHN1cGVyKGNvZGVjYXRhbHlzdC5wcm9qZWN0KTtcblxuICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgdGhpcy5jb25jdXJyZW5jeSA9IG9wdGlvbnMuY29uY3VycmVuY3k7XG4gICAgdGhpcy5wcm9qZW5DcmVkZW50aWFscyA9IGNvZGVjYXRhbHlzdC5wcm9qZW5DcmVkZW50aWFscztcbiAgICB0aGlzLmFjdGlvbnMgPSBjb2RlY2F0YWx5c3QuYWN0aW9ucztcblxuICAgIGNvbnN0IHdvcmtmbG93c0VuYWJsZWQgPSBjb2RlY2F0YWx5c3Qud29ya2Zsb3dzRW5hYmxlZCB8fCBvcHRpb25zLmZvcmNlO1xuICAgIGlmICh3b3JrZmxvd3NFbmFibGVkKSB7XG4gICAgICB0aGlzLmZpbGUgPSBuZXcgWWFtbEZpbGUoXG4gICAgICAgIHRoaXMucHJvamVjdCxcbiAgICAgICAgYC5jb2RlY2F0YWx5c3Qvd29ya2Zsb3dzLyR7bmFtZS50b0xvY2FsZUxvd2VyQ2FzZSgpfS55bWxgLFxuICAgICAgICB7XG4gICAgICAgICAgb2JqOiAoKSA9PiB0aGlzLnJlbmRlcldvcmtmbG93KCksXG4gICAgICAgICAgLy8gR2l0SHViIG5lZWRzIHRvIHJlYWQgdGhlIGZpbGUgZnJvbSB0aGUgcmVwb3NpdG9yeSBpbiBvcmRlciB0byB3b3JrLlxuICAgICAgICAgIGNvbW1pdHRlZDogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAgKiBBZGQgZXZlbnRzIHRvIHRyaWdnZXJzIHRoZSB3b3JrZmxvdy5cbiAgICAqXG4gICAgKiBAcGFyYW0gZXZlbnRzIFRoZSBldmVudChzKSB0byB0cmlnZ2VyIHRoZSB3b3JrZmxvdy5cbiAgICAqL1xuICBwdWJsaWMgb24oZXZlbnRzOiB3b3JrZmxvd3MuVHJpZ2dlcnMpIHtcbiAgICB0aGlzLmV2ZW50cyA9IHtcbiAgICAgIC4uLnRoaXMuZXZlbnRzLFxuICAgICAgLi4uZXZlbnRzLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICAqIEFkZHMgYSBzaW5nbGUgam9iIHRvIHRoZSB3b3JrZmxvdy5cbiAgICAqIEBwYXJhbSBpZCBUaGUgam9iIG5hbWUgKHVuaXF1ZSB3aXRoaW4gdGhlIHdvcmtmbG93KVxuICAgICogQHBhcmFtIGpvYiBUaGUgam9iIHNwZWNpZmljYXRpb25cbiAgICAqL1xuICBwdWJsaWMgYWRkSm9iKFxuICAgIGlkOiBzdHJpbmcsXG4gICAgam9iOiB3b3JrZmxvd3MuSm9iIHwgd29ya2Zsb3dzLkpvYkNhbGxpbmdSZXVzYWJsZVdvcmtmbG93LFxuICApOiB2b2lkIHtcbiAgICB0aGlzLmFkZEpvYnMoeyBbaWRdOiBqb2IgfSk7XG4gIH1cblxuICAvKipcbiAgICAqIEFkZCBqb2JzIHRvIHRoZSB3b3JrZmxvdy5cbiAgICAqXG4gICAgKiBAcGFyYW0gam9icyBKb2JzIHRvIGFkZC5cbiAgICAqL1xuICBwdWJsaWMgYWRkSm9icyhcbiAgICBqb2JzOiBSZWNvcmQ8c3RyaW5nLCB3b3JrZmxvd3MuSm9iIHwgd29ya2Zsb3dzLkpvYkNhbGxpbmdSZXVzYWJsZVdvcmtmbG93PixcbiAgKSB7XG4gICAgdmVyaWZ5Sm9iQ29uc3RyYWludHMoam9icyk7XG5cbiAgICB0aGlzLmpvYnMgPSB7XG4gICAgICAuLi50aGlzLmpvYnMsXG4gICAgICAuLi5qb2JzLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICAqIEdldCBhIHNpbmdsZSBqb2IgZnJvbSB0aGUgd29ya2Zsb3cuXG4gICAgKiBAcGFyYW0gaWQgVGhlIGpvYiBuYW1lICh1bmlxdWUgd2l0aGluIHRoZSB3b3JrZmxvdylcbiAgICAqL1xuICBwdWJsaWMgZ2V0Sm9iKFxuICAgIGlkOiBzdHJpbmcsXG4gICk6IHdvcmtmbG93cy5Kb2IgfCB3b3JrZmxvd3MuSm9iQ2FsbGluZ1JldXNhYmxlV29ya2Zsb3cge1xuICAgIHJldHVybiB0aGlzLmpvYnNbaWRdO1xuICB9XG5cbiAgLyoqXG4gICAgKiBVcGRhdGVzIGEgc2luZ2xlIGpvYiB0byB0aGUgd29ya2Zsb3cuXG4gICAgKiBAcGFyYW0gaWQgVGhlIGpvYiBuYW1lICh1bmlxdWUgd2l0aGluIHRoZSB3b3JrZmxvdylcbiAgICAqL1xuICBwdWJsaWMgdXBkYXRlSm9iKFxuICAgIGlkOiBzdHJpbmcsXG4gICAgam9iOiB3b3JrZmxvd3MuSm9iIHwgd29ya2Zsb3dzLkpvYkNhbGxpbmdSZXVzYWJsZVdvcmtmbG93LFxuICApIHtcbiAgICB0aGlzLnVwZGF0ZUpvYnMoeyBbaWRdOiBqb2IgfSk7XG4gIH1cblxuICAvKipcbiAgICAqIFVwZGF0ZXMgam9icyBmb3IgdGhpcyB3b3JrbG93XG4gICAgKiBEb2VzIGEgY29tcGxldGUgcmVwbGFjZSwgaXQgZG9lcyBub3QgdHJ5IHRvIG1lcmdlIHRoZSBqb2JzXG4gICAgKlxuICAgICogQHBhcmFtIGpvYnMgSm9icyB0byB1cGRhdGUuXG4gICAgKi9cbiAgcHVibGljIHVwZGF0ZUpvYnMoXG4gICAgam9iczogUmVjb3JkPHN0cmluZywgd29ya2Zsb3dzLkpvYiB8IHdvcmtmbG93cy5Kb2JDYWxsaW5nUmV1c2FibGVXb3JrZmxvdz4sXG4gICkge1xuICAgIHZlcmlmeUpvYkNvbnN0cmFpbnRzKGpvYnMpO1xuXG4gICAgY29uc3QgbmV3Sm9iSWRzID0gT2JqZWN0LmtleXMoam9icyk7XG4gICAgY29uc3QgdXBkYXRlZEpvYnMgPSBPYmplY3QuZW50cmllcyh0aGlzLmpvYnMpLm1hcCgoW2pvYklkLCBqb2JdKSA9PiB7XG4gICAgICBpZiAobmV3Sm9iSWRzLmluY2x1ZGVzKGpvYklkKSkge1xuICAgICAgICByZXR1cm4gW2pvYklkLCBqb2JzW2pvYklkXV07XG4gICAgICB9XG4gICAgICByZXR1cm4gW2pvYklkLCBqb2JdO1xuICAgIH0pO1xuICAgIHRoaXMuam9icyA9IHtcbiAgICAgIC4uLk9iamVjdC5mcm9tRW50cmllcyh1cGRhdGVkSm9icyksXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgICogUmVtb3ZlcyBhIHNpbmdsZSBqb2IgdG8gdGhlIHdvcmtmbG93LlxuICAgICogQHBhcmFtIGlkIFRoZSBqb2IgbmFtZSAodW5pcXVlIHdpdGhpbiB0aGUgd29ya2Zsb3cpXG4gICAgKi9cbiAgcHVibGljIHJlbW92ZUpvYihpZDogc3RyaW5nKSB7XG4gICAgY29uc3QgdXBkYXRlZEpvYnMgPSBPYmplY3QuZW50cmllcyh0aGlzLmpvYnMpLmZpbHRlcihcbiAgICAgIChbam9iSWRdKSA9PiBqb2JJZCAhPT0gaWQsXG4gICAgKTtcbiAgICB0aGlzLmpvYnMgPSB7XG4gICAgICAuLi5PYmplY3QuZnJvbUVudHJpZXModXBkYXRlZEpvYnMpLFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIHJlbmRlcldvcmtmbG93KCkge1xuICAgIHJldHVybiB7XG4gICAgICAnbmFtZSc6IHRoaXMubmFtZSxcbiAgICAgICdydW4tbmFtZSc6IHRoaXMucnVuTmFtZSxcbiAgICAgICdvbic6IHNuYWtlQ2FzZUtleXModGhpcy5ldmVudHMpLFxuICAgICAgJ2NvbmN1cnJlbmN5JzogdGhpcy5jb25jdXJyZW5jeSxcbiAgICAgICdqb2JzJzogcmVuZGVySm9icyh0aGlzLmpvYnMsIHRoaXMuYWN0aW9ucyksXG4gICAgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzbmFrZUNhc2VLZXlzPFQgPSB1bmtub3duPihvYmo6IFQpOiBUIHtcbiAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnIHx8IG9iaiA9PSBudWxsKSB7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KG9iaikpIHtcbiAgICByZXR1cm4gb2JqLm1hcChzbmFrZUNhc2VLZXlzKSBhcyBhbnk7XG4gIH1cblxuICBjb25zdCByZXN1bHQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XG4gIGZvciAobGV0IFtrLCB2XSBvZiBPYmplY3QuZW50cmllcyhvYmopKSB7XG4gICAgaWYgKHR5cGVvZiB2ID09PSAnb2JqZWN0JyAmJiB2ICE9IG51bGwpIHtcbiAgICAgIHYgPSBzbmFrZUNhc2VLZXlzKHYpO1xuICAgIH1cbiAgICByZXN1bHRbc25ha2UoayldID0gdjtcbiAgfVxuICByZXR1cm4gcmVzdWx0IGFzIGFueTtcbn1cblxuZnVuY3Rpb24gcmVuZGVySm9icyhcbiAgam9iczogUmVjb3JkPHN0cmluZywgd29ya2Zsb3dzLkpvYiB8IHdvcmtmbG93cy5Kb2JDYWxsaW5nUmV1c2FibGVXb3JrZmxvdz4sXG4gIGFjdGlvbnM6IEdpdEh1YkFjdGlvbnNQcm92aWRlcixcbikge1xuICBjb25zdCByZXN1bHQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XG4gIGZvciAoY29uc3QgW25hbWUsIGpvYl0gb2YgT2JqZWN0LmVudHJpZXMoam9icykpIHtcbiAgICByZXN1bHRbbmFtZV0gPSByZW5kZXJKb2Ioam9iKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xuXG4gIC8qKiBAc2VlIGh0dHBzOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9jb2RlY2F0YWx5c3QvbGF0ZXN0L3VzZXJndWlkZS93b3JrZmxvdy1yZWZlcmVuY2UuaHRtbCAqL1xuICBmdW5jdGlvbiByZW5kZXJKb2IoXG4gICAgam9iOiB3b3JrZmxvd3MuSm9iIHwgd29ya2Zsb3dzLkpvYkNhbGxpbmdSZXVzYWJsZVdvcmtmbG93LFxuICApIHtcbiAgICBjb25zdCBzdGVwcyA9IG5ldyBBcnJheTx3b3JrZmxvd3MuSm9iU3RlcD4oKTtcblxuICAgIC8vIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL2VuL2FjdGlvbnMvdXNpbmctd29ya2Zsb3dzL3JldXNpbmctd29ya2Zsb3dzI3N1cHBvcnRlZC1rZXl3b3Jkcy1mb3Itam9icy10aGF0LWNhbGwtYS1yZXVzYWJsZS13b3JrZmxvd1xuICAgIC8vIGh0dHBzOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9jb2RlY2F0YWx5c3QvbGF0ZXN0L3VzZXJndWlkZS93b3JrZmxvdy1yZWZlcmVuY2UuaHRtbFxuICAgIGlmICgndXNlcycgaW4gam9iKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiBqb2IubmFtZSxcbiAgICAgICAgbmVlZHM6IGFycmF5T3JTY2FsYXIoam9iLm5lZWRzKSxcbiAgICAgICAgaWY6IGpvYi5pZixcbiAgICAgICAgcGVybWlzc2lvbnM6IGtlYmFiQ2FzZUtleXMoam9iLnBlcm1pc3Npb25zKSxcbiAgICAgICAgY29uY3VycmVuY3k6IGpvYi5jb25jdXJyZW5jeSxcbiAgICAgICAgdXNlczogam9iLnVzZXMsXG4gICAgICAgIHdpdGg6IGpvYi53aXRoLFxuICAgICAgICBzZWNyZXRzOiBqb2Iuc2VjcmV0cyxcbiAgICAgICAgc3RyYXRlZ3k6IHJlbmRlckpvYlN0cmF0ZWd5KGpvYi5zdHJhdGVneSksXG4gICAgICB9O1xuICAgIH1cblxuICAgIGlmIChqb2IudG9vbHMpIHtcbiAgICAgIHN0ZXBzLnB1c2goLi4uc2V0dXBUb29scyhqb2IudG9vbHMpKTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyRGVmaW5lZFN0ZXBzID0ga2ViYWJDYXNlS2V5cyhyZXNvbHZlKGpvYi5zdGVwcyksIGZhbHNlKTtcbiAgICBzdGVwcy5wdXNoKC4uLnVzZXJEZWZpbmVkU3RlcHMpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICduYW1lJzogam9iLm5hbWUsXG4gICAgICAnbmVlZHMnOiBhcnJheU9yU2NhbGFyKGpvYi5uZWVkcyksXG4gICAgICAncnVucy1vbic6IGFycmF5T3JTY2FsYXIoam9iLnJ1bnNPbiksXG4gICAgICAncGVybWlzc2lvbnMnOiBrZWJhYkNhc2VLZXlzKGpvYi5wZXJtaXNzaW9ucyksXG4gICAgICAnZW52aXJvbm1lbnQnOiBqb2IuZW52aXJvbm1lbnQsXG4gICAgICAnY29uY3VycmVuY3knOiBqb2IuY29uY3VycmVuY3ksXG4gICAgICAnb3V0cHV0cyc6IHJlbmRlckpvYk91dHB1dHMoam9iLm91dHB1dHMpLFxuICAgICAgJ2Vudic6IGpvYi5lbnYsXG4gICAgICAnZGVmYXVsdHMnOiBrZWJhYkNhc2VLZXlzKGpvYi5kZWZhdWx0cyksXG4gICAgICAnaWYnOiBqb2IuaWYsXG4gICAgICAnc3RlcHMnOiBzdGVwcy5tYXAocmVuZGVyU3RlcCksXG4gICAgICAndGltZW91dC1taW51dGVzJzogam9iLnRpbWVvdXRNaW51dGVzLFxuICAgICAgJ3N0cmF0ZWd5JzogcmVuZGVySm9iU3RyYXRlZ3koam9iLnN0cmF0ZWd5KSxcbiAgICAgICdjb250aW51ZS1vbi1lcnJvcic6IGpvYi5jb250aW51ZU9uRXJyb3IsXG4gICAgICAnY29udGFpbmVyJzogam9iLmNvbnRhaW5lcixcbiAgICAgICdzZXJ2aWNlcyc6IGpvYi5zZXJ2aWNlcyxcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gcmVuZGVySm9iT3V0cHV0cyhvdXRwdXQ6IHdvcmtmbG93cy5Kb2JbJ291dHB1dHMnXSkge1xuICAgIGlmIChvdXRwdXQgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBjb25zdCByZW5kZXJlZDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICAgIGZvciAoY29uc3QgW25hbWUsIHsgc3RlcElkLCBvdXRwdXROYW1lIH1dIG9mIE9iamVjdC5lbnRyaWVzKG91dHB1dCkpIHtcbiAgICAgIHJlbmRlcmVkW25hbWVdID0gYFxcJHt7IHN0ZXBzLiR7c3RlcElkfS5vdXRwdXRzLiR7b3V0cHV0TmFtZX0gfX1gO1xuICAgIH1cbiAgICByZXR1cm4gcmVuZGVyZWQ7XG4gIH1cblxuICBmdW5jdGlvbiByZW5kZXJKb2JTdHJhdGVneShzdHJhdGVneTogd29ya2Zsb3dzLkpvYlsnc3RyYXRlZ3knXSkge1xuICAgIGlmIChzdHJhdGVneSA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGNvbnN0IHJlbmRlcmVkOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAgICdtYXgtcGFyYWxsZWwnOiBzdHJhdGVneS5tYXhQYXJhbGxlbCxcbiAgICAgICdmYWlsLWZhc3QnOiBzdHJhdGVneS5mYWlsRmFzdCxcbiAgICB9O1xuXG4gICAgaWYgKHN0cmF0ZWd5Lm1hdHJpeCkge1xuICAgICAgY29uc3QgbWF0cml4OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAgICAgaW5jbHVkZTogc3RyYXRlZ3kubWF0cml4LmluY2x1ZGUsXG4gICAgICAgIGV4Y2x1ZGU6IHN0cmF0ZWd5Lm1hdHJpeC5leGNsdWRlLFxuICAgICAgfTtcbiAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVzXSBvZiBPYmplY3QuZW50cmllcyhcbiAgICAgICAgc3RyYXRlZ3kubWF0cml4LmRvbWFpbiA/PyB7fSxcbiAgICAgICkpIHtcbiAgICAgICAgaWYgKGtleSBpbiBtYXRyaXgpIHtcbiAgICAgICAgICAvLyBBIGRvbWFpbiBrZXkgd2FzIHNldCB0byBgaW5jbHVkZWAsIG9yIGBleGNsdWRlYDpcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYElsbGVnYWwgam9iIHN0cmF0ZWd5IG1hdHJpeCBrZXk6ICR7a2V5fWApO1xuICAgICAgICB9XG4gICAgICAgIG1hdHJpeFtrZXldID0gdmFsdWVzO1xuICAgICAgfVxuICAgICAgcmVuZGVyZWQubWF0cml4ID0gbWF0cml4O1xuICAgIH1cblxuICAgIHJldHVybiByZW5kZXJlZDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbmRlclN0ZXAoc3RlcDogd29ya2Zsb3dzLkpvYlN0ZXApIHtcbiAgICByZXR1cm4ge1xuICAgICAgJ25hbWUnOiBzdGVwLm5hbWUsXG4gICAgICAnaWQnOiBzdGVwLmlkLFxuICAgICAgJ2lmJzogc3RlcC5pZixcbiAgICAgICd1c2VzJzogc3RlcC51c2VzICYmIGFjdGlvbnMuZ2V0KHN0ZXAudXNlcyksXG4gICAgICAnZW52Jzogc3RlcC5lbnYsXG4gICAgICAncnVuJzogc3RlcC5ydW4sXG4gICAgICAnd2l0aCc6IHN0ZXAud2l0aCxcbiAgICAgICdjb250aW51ZS1vbi1lcnJvcic6IHN0ZXAuY29udGludWVPbkVycm9yLFxuICAgICAgJ3RpbWVvdXQtbWludXRlcyc6IHN0ZXAudGltZW91dE1pbnV0ZXMsXG4gICAgICAnd29ya2luZy1kaXJlY3RvcnknOiBzdGVwLndvcmtpbmdEaXJlY3RvcnksXG4gICAgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhcnJheU9yU2NhbGFyPFQ+KGFycjogVFtdIHwgdW5kZWZpbmVkKTogVCB8IFRbXSB8IHVuZGVmaW5lZCB7XG4gIGlmIChhcnIgPT0gbnVsbCB8fCBhcnIubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGFycjtcbiAgfVxuICBpZiAoYXJyLmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBhcnJbMF07XG4gIH1cbiAgcmV0dXJuIGFycjtcbn1cblxuZnVuY3Rpb24gc2V0dXBUb29scyh0b29sczogd29ya2Zsb3dzLlRvb2xzKSB7XG4gIGNvbnN0IHN0ZXBzOiB3b3JrZmxvd3MuSm9iU3RlcFtdID0gW107XG5cbiAgaWYgKHRvb2xzLmphdmEpIHtcbiAgICBzdGVwcy5wdXNoKHtcbiAgICAgIHVzZXM6ICdhY3Rpb25zL3NldHVwLWphdmFAdjMnLFxuICAgICAgd2l0aDogeyAnZGlzdHJpYnV0aW9uJzogJ3RlbXVyaW4nLCAnamF2YS12ZXJzaW9uJzogdG9vbHMuamF2YS52ZXJzaW9uIH0sXG4gICAgfSk7XG4gIH1cblxuICBpZiAodG9vbHMubm9kZSkge1xuICAgIHN0ZXBzLnB1c2goe1xuICAgICAgdXNlczogJ2FjdGlvbnMvc2V0dXAtbm9kZUB2MycsXG4gICAgICB3aXRoOiB7ICdub2RlLXZlcnNpb24nOiB0b29scy5ub2RlLnZlcnNpb24gfSxcbiAgICB9KTtcbiAgfVxuXG4gIGlmICh0b29scy5weXRob24pIHtcbiAgICBzdGVwcy5wdXNoKHtcbiAgICAgIHVzZXM6ICdhY3Rpb25zL3NldHVwLXB5dGhvbkB2NCcsXG4gICAgICB3aXRoOiB7ICdweXRob24tdmVyc2lvbic6IHRvb2xzLnB5dGhvbi52ZXJzaW9uIH0sXG4gICAgfSk7XG4gIH1cblxuICBpZiAodG9vbHMuZ28pIHtcbiAgICBzdGVwcy5wdXNoKHtcbiAgICAgIHVzZXM6ICdhY3Rpb25zL3NldHVwLWdvQHYzJyxcbiAgICAgIHdpdGg6IHsgJ2dvLXZlcnNpb24nOiB0b29scy5nby52ZXJzaW9uIH0sXG4gICAgfSk7XG4gIH1cblxuICBpZiAodG9vbHMuZG90bmV0KSB7XG4gICAgc3RlcHMucHVzaCh7XG4gICAgICB1c2VzOiAnYWN0aW9ucy9zZXR1cC1kb3RuZXRAdjMnLFxuICAgICAgd2l0aDogeyAnZG90bmV0LXZlcnNpb24nOiB0b29scy5kb3RuZXQudmVyc2lvbiB9LFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHN0ZXBzO1xufVxuXG5mdW5jdGlvbiB2ZXJpZnlKb2JDb25zdHJhaW50cyhcbiAgam9iczogUmVjb3JkPHN0cmluZywgd29ya2Zsb3dzLkpvYiB8IHdvcmtmbG93cy5Kb2JDYWxsaW5nUmV1c2FibGVXb3JrZmxvdz4sXG4pIHtcbiAgLy8gdmVyaWZ5IHRoYXQgam9iIGhhcyBhIFwicGVybWlzc2lvbnNcIiBzdGF0ZW1lbnQgdG8gZW5zdXJlIHdvcmtmbG93IGNhblxuICAvLyBvcGVyYXRlIGluIHJlcG9zIHdpdGggZGVmYXVsdCB0b2tlbnMgc2V0IHRvIHJlYWRvbmx5XG4gIGZvciAoY29uc3QgW2lkLCBqb2JdIG9mIE9iamVjdC5lbnRyaWVzKGpvYnMpKSB7XG4gICAgaWYgKCFqb2IucGVybWlzc2lvbnMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYCR7aWR9OiBhbGwgd29ya2Zsb3cgam9icyBtdXN0IGhhdmUgYSBcInBlcm1pc3Npb25zXCIgY2xhdXNlIHRvIGVuc3VyZSB3b3JrZmxvdyBjYW4gb3BlcmF0ZSBpbiByZXN0cmljdGVkIHJlcG9zaXRvcmllc2AsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8vIHZlcmlmeSB0aGF0IGpvYiBoYXMgYSBcInJ1bnNPblwiIHN0YXRlbWVudCB0byBlbnN1cmUgYSB3b3JrZXIgY2FuIGJlIHNlbGVjdGVkIGFwcHJvcHJpYXRlbHlcbiAgZm9yIChjb25zdCBbaWQsIGpvYl0gb2YgT2JqZWN0LmVudHJpZXMoam9icykpIHtcbiAgICBpZiAoISgndXNlcycgaW4gam9iKSkge1xuICAgICAgaWYgKCdydW5zT24nIGluIGpvYiAmJiBqb2IucnVuc09uLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYCR7aWR9OiBhdCBsZWFzdCBvbmUgcnVubmVyIHNlbGVjdG9yIGxhYmVscyBtdXN0IGJlIHByb3ZpZGVkIGluIFwicnVuc09uXCIgdG8gZW5zdXJlIGEgcnVubmVyIGluc3RhbmNlIGNhbiBiZSBzZWxlY3RlZGAsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICB9XG59Il19