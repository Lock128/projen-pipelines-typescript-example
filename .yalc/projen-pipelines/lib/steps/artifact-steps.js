"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadArtifactStep = exports.DownloadArtifactStep = void 0;
const JSII_RTTI_SYMBOL_1 = Symbol.for("jsii.rtti");
const step_1 = require("./step");
class DownloadArtifactStep extends step_1.PipelineStep {
    constructor(project, config) {
        super(project);
        this.config = config;
    }
    toGitlab() {
        // Nothing to do; artifact is already downloaded for you
        return {
            env: {},
            extensions: [],
            needs: [],
            commands: [],
        };
    }
    toGithub() {
        return {
            steps: [{
                    name: 'Download Artifact',
                    uses: 'actions/download-artifact@v4',
                    with: {
                        name: this.config.name,
                        path: this.config.path,
                    },
                }],
            needs: [],
            env: {},
        };
    }
    /**
     * Converts the step into a CodeCatalyst Actions step configuration.
     */
    toCodeCatalyst() {
        return {
            needs: [], // No dependencies.
            commands: [], // Maps each command into a CodeCatalyst Action job step.
            env: {}, // No environment variables.
        };
    }
}
exports.DownloadArtifactStep = DownloadArtifactStep;
_a = JSII_RTTI_SYMBOL_1;
DownloadArtifactStep[_a] = { fqn: "projen-pipelines.DownloadArtifactStep", version: "0.0.0" };
class UploadArtifactStep extends step_1.PipelineStep {
    constructor(project, config) {
        super(project);
        this.config = config;
    }
    toGithub() {
        return {
            steps: [{
                    name: 'Upload Artifact',
                    uses: 'actions/upload-artifact@v4.3.6',
                    with: {
                        name: this.config.name,
                        path: this.config.path,
                    },
                }],
            needs: [],
            env: {},
        };
    }
    /**
     * Converts the step into a CodeCatalyst Actions step configuration.
     */
    toCodeCatalyst() {
        return {
            needs: [], // No dependencies.
            commands: [], // Maps each command into a CodeCatalyst Action job step.
            env: {}, // No environment variables.
        };
    }
}
exports.UploadArtifactStep = UploadArtifactStep;
_b = JSII_RTTI_SYMBOL_1;
UploadArtifactStep[_b] = { fqn: "projen-pipelines.UploadArtifactStep", version: "0.0.0" };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJ0aWZhY3Qtc3RlcHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc3RlcHMvYXJ0aWZhY3Qtc3RlcHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFDQSxpQ0FBa0c7QUFPbEcsTUFBYSxvQkFBcUIsU0FBUSxtQkFBWTtJQUVwRCxZQUFZLE9BQWdCLEVBQW1CLE1BQWtDO1FBQy9FLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUQ4QixXQUFNLEdBQU4sTUFBTSxDQUE0QjtJQUVqRixDQUFDO0lBRU0sUUFBUTtRQUNiLHdEQUF3RDtRQUN4RCxPQUFPO1lBQ0wsR0FBRyxFQUFFLEVBQUU7WUFDUCxVQUFVLEVBQUUsRUFBRTtZQUNkLEtBQUssRUFBRSxFQUFFO1lBQ1QsUUFBUSxFQUFFLEVBQUU7U0FDYixDQUFDO0lBQ0osQ0FBQztJQUNNLFFBQVE7UUFDYixPQUFPO1lBQ0wsS0FBSyxFQUFFLENBQUM7b0JBQ04sSUFBSSxFQUFFLG1CQUFtQjtvQkFDekIsSUFBSSxFQUFFLDhCQUE4QjtvQkFDcEMsSUFBSSxFQUFFO3dCQUNKLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUk7d0JBQ3RCLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUk7cUJBQ3ZCO2lCQUNGLENBQUM7WUFDRixLQUFLLEVBQUUsRUFBRTtZQUNULEdBQUcsRUFBRSxFQUFFO1NBQ1IsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNJLGNBQWM7UUFDbkIsT0FBTztZQUNMLEtBQUssRUFBRSxFQUFFLEVBQUUsbUJBQW1CO1lBQzlCLFFBQVEsRUFBRSxFQUFFLEVBQUUseURBQXlEO1lBQ3ZFLEdBQUcsRUFBRSxFQUFFLEVBQUUsNEJBQTRCO1NBQ3RDLENBQUM7SUFDSixDQUFDOztBQXZDSCxvREF3Q0M7OztBQVFELE1BQWEsa0JBQW1CLFNBQVEsbUJBQVk7SUFFbEQsWUFBWSxPQUFnQixFQUFtQixNQUFnQztRQUM3RSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFEOEIsV0FBTSxHQUFOLE1BQU0sQ0FBMEI7SUFFL0UsQ0FBQztJQUVNLFFBQVE7UUFDYixPQUFPO1lBQ0wsS0FBSyxFQUFFLENBQUM7b0JBQ04sSUFBSSxFQUFFLGlCQUFpQjtvQkFDdkIsSUFBSSxFQUFFLGdDQUFnQztvQkFDdEMsSUFBSSxFQUFFO3dCQUNKLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUk7d0JBQ3RCLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUk7cUJBQ3ZCO2lCQUNGLENBQUM7WUFDRixLQUFLLEVBQUUsRUFBRTtZQUNULEdBQUcsRUFBRSxFQUFFO1NBQ1IsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNJLGNBQWM7UUFDbkIsT0FBTztZQUNMLEtBQUssRUFBRSxFQUFFLEVBQUUsbUJBQW1CO1lBQzlCLFFBQVEsRUFBRSxFQUFFLEVBQUUseURBQXlEO1lBQ3ZFLEdBQUcsRUFBRSxFQUFFLEVBQUUsNEJBQTRCO1NBQ3RDLENBQUM7SUFDSixDQUFDOztBQTlCSCxnREFnQ0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBQcm9qZWN0IH0gZnJvbSAncHJvamVuJztcbmltcG9ydCB7IENvZGVDYXRhbHlzdFN0ZXBDb25maWcsIEdpdGh1YlN0ZXBDb25maWcsIEdpdGxhYlN0ZXBDb25maWcsIFBpcGVsaW5lU3RlcCB9IGZyb20gJy4vc3RlcCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRG93bmxvYWRBcnRpZmFjdFN0ZXBDb25maWcge1xuICByZWFkb25seSBuYW1lOiBzdHJpbmc7XG4gIHJlYWRvbmx5IHBhdGg6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIERvd25sb2FkQXJ0aWZhY3RTdGVwIGV4dGVuZHMgUGlwZWxpbmVTdGVwIHtcblxuICBjb25zdHJ1Y3Rvcihwcm9qZWN0OiBQcm9qZWN0LCBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZzogRG93bmxvYWRBcnRpZmFjdFN0ZXBDb25maWcpIHtcbiAgICBzdXBlcihwcm9qZWN0KTtcbiAgfVxuXG4gIHB1YmxpYyB0b0dpdGxhYigpOiBHaXRsYWJTdGVwQ29uZmlnIHtcbiAgICAvLyBOb3RoaW5nIHRvIGRvOyBhcnRpZmFjdCBpcyBhbHJlYWR5IGRvd25sb2FkZWQgZm9yIHlvdVxuICAgIHJldHVybiB7XG4gICAgICBlbnY6IHt9LFxuICAgICAgZXh0ZW5zaW9uczogW10sXG4gICAgICBuZWVkczogW10sXG4gICAgICBjb21tYW5kczogW10sXG4gICAgfTtcbiAgfVxuICBwdWJsaWMgdG9HaXRodWIoKTogR2l0aHViU3RlcENvbmZpZyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN0ZXBzOiBbe1xuICAgICAgICBuYW1lOiAnRG93bmxvYWQgQXJ0aWZhY3QnLFxuICAgICAgICB1c2VzOiAnYWN0aW9ucy9kb3dubG9hZC1hcnRpZmFjdEB2NCcsXG4gICAgICAgIHdpdGg6IHtcbiAgICAgICAgICBuYW1lOiB0aGlzLmNvbmZpZy5uYW1lLFxuICAgICAgICAgIHBhdGg6IHRoaXMuY29uZmlnLnBhdGgsXG4gICAgICAgIH0sXG4gICAgICB9XSxcbiAgICAgIG5lZWRzOiBbXSxcbiAgICAgIGVudjoge30sXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyB0aGUgc3RlcCBpbnRvIGEgQ29kZUNhdGFseXN0IEFjdGlvbnMgc3RlcCBjb25maWd1cmF0aW9uLlxuICAgKi9cbiAgcHVibGljIHRvQ29kZUNhdGFseXN0KCk6IENvZGVDYXRhbHlzdFN0ZXBDb25maWcge1xuICAgIHJldHVybiB7XG4gICAgICBuZWVkczogW10sIC8vIE5vIGRlcGVuZGVuY2llcy5cbiAgICAgIGNvbW1hbmRzOiBbXSwgLy8gTWFwcyBlYWNoIGNvbW1hbmQgaW50byBhIENvZGVDYXRhbHlzdCBBY3Rpb24gam9iIHN0ZXAuXG4gICAgICBlbnY6IHt9LCAvLyBObyBlbnZpcm9ubWVudCB2YXJpYWJsZXMuXG4gICAgfTtcbiAgfVxufVxuXG5cbmV4cG9ydCBpbnRlcmZhY2UgVXBsb2FkQXJ0aWZhY3RTdGVwQ29uZmlnIHtcbiAgcmVhZG9ubHkgbmFtZTogc3RyaW5nO1xuICByZWFkb25seSBwYXRoOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBVcGxvYWRBcnRpZmFjdFN0ZXAgZXh0ZW5kcyBQaXBlbGluZVN0ZXAge1xuXG4gIGNvbnN0cnVjdG9yKHByb2plY3Q6IFByb2plY3QsIHByaXZhdGUgcmVhZG9ubHkgY29uZmlnOiBVcGxvYWRBcnRpZmFjdFN0ZXBDb25maWcpIHtcbiAgICBzdXBlcihwcm9qZWN0KTtcbiAgfVxuXG4gIHB1YmxpYyB0b0dpdGh1YigpOiBHaXRodWJTdGVwQ29uZmlnIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3RlcHM6IFt7XG4gICAgICAgIG5hbWU6ICdVcGxvYWQgQXJ0aWZhY3QnLFxuICAgICAgICB1c2VzOiAnYWN0aW9ucy91cGxvYWQtYXJ0aWZhY3RAdjQuMy42JyxcbiAgICAgICAgd2l0aDoge1xuICAgICAgICAgIG5hbWU6IHRoaXMuY29uZmlnLm5hbWUsXG4gICAgICAgICAgcGF0aDogdGhpcy5jb25maWcucGF0aCxcbiAgICAgICAgfSxcbiAgICAgIH1dLFxuICAgICAgbmVlZHM6IFtdLFxuICAgICAgZW52OiB7fSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnRzIHRoZSBzdGVwIGludG8gYSBDb2RlQ2F0YWx5c3QgQWN0aW9ucyBzdGVwIGNvbmZpZ3VyYXRpb24uXG4gICAqL1xuICBwdWJsaWMgdG9Db2RlQ2F0YWx5c3QoKTogQ29kZUNhdGFseXN0U3RlcENvbmZpZyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG5lZWRzOiBbXSwgLy8gTm8gZGVwZW5kZW5jaWVzLlxuICAgICAgY29tbWFuZHM6IFtdLCAvLyBNYXBzIGVhY2ggY29tbWFuZCBpbnRvIGEgQ29kZUNhdGFseXN0IEFjdGlvbiBqb2Igc3RlcC5cbiAgICAgIGVudjoge30sIC8vIE5vIGVudmlyb25tZW50IHZhcmlhYmxlcy5cbiAgICB9O1xuICB9XG5cbn0iXX0=