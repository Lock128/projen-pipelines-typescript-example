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
        var _a;
        super(codecatalyst.project);
        this.events = {};
        this.jobs = {};
        this.name = name;
        this.concurrency = options.concurrency;
        this.projenCredentials = codecatalyst.projenCredentials;
        this.actions = codecatalyst.actions;
        const workflowsEnabled = codecatalyst.workflowsEnabled || options.force;
        console.log('CodeCatalyst: workflowsEnabled: ' + workflowsEnabled);
        if (workflowsEnabled) {
            this.file = new yaml_1.YamlFile(this.project, `.codecatalyts/workflows/${name.toLocaleLowerCase()}.yml`, {
                obj: () => this.renderWorkflow(),
                // GitHub needs to read the file from the repository in order to work.
                committed: true,
            });
        }
        console.log(`this.file: ${(_a = this.file) === null || _a === void 0 ? void 0 : _a.absolutePath}`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2Zsb3cuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvZW5naW5lL2NvZGVjYXRhbHlzdC93b3JrZmxvdy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSwrQkFBNkI7QUFDN0Isa0RBQThDO0FBQzlDLG9EQUFpRDtBQUlqRCwwQ0FBZ0Q7QUFDaEQsMENBQTJDO0FBc0IzQzs7Ozs7O0dBTUc7QUFDSCxNQUFhLG9CQUFxQixTQUFRLHFCQUFTO0lBNENqRCxZQUNFLFlBQTBCLEVBQzFCLElBQVksRUFDWixVQUF1QyxFQUFFOztRQUV6QyxLQUFLLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBWHRCLFdBQU0sR0FBdUIsRUFBRSxDQUFDO1FBQ2hDLFNBQUksR0FHUixFQUFFLENBQUM7UUFTTCxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNqQixJQUFJLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUM7UUFDdkMsSUFBSSxDQUFDLGlCQUFpQixHQUFHLFlBQVksQ0FBQyxpQkFBaUIsQ0FBQztRQUN4RCxJQUFJLENBQUMsT0FBTyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUM7UUFFcEMsTUFBTSxnQkFBZ0IsR0FBRyxZQUFZLENBQUMsZ0JBQWdCLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQztRQUN4RSxPQUFPLENBQUMsR0FBRyxDQUFDLGtDQUFrQyxHQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDakUsSUFBSSxnQkFBZ0IsRUFBRTtZQUNwQixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksZUFBUSxDQUN0QixJQUFJLENBQUMsT0FBTyxFQUNaLDJCQUEyQixJQUFJLENBQUMsaUJBQWlCLEVBQUUsTUFBTSxFQUN6RDtnQkFDRSxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRTtnQkFDaEMsc0VBQXNFO2dCQUN0RSxTQUFTLEVBQUUsSUFBSTthQUNoQixD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RUFBRSx5QkFBeUI7WUFDL0IsSUFBSSxFQUFFLEVBQUUsZ0JBQWdCLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUU7U0FDakQsQ0FBQyxDQUFDO0tBQ0o7SUFFRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFFRCxTQUFTLG9CQUFvQixDQUMzQixJQUEwRTtJQUUxRSx1RUFBdUU7SUFDdkUsdURBQXVEO0lBQ3ZELEtBQUssTUFBTSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQzVDLElBQUksQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFO1lBQ3BCLE1BQU0sSUFBSSxLQUFLLENBQ2IsR0FBRyxFQUFFLGdIQUFnSCxDQUN0SCxDQUFDO1NBQ0g7S0FDRjtJQUVELDRGQUE0RjtJQUM1RixLQUFLLE1BQU0sQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUM1QyxJQUFJLENBQUMsQ0FBQyxNQUFNLElBQUksR0FBRyxDQUFDLEVBQUU7WUFDcEIsSUFBSSxRQUFRLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtnQkFDOUMsTUFBTSxJQUFJLEtBQUssQ0FDYixHQUFHLEVBQUUsZ0hBQWdILENBQ3RILENBQUM7YUFDSDtTQUNGO0tBQ0Y7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgc25ha2UgfSBmcm9tICdjYXNlJztcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdwcm9qZW4vbGliL19yZXNvbHZlJztcbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJ3Byb2plbi9saWIvY29tcG9uZW50JztcbmltcG9ydCB7IEdpdEh1YkFjdGlvbnNQcm92aWRlciB9IGZyb20gJ3Byb2plbi9saWIvZ2l0aHViL2FjdGlvbnMtcHJvdmlkZXInO1xuaW1wb3J0IHsgR2l0aHViQ3JlZGVudGlhbHMgfSBmcm9tICdwcm9qZW4vbGliL2dpdGh1Yi9naXRodWItY3JlZGVudGlhbHMnO1xuaW1wb3J0ICogYXMgd29ya2Zsb3dzIGZyb20gJ3Byb2plbi9saWIvZ2l0aHViL3dvcmtmbG93cy1tb2RlbCc7XG5pbXBvcnQgeyBrZWJhYkNhc2VLZXlzIH0gZnJvbSAncHJvamVuL2xpYi91dGlsJztcbmltcG9ydCB7IFlhbWxGaWxlIH0gZnJvbSAncHJvamVuL2xpYi95YW1sJztcbmltcG9ydCB7IENvZGVDYXRhbHlzdCB9IGZyb20gJy4vY29kZWNhdGFseXN0JztcblxuLyoqXG4gKiBPcHRpb25zIGZvciBgQ29kZUNhdGFseXN0V29ya2Zsb3dgLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIENvZGVDYXRhbHlzdFdvcmtmbG93T3B0aW9ucyB7XG4gIC8qKlxuICAgKiBGb3JjZSB0aGUgY3JlYXRpb24gb2YgdGhlIHdvcmtmbG93IGV2ZW4gaWYgYHdvcmtmbG93c2AgaXMgZGlzYWJsZWQgaW4gYEdpdEh1YmAuXG4gICAqXG4gICAqIEBkZWZhdWx0IGZhbHNlXG4gICAqL1xuICByZWFkb25seSBmb3JjZT86IGJvb2xlYW47XG4gIC8qKlxuICAgKiBDb25jdXJyZW5jeSBlbnN1cmVzIHRoYXQgb25seSBhIHNpbmdsZSBqb2Igb3Igd29ya2Zsb3cgdXNpbmcgdGhlIHNhbWUgY29uY3VycmVuY3kgZ3JvdXAgd2lsbCBydW4gYXQgYSB0aW1lLiBDdXJyZW50bHkgaW4gYmV0YS5cbiAgICpcbiAgICogQGRlZmF1bHQgLSBkaXNhYmxlZFxuICAgKiBAc2VlIGh0dHBzOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9jb2RlY2F0YWx5c3QvbGF0ZXN0L3VzZXJndWlkZS93b3JrZmxvd3MtY29uZmlndXJlLXJ1bnMuaHRtbFxuICAgKi9cbiAgcmVhZG9ubHkgY29uY3VycmVuY3k/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogV29ya2Zsb3cgZm9yIENvZGVDYXRhbHlzdC5cbiAqXG4gKiBBIHdvcmtmbG93IGlzIGEgY29uZmlndXJhYmxlIGF1dG9tYXRlZCBwcm9jZXNzIG1hZGUgdXAgb2Ygb25lIG9yIG1vcmUgam9icy5cbiAqXG4gKiBAc2VlIGh0dHBzOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9jb2RlY2F0YWx5c3QvbGF0ZXN0L3VzZXJndWlkZS93b3JrZmxvdy1yZWZlcmVuY2UuaHRtbFxuICovXG5leHBvcnQgY2xhc3MgQ29kZUNhdGFseXN0V29ya2Zsb3cgZXh0ZW5kcyBDb21wb25lbnQge1xuICAvKipcbiAgICogVGhlIG5hbWUgb2YgdGhlIHdvcmtmbG93LlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IG5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICogQ29uY3VycmVuY3kgZW5zdXJlcyB0aGF0IG9ubHkgYSBzaW5nbGUgam9iIG9yIHdvcmtmbG93IHVzaW5nIHRoZSBzYW1lIGNvbmN1cnJlbmN5IGdyb3VwIHdpbGwgcnVuIGF0IGEgdGltZS5cbiAgICpcbiAgICogQGRlZmF1bHQgZGlzYWJsZWRcbiAgICogQGV4cGVyaW1lbnRhbFxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGNvbmN1cnJlbmN5Pzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBUaGUgd29ya2Zsb3cgWUFNTCBmaWxlLiBNYXkgbm90IGV4aXN0IGlmIGB3b3JrZmxvd3NFbmFibGVkYCBpcyBmYWxzZSBvbiBgR2l0SHViYC5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBmaWxlOiBZYW1sRmlsZSB8IHVuZGVmaW5lZDtcblxuICAvKipcbiAgICogR2l0SHViIEFQSSBhdXRoZW50aWNhdGlvbiBtZXRob2QgdXNlZCBieSBwcm9qZW4gd29ya2Zsb3dzLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IHByb2plbkNyZWRlbnRpYWxzOiBHaXRodWJDcmVkZW50aWFscztcblxuICAvKipcbiAgICogVGhlIG5hbWUgZm9yIHdvcmtmbG93IHJ1bnMgZ2VuZXJhdGVkIGZyb20gdGhlIHdvcmtmbG93LiBHaXRIdWIgZGlzcGxheXMgdGhlXG4gICAqIHdvcmtmbG93IHJ1biBuYW1lIGluIHRoZSBsaXN0IG9mIHdvcmtmbG93IHJ1bnMgb24geW91ciByZXBvc2l0b3J5J3NcbiAgICogXCJBY3Rpb25zXCIgdGFiLiBJZiBgcnVuLW5hbWVgIGlzIG9taXR0ZWQgb3IgaXMgb25seSB3aGl0ZXNwYWNlLCB0aGVuIHRoZSBydW5cbiAgICogbmFtZSBpcyBzZXQgdG8gZXZlbnQtc3BlY2lmaWMgaW5mb3JtYXRpb24gZm9yIHRoZSB3b3JrZmxvdyBydW4uIEZvclxuICAgKiBleGFtcGxlLCBmb3IgYSB3b3JrZmxvdyB0cmlnZ2VyZWQgYnkgYSBgcHVzaGAgb3IgYHB1bGxfcmVxdWVzdGAgZXZlbnQsIGl0XG4gICAqIGlzIHNldCBhcyB0aGUgY29tbWl0IG1lc3NhZ2UuXG4gICAqXG4gICAqIFRoaXMgdmFsdWUgY2FuIGluY2x1ZGUgZXhwcmVzc2lvbnMgYW5kIGNhbiByZWZlcmVuY2UgYGdpdGh1YmAgYW5kIGBpbnB1dHNgXG4gICAqIGNvbnRleHRzLlxuICAgKi9cbiAgcHVibGljIHJ1bk5hbWU/OiBzdHJpbmc7XG5cbiAgcHJpdmF0ZSBhY3Rpb25zOiBHaXRIdWJBY3Rpb25zUHJvdmlkZXI7XG4gIHByaXZhdGUgZXZlbnRzOiB3b3JrZmxvd3MuVHJpZ2dlcnMgPSB7fTtcbiAgcHJpdmF0ZSBqb2JzOiBSZWNvcmQ8XG4gIHN0cmluZyxcbiAgd29ya2Zsb3dzLkpvYiB8IHdvcmtmbG93cy5Kb2JDYWxsaW5nUmV1c2FibGVXb3JrZmxvd1xuICA+ID0ge307XG5cbiAgY29uc3RydWN0b3IoXG4gICAgY29kZWNhdGFseXN0OiBDb2RlQ2F0YWx5c3QsXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIG9wdGlvbnM6IENvZGVDYXRhbHlzdFdvcmtmbG93T3B0aW9ucyA9IHt9LFxuICApIHtcbiAgICBzdXBlcihjb2RlY2F0YWx5c3QucHJvamVjdCk7XG5cbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMuY29uY3VycmVuY3kgPSBvcHRpb25zLmNvbmN1cnJlbmN5O1xuICAgIHRoaXMucHJvamVuQ3JlZGVudGlhbHMgPSBjb2RlY2F0YWx5c3QucHJvamVuQ3JlZGVudGlhbHM7XG4gICAgdGhpcy5hY3Rpb25zID0gY29kZWNhdGFseXN0LmFjdGlvbnM7XG5cbiAgICBjb25zdCB3b3JrZmxvd3NFbmFibGVkID0gY29kZWNhdGFseXN0LndvcmtmbG93c0VuYWJsZWQgfHwgb3B0aW9ucy5mb3JjZTtcbiAgICBjb25zb2xlLmxvZygnQ29kZUNhdGFseXN0OiB3b3JrZmxvd3NFbmFibGVkOiAnK3dvcmtmbG93c0VuYWJsZWQpO1xuICAgIGlmICh3b3JrZmxvd3NFbmFibGVkKSB7XG4gICAgICB0aGlzLmZpbGUgPSBuZXcgWWFtbEZpbGUoXG4gICAgICAgIHRoaXMucHJvamVjdCxcbiAgICAgICAgYC5jb2RlY2F0YWx5dHMvd29ya2Zsb3dzLyR7bmFtZS50b0xvY2FsZUxvd2VyQ2FzZSgpfS55bWxgLFxuICAgICAgICB7XG4gICAgICAgICAgb2JqOiAoKSA9PiB0aGlzLnJlbmRlcldvcmtmbG93KCksXG4gICAgICAgICAgLy8gR2l0SHViIG5lZWRzIHRvIHJlYWQgdGhlIGZpbGUgZnJvbSB0aGUgcmVwb3NpdG9yeSBpbiBvcmRlciB0byB3b3JrLlxuICAgICAgICAgIGNvbW1pdHRlZDogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgfVxuICAgIGNvbnNvbGUubG9nKGB0aGlzLmZpbGU6ICR7dGhpcy5maWxlPy5hYnNvbHV0ZVBhdGh9YCk7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGV2ZW50cyB0byB0cmlnZ2VycyB0aGUgd29ya2Zsb3cuXG4gICAqXG4gICAqIEBwYXJhbSBldmVudHMgVGhlIGV2ZW50KHMpIHRvIHRyaWdnZXIgdGhlIHdvcmtmbG93LlxuICAgKi9cbiAgcHVibGljIG9uKGV2ZW50czogd29ya2Zsb3dzLlRyaWdnZXJzKSB7XG4gICAgdGhpcy5ldmVudHMgPSB7XG4gICAgICAuLi50aGlzLmV2ZW50cyxcbiAgICAgIC4uLmV2ZW50cyxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYSBzaW5nbGUgam9iIHRvIHRoZSB3b3JrZmxvdy5cbiAgICogQHBhcmFtIGlkIFRoZSBqb2IgbmFtZSAodW5pcXVlIHdpdGhpbiB0aGUgd29ya2Zsb3cpXG4gICAqIEBwYXJhbSBqb2IgVGhlIGpvYiBzcGVjaWZpY2F0aW9uXG4gICAqL1xuICBwdWJsaWMgYWRkSm9iKFxuICAgIGlkOiBzdHJpbmcsXG4gICAgam9iOiB3b3JrZmxvd3MuSm9iIHwgd29ya2Zsb3dzLkpvYkNhbGxpbmdSZXVzYWJsZVdvcmtmbG93LFxuICApOiB2b2lkIHtcbiAgICB0aGlzLmFkZEpvYnMoeyBbaWRdOiBqb2IgfSk7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGpvYnMgdG8gdGhlIHdvcmtmbG93LlxuICAgKlxuICAgKiBAcGFyYW0gam9icyBKb2JzIHRvIGFkZC5cbiAgICovXG4gIHB1YmxpYyBhZGRKb2JzKFxuICAgIGpvYnM6IFJlY29yZDxzdHJpbmcsIHdvcmtmbG93cy5Kb2IgfCB3b3JrZmxvd3MuSm9iQ2FsbGluZ1JldXNhYmxlV29ya2Zsb3c+LFxuICApIHtcbiAgICB2ZXJpZnlKb2JDb25zdHJhaW50cyhqb2JzKTtcblxuICAgIHRoaXMuam9icyA9IHtcbiAgICAgIC4uLnRoaXMuam9icyxcbiAgICAgIC4uLmpvYnMsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYSBzaW5nbGUgam9iIGZyb20gdGhlIHdvcmtmbG93LlxuICAgKiBAcGFyYW0gaWQgVGhlIGpvYiBuYW1lICh1bmlxdWUgd2l0aGluIHRoZSB3b3JrZmxvdylcbiAgICovXG4gIHB1YmxpYyBnZXRKb2IoXG4gICAgaWQ6IHN0cmluZyxcbiAgKTogd29ya2Zsb3dzLkpvYiB8IHdvcmtmbG93cy5Kb2JDYWxsaW5nUmV1c2FibGVXb3JrZmxvdyB7XG4gICAgcmV0dXJuIHRoaXMuam9ic1tpZF07XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlcyBhIHNpbmdsZSBqb2IgdG8gdGhlIHdvcmtmbG93LlxuICAgKiBAcGFyYW0gaWQgVGhlIGpvYiBuYW1lICh1bmlxdWUgd2l0aGluIHRoZSB3b3JrZmxvdylcbiAgICovXG4gIHB1YmxpYyB1cGRhdGVKb2IoXG4gICAgaWQ6IHN0cmluZyxcbiAgICBqb2I6IHdvcmtmbG93cy5Kb2IgfCB3b3JrZmxvd3MuSm9iQ2FsbGluZ1JldXNhYmxlV29ya2Zsb3csXG4gICkge1xuICAgIHRoaXMudXBkYXRlSm9icyh7IFtpZF06IGpvYiB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGVzIGpvYnMgZm9yIHRoaXMgd29ya2xvd1xuICAgKiBEb2VzIGEgY29tcGxldGUgcmVwbGFjZSwgaXQgZG9lcyBub3QgdHJ5IHRvIG1lcmdlIHRoZSBqb2JzXG4gICAqXG4gICAqIEBwYXJhbSBqb2JzIEpvYnMgdG8gdXBkYXRlLlxuICAgKi9cbiAgcHVibGljIHVwZGF0ZUpvYnMoXG4gICAgam9iczogUmVjb3JkPHN0cmluZywgd29ya2Zsb3dzLkpvYiB8IHdvcmtmbG93cy5Kb2JDYWxsaW5nUmV1c2FibGVXb3JrZmxvdz4sXG4gICkge1xuICAgIHZlcmlmeUpvYkNvbnN0cmFpbnRzKGpvYnMpO1xuXG4gICAgY29uc3QgbmV3Sm9iSWRzID0gT2JqZWN0LmtleXMoam9icyk7XG4gICAgY29uc3QgdXBkYXRlZEpvYnMgPSBPYmplY3QuZW50cmllcyh0aGlzLmpvYnMpLm1hcCgoW2pvYklkLCBqb2JdKSA9PiB7XG4gICAgICBpZiAobmV3Sm9iSWRzLmluY2x1ZGVzKGpvYklkKSkge1xuICAgICAgICByZXR1cm4gW2pvYklkLCBqb2JzW2pvYklkXV07XG4gICAgICB9XG4gICAgICByZXR1cm4gW2pvYklkLCBqb2JdO1xuICAgIH0pO1xuICAgIHRoaXMuam9icyA9IHtcbiAgICAgIC4uLk9iamVjdC5mcm9tRW50cmllcyh1cGRhdGVkSm9icyksXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGEgc2luZ2xlIGpvYiB0byB0aGUgd29ya2Zsb3cuXG4gICAqIEBwYXJhbSBpZCBUaGUgam9iIG5hbWUgKHVuaXF1ZSB3aXRoaW4gdGhlIHdvcmtmbG93KVxuICAgKi9cbiAgcHVibGljIHJlbW92ZUpvYihpZDogc3RyaW5nKSB7XG4gICAgY29uc3QgdXBkYXRlZEpvYnMgPSBPYmplY3QuZW50cmllcyh0aGlzLmpvYnMpLmZpbHRlcihcbiAgICAgIChbam9iSWRdKSA9PiBqb2JJZCAhPT0gaWQsXG4gICAgKTtcbiAgICB0aGlzLmpvYnMgPSB7XG4gICAgICAuLi5PYmplY3QuZnJvbUVudHJpZXModXBkYXRlZEpvYnMpLFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIHJlbmRlcldvcmtmbG93KCkge1xuICAgIHJldHVybiB7XG4gICAgICAnbmFtZSc6IHRoaXMubmFtZSxcbiAgICAgICdydW4tbmFtZSc6IHRoaXMucnVuTmFtZSxcbiAgICAgICdvbic6IHNuYWtlQ2FzZUtleXModGhpcy5ldmVudHMpLFxuICAgICAgJ2NvbmN1cnJlbmN5JzogdGhpcy5jb25jdXJyZW5jeSxcbiAgICAgICdqb2JzJzogcmVuZGVySm9icyh0aGlzLmpvYnMsIHRoaXMuYWN0aW9ucyksXG4gICAgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzbmFrZUNhc2VLZXlzPFQgPSB1bmtub3duPihvYmo6IFQpOiBUIHtcbiAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnIHx8IG9iaiA9PSBudWxsKSB7XG4gICAgcmV0dXJuIG9iajtcbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KG9iaikpIHtcbiAgICByZXR1cm4gb2JqLm1hcChzbmFrZUNhc2VLZXlzKSBhcyBhbnk7XG4gIH1cblxuICBjb25zdCByZXN1bHQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XG4gIGZvciAobGV0IFtrLCB2XSBvZiBPYmplY3QuZW50cmllcyhvYmopKSB7XG4gICAgaWYgKHR5cGVvZiB2ID09PSAnb2JqZWN0JyAmJiB2ICE9IG51bGwpIHtcbiAgICAgIHYgPSBzbmFrZUNhc2VLZXlzKHYpO1xuICAgIH1cbiAgICByZXN1bHRbc25ha2UoayldID0gdjtcbiAgfVxuICByZXR1cm4gcmVzdWx0IGFzIGFueTtcbn1cblxuZnVuY3Rpb24gcmVuZGVySm9icyhcbiAgam9iczogUmVjb3JkPHN0cmluZywgd29ya2Zsb3dzLkpvYiB8IHdvcmtmbG93cy5Kb2JDYWxsaW5nUmV1c2FibGVXb3JrZmxvdz4sXG4gIGFjdGlvbnM6IEdpdEh1YkFjdGlvbnNQcm92aWRlcixcbikge1xuICBjb25zdCByZXN1bHQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XG4gIGZvciAoY29uc3QgW25hbWUsIGpvYl0gb2YgT2JqZWN0LmVudHJpZXMoam9icykpIHtcbiAgICByZXN1bHRbbmFtZV0gPSByZW5kZXJKb2Ioam9iKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xuXG4gIC8qKiBAc2VlIGh0dHBzOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9jb2RlY2F0YWx5c3QvbGF0ZXN0L3VzZXJndWlkZS93b3JrZmxvdy1yZWZlcmVuY2UuaHRtbCAqL1xuICBmdW5jdGlvbiByZW5kZXJKb2IoXG4gICAgam9iOiB3b3JrZmxvd3MuSm9iIHwgd29ya2Zsb3dzLkpvYkNhbGxpbmdSZXVzYWJsZVdvcmtmbG93LFxuICApIHtcbiAgICBjb25zdCBzdGVwcyA9IG5ldyBBcnJheTx3b3JrZmxvd3MuSm9iU3RlcD4oKTtcblxuICAgIC8vIGh0dHBzOi8vZG9jcy5naXRodWIuY29tL2VuL2FjdGlvbnMvdXNpbmctd29ya2Zsb3dzL3JldXNpbmctd29ya2Zsb3dzI3N1cHBvcnRlZC1rZXl3b3Jkcy1mb3Itam9icy10aGF0LWNhbGwtYS1yZXVzYWJsZS13b3JrZmxvd1xuICAgIC8vIGh0dHBzOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9jb2RlY2F0YWx5c3QvbGF0ZXN0L3VzZXJndWlkZS93b3JrZmxvdy1yZWZlcmVuY2UuaHRtbFxuICAgIGlmICgndXNlcycgaW4gam9iKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiBqb2IubmFtZSxcbiAgICAgICAgbmVlZHM6IGFycmF5T3JTY2FsYXIoam9iLm5lZWRzKSxcbiAgICAgICAgaWY6IGpvYi5pZixcbiAgICAgICAgcGVybWlzc2lvbnM6IGtlYmFiQ2FzZUtleXMoam9iLnBlcm1pc3Npb25zKSxcbiAgICAgICAgY29uY3VycmVuY3k6IGpvYi5jb25jdXJyZW5jeSxcbiAgICAgICAgdXNlczogam9iLnVzZXMsXG4gICAgICAgIHdpdGg6IGpvYi53aXRoLFxuICAgICAgICBzZWNyZXRzOiBqb2Iuc2VjcmV0cyxcbiAgICAgICAgc3RyYXRlZ3k6IHJlbmRlckpvYlN0cmF0ZWd5KGpvYi5zdHJhdGVneSksXG4gICAgICB9O1xuICAgIH1cblxuICAgIGlmIChqb2IudG9vbHMpIHtcbiAgICAgIHN0ZXBzLnB1c2goLi4uc2V0dXBUb29scyhqb2IudG9vbHMpKTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyRGVmaW5lZFN0ZXBzID0ga2ViYWJDYXNlS2V5cyhyZXNvbHZlKGpvYi5zdGVwcyksIGZhbHNlKTtcbiAgICBzdGVwcy5wdXNoKC4uLnVzZXJEZWZpbmVkU3RlcHMpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICduYW1lJzogam9iLm5hbWUsXG4gICAgICAnbmVlZHMnOiBhcnJheU9yU2NhbGFyKGpvYi5uZWVkcyksXG4gICAgICAncnVucy1vbic6IGFycmF5T3JTY2FsYXIoam9iLnJ1bnNPbiksXG4gICAgICAncGVybWlzc2lvbnMnOiBrZWJhYkNhc2VLZXlzKGpvYi5wZXJtaXNzaW9ucyksXG4gICAgICAnZW52aXJvbm1lbnQnOiBqb2IuZW52aXJvbm1lbnQsXG4gICAgICAnY29uY3VycmVuY3knOiBqb2IuY29uY3VycmVuY3ksXG4gICAgICAnb3V0cHV0cyc6IHJlbmRlckpvYk91dHB1dHMoam9iLm91dHB1dHMpLFxuICAgICAgJ2Vudic6IGpvYi5lbnYsXG4gICAgICAnZGVmYXVsdHMnOiBrZWJhYkNhc2VLZXlzKGpvYi5kZWZhdWx0cyksXG4gICAgICAnaWYnOiBqb2IuaWYsXG4gICAgICAnc3RlcHMnOiBzdGVwcy5tYXAocmVuZGVyU3RlcCksXG4gICAgICAndGltZW91dC1taW51dGVzJzogam9iLnRpbWVvdXRNaW51dGVzLFxuICAgICAgJ3N0cmF0ZWd5JzogcmVuZGVySm9iU3RyYXRlZ3koam9iLnN0cmF0ZWd5KSxcbiAgICAgICdjb250aW51ZS1vbi1lcnJvcic6IGpvYi5jb250aW51ZU9uRXJyb3IsXG4gICAgICAnY29udGFpbmVyJzogam9iLmNvbnRhaW5lcixcbiAgICAgICdzZXJ2aWNlcyc6IGpvYi5zZXJ2aWNlcyxcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gcmVuZGVySm9iT3V0cHV0cyhvdXRwdXQ6IHdvcmtmbG93cy5Kb2JbJ291dHB1dHMnXSkge1xuICAgIGlmIChvdXRwdXQgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBjb25zdCByZW5kZXJlZDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICAgIGZvciAoY29uc3QgW25hbWUsIHsgc3RlcElkLCBvdXRwdXROYW1lIH1dIG9mIE9iamVjdC5lbnRyaWVzKG91dHB1dCkpIHtcbiAgICAgIHJlbmRlcmVkW25hbWVdID0gYFxcJHt7IHN0ZXBzLiR7c3RlcElkfS5vdXRwdXRzLiR7b3V0cHV0TmFtZX0gfX1gO1xuICAgIH1cbiAgICByZXR1cm4gcmVuZGVyZWQ7XG4gIH1cblxuICBmdW5jdGlvbiByZW5kZXJKb2JTdHJhdGVneShzdHJhdGVneTogd29ya2Zsb3dzLkpvYlsnc3RyYXRlZ3knXSkge1xuICAgIGlmIChzdHJhdGVneSA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGNvbnN0IHJlbmRlcmVkOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAgICdtYXgtcGFyYWxsZWwnOiBzdHJhdGVneS5tYXhQYXJhbGxlbCxcbiAgICAgICdmYWlsLWZhc3QnOiBzdHJhdGVneS5mYWlsRmFzdCxcbiAgICB9O1xuXG4gICAgaWYgKHN0cmF0ZWd5Lm1hdHJpeCkge1xuICAgICAgY29uc3QgbWF0cml4OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAgICAgaW5jbHVkZTogc3RyYXRlZ3kubWF0cml4LmluY2x1ZGUsXG4gICAgICAgIGV4Y2x1ZGU6IHN0cmF0ZWd5Lm1hdHJpeC5leGNsdWRlLFxuICAgICAgfTtcbiAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVzXSBvZiBPYmplY3QuZW50cmllcyhcbiAgICAgICAgc3RyYXRlZ3kubWF0cml4LmRvbWFpbiA/PyB7fSxcbiAgICAgICkpIHtcbiAgICAgICAgaWYgKGtleSBpbiBtYXRyaXgpIHtcbiAgICAgICAgICAvLyBBIGRvbWFpbiBrZXkgd2FzIHNldCB0byBgaW5jbHVkZWAsIG9yIGBleGNsdWRlYDpcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYElsbGVnYWwgam9iIHN0cmF0ZWd5IG1hdHJpeCBrZXk6ICR7a2V5fWApO1xuICAgICAgICB9XG4gICAgICAgIG1hdHJpeFtrZXldID0gdmFsdWVzO1xuICAgICAgfVxuICAgICAgcmVuZGVyZWQubWF0cml4ID0gbWF0cml4O1xuICAgIH1cblxuICAgIHJldHVybiByZW5kZXJlZDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbmRlclN0ZXAoc3RlcDogd29ya2Zsb3dzLkpvYlN0ZXApIHtcbiAgICByZXR1cm4ge1xuICAgICAgJ25hbWUnOiBzdGVwLm5hbWUsXG4gICAgICAnaWQnOiBzdGVwLmlkLFxuICAgICAgJ2lmJzogc3RlcC5pZixcbiAgICAgICd1c2VzJzogc3RlcC51c2VzICYmIGFjdGlvbnMuZ2V0KHN0ZXAudXNlcyksXG4gICAgICAnZW52Jzogc3RlcC5lbnYsXG4gICAgICAncnVuJzogc3RlcC5ydW4sXG4gICAgICAnd2l0aCc6IHN0ZXAud2l0aCxcbiAgICAgICdjb250aW51ZS1vbi1lcnJvcic6IHN0ZXAuY29udGludWVPbkVycm9yLFxuICAgICAgJ3RpbWVvdXQtbWludXRlcyc6IHN0ZXAudGltZW91dE1pbnV0ZXMsXG4gICAgICAnd29ya2luZy1kaXJlY3RvcnknOiBzdGVwLndvcmtpbmdEaXJlY3RvcnksXG4gICAgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhcnJheU9yU2NhbGFyPFQ+KGFycjogVFtdIHwgdW5kZWZpbmVkKTogVCB8IFRbXSB8IHVuZGVmaW5lZCB7XG4gIGlmIChhcnIgPT0gbnVsbCB8fCBhcnIubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGFycjtcbiAgfVxuICBpZiAoYXJyLmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBhcnJbMF07XG4gIH1cbiAgcmV0dXJuIGFycjtcbn1cblxuZnVuY3Rpb24gc2V0dXBUb29scyh0b29sczogd29ya2Zsb3dzLlRvb2xzKSB7XG4gIGNvbnN0IHN0ZXBzOiB3b3JrZmxvd3MuSm9iU3RlcFtdID0gW107XG5cbiAgaWYgKHRvb2xzLmphdmEpIHtcbiAgICBzdGVwcy5wdXNoKHtcbiAgICAgIHVzZXM6ICdhY3Rpb25zL3NldHVwLWphdmFAdjMnLFxuICAgICAgd2l0aDogeyAnZGlzdHJpYnV0aW9uJzogJ3RlbXVyaW4nLCAnamF2YS12ZXJzaW9uJzogdG9vbHMuamF2YS52ZXJzaW9uIH0sXG4gICAgfSk7XG4gIH1cblxuICBpZiAodG9vbHMubm9kZSkge1xuICAgIHN0ZXBzLnB1c2goe1xuICAgICAgdXNlczogJ2FjdGlvbnMvc2V0dXAtbm9kZUB2MycsXG4gICAgICB3aXRoOiB7ICdub2RlLXZlcnNpb24nOiB0b29scy5ub2RlLnZlcnNpb24gfSxcbiAgICB9KTtcbiAgfVxuXG4gIGlmICh0b29scy5weXRob24pIHtcbiAgICBzdGVwcy5wdXNoKHtcbiAgICAgIHVzZXM6ICdhY3Rpb25zL3NldHVwLXB5dGhvbkB2NCcsXG4gICAgICB3aXRoOiB7ICdweXRob24tdmVyc2lvbic6IHRvb2xzLnB5dGhvbi52ZXJzaW9uIH0sXG4gICAgfSk7XG4gIH1cblxuICBpZiAodG9vbHMuZ28pIHtcbiAgICBzdGVwcy5wdXNoKHtcbiAgICAgIHVzZXM6ICdhY3Rpb25zL3NldHVwLWdvQHYzJyxcbiAgICAgIHdpdGg6IHsgJ2dvLXZlcnNpb24nOiB0b29scy5nby52ZXJzaW9uIH0sXG4gICAgfSk7XG4gIH1cblxuICBpZiAodG9vbHMuZG90bmV0KSB7XG4gICAgc3RlcHMucHVzaCh7XG4gICAgICB1c2VzOiAnYWN0aW9ucy9zZXR1cC1kb3RuZXRAdjMnLFxuICAgICAgd2l0aDogeyAnZG90bmV0LXZlcnNpb24nOiB0b29scy5kb3RuZXQudmVyc2lvbiB9LFxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHN0ZXBzO1xufVxuXG5mdW5jdGlvbiB2ZXJpZnlKb2JDb25zdHJhaW50cyhcbiAgam9iczogUmVjb3JkPHN0cmluZywgd29ya2Zsb3dzLkpvYiB8IHdvcmtmbG93cy5Kb2JDYWxsaW5nUmV1c2FibGVXb3JrZmxvdz4sXG4pIHtcbiAgLy8gdmVyaWZ5IHRoYXQgam9iIGhhcyBhIFwicGVybWlzc2lvbnNcIiBzdGF0ZW1lbnQgdG8gZW5zdXJlIHdvcmtmbG93IGNhblxuICAvLyBvcGVyYXRlIGluIHJlcG9zIHdpdGggZGVmYXVsdCB0b2tlbnMgc2V0IHRvIHJlYWRvbmx5XG4gIGZvciAoY29uc3QgW2lkLCBqb2JdIG9mIE9iamVjdC5lbnRyaWVzKGpvYnMpKSB7XG4gICAgaWYgKCFqb2IucGVybWlzc2lvbnMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYCR7aWR9OiBhbGwgd29ya2Zsb3cgam9icyBtdXN0IGhhdmUgYSBcInBlcm1pc3Npb25zXCIgY2xhdXNlIHRvIGVuc3VyZSB3b3JrZmxvdyBjYW4gb3BlcmF0ZSBpbiByZXN0cmljdGVkIHJlcG9zaXRvcmllc2AsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8vIHZlcmlmeSB0aGF0IGpvYiBoYXMgYSBcInJ1bnNPblwiIHN0YXRlbWVudCB0byBlbnN1cmUgYSB3b3JrZXIgY2FuIGJlIHNlbGVjdGVkIGFwcHJvcHJpYXRlbHlcbiAgZm9yIChjb25zdCBbaWQsIGpvYl0gb2YgT2JqZWN0LmVudHJpZXMoam9icykpIHtcbiAgICBpZiAoISgndXNlcycgaW4gam9iKSkge1xuICAgICAgaWYgKCdydW5zT24nIGluIGpvYiAmJiBqb2IucnVuc09uLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYCR7aWR9OiBhdCBsZWFzdCBvbmUgcnVubmVyIHNlbGVjdG9yIGxhYmVscyBtdXN0IGJlIHByb3ZpZGVkIGluIFwicnVuc09uXCIgdG8gZW5zdXJlIGEgcnVubmVyIGluc3RhbmNlIGNhbiBiZSBzZWxlY3RlZGAsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICB9XG59Il19