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
                    uses: 'actions/upload-artifact@v4',
                    with: {
                        name: this.config.name,
                        path: this.config.path,
                    },
                }],
            needs: [],
            env: {},
        };
    }
}
exports.UploadArtifactStep = UploadArtifactStep;
_b = JSII_RTTI_SYMBOL_1;
UploadArtifactStep[_b] = { fqn: "projen-pipelines.UploadArtifactStep", version: "0.0.0" };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJ0aWZhY3Qtc3RlcHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc3RlcHMvYXJ0aWZhY3Qtc3RlcHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFDQSxpQ0FBMEU7QUFPMUUsTUFBYSxvQkFBcUIsU0FBUSxtQkFBWTtJQUVwRCxZQUFZLE9BQWdCLEVBQW1CLE1BQWtDO1FBQy9FLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUQ4QixXQUFNLEdBQU4sTUFBTSxDQUE0QjtJQUVqRixDQUFDO0lBRU0sUUFBUTtRQUNiLHdEQUF3RDtRQUN4RCxPQUFPO1lBQ0wsR0FBRyxFQUFFLEVBQUU7WUFDUCxVQUFVLEVBQUUsRUFBRTtZQUNkLEtBQUssRUFBRSxFQUFFO1lBQ1QsUUFBUSxFQUFFLEVBQUU7U0FDYixDQUFDO0lBQ0osQ0FBQztJQUNNLFFBQVE7UUFDYixPQUFPO1lBQ0wsS0FBSyxFQUFFLENBQUM7b0JBQ04sSUFBSSxFQUFFLG1CQUFtQjtvQkFDekIsSUFBSSxFQUFFLDhCQUE4QjtvQkFDcEMsSUFBSSxFQUFFO3dCQUNKLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUk7d0JBQ3RCLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUk7cUJBQ3ZCO2lCQUNGLENBQUM7WUFDRixLQUFLLEVBQUUsRUFBRTtZQUNULEdBQUcsRUFBRSxFQUFFO1NBQ1IsQ0FBQztJQUNKLENBQUM7O0FBNUJILG9EQTZCQzs7O0FBUUQsTUFBYSxrQkFBbUIsU0FBUSxtQkFBWTtJQUVsRCxZQUFZLE9BQWdCLEVBQW1CLE1BQWdDO1FBQzdFLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUQ4QixXQUFNLEdBQU4sTUFBTSxDQUEwQjtJQUUvRSxDQUFDO0lBRU0sUUFBUTtRQUNiLE9BQU87WUFDTCxLQUFLLEVBQUUsQ0FBQztvQkFDTixJQUFJLEVBQUUsaUJBQWlCO29CQUN2QixJQUFJLEVBQUUsNEJBQTRCO29CQUNsQyxJQUFJLEVBQUU7d0JBQ0osSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSTt3QkFDdEIsSUFBSSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSTtxQkFDdkI7aUJBQ0YsQ0FBQztZQUNGLEtBQUssRUFBRSxFQUFFO1lBQ1QsR0FBRyxFQUFFLEVBQUU7U0FDUixDQUFDO0lBQ0osQ0FBQzs7QUFuQkgsZ0RBcUJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUHJvamVjdCB9IGZyb20gJ3Byb2plbic7XG5pbXBvcnQgeyBHaXRodWJTdGVwQ29uZmlnLCBHaXRsYWJTdGVwQ29uZmlnLCBQaXBlbGluZVN0ZXAgfSBmcm9tICcuL3N0ZXAnO1xuXG5leHBvcnQgaW50ZXJmYWNlIERvd25sb2FkQXJ0aWZhY3RTdGVwQ29uZmlnIHtcbiAgcmVhZG9ubHkgbmFtZTogc3RyaW5nO1xuICByZWFkb25seSBwYXRoOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBEb3dubG9hZEFydGlmYWN0U3RlcCBleHRlbmRzIFBpcGVsaW5lU3RlcCB7XG5cbiAgY29uc3RydWN0b3IocHJvamVjdDogUHJvamVjdCwgcHJpdmF0ZSByZWFkb25seSBjb25maWc6IERvd25sb2FkQXJ0aWZhY3RTdGVwQ29uZmlnKSB7XG4gICAgc3VwZXIocHJvamVjdCk7XG4gIH1cblxuICBwdWJsaWMgdG9HaXRsYWIoKTogR2l0bGFiU3RlcENvbmZpZyB7XG4gICAgLy8gTm90aGluZyB0byBkbzsgYXJ0aWZhY3QgaXMgYWxyZWFkeSBkb3dubG9hZGVkIGZvciB5b3VcbiAgICByZXR1cm4ge1xuICAgICAgZW52OiB7fSxcbiAgICAgIGV4dGVuc2lvbnM6IFtdLFxuICAgICAgbmVlZHM6IFtdLFxuICAgICAgY29tbWFuZHM6IFtdLFxuICAgIH07XG4gIH1cbiAgcHVibGljIHRvR2l0aHViKCk6IEdpdGh1YlN0ZXBDb25maWcge1xuICAgIHJldHVybiB7XG4gICAgICBzdGVwczogW3tcbiAgICAgICAgbmFtZTogJ0Rvd25sb2FkIEFydGlmYWN0JyxcbiAgICAgICAgdXNlczogJ2FjdGlvbnMvZG93bmxvYWQtYXJ0aWZhY3RAdjQnLFxuICAgICAgICB3aXRoOiB7XG4gICAgICAgICAgbmFtZTogdGhpcy5jb25maWcubmFtZSxcbiAgICAgICAgICBwYXRoOiB0aGlzLmNvbmZpZy5wYXRoLFxuICAgICAgICB9LFxuICAgICAgfV0sXG4gICAgICBuZWVkczogW10sXG4gICAgICBlbnY6IHt9LFxuICAgIH07XG4gIH1cbn1cblxuXG5leHBvcnQgaW50ZXJmYWNlIFVwbG9hZEFydGlmYWN0U3RlcENvbmZpZyB7XG4gIHJlYWRvbmx5IG5hbWU6IHN0cmluZztcbiAgcmVhZG9ubHkgcGF0aDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgVXBsb2FkQXJ0aWZhY3RTdGVwIGV4dGVuZHMgUGlwZWxpbmVTdGVwIHtcblxuICBjb25zdHJ1Y3Rvcihwcm9qZWN0OiBQcm9qZWN0LCBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZzogVXBsb2FkQXJ0aWZhY3RTdGVwQ29uZmlnKSB7XG4gICAgc3VwZXIocHJvamVjdCk7XG4gIH1cblxuICBwdWJsaWMgdG9HaXRodWIoKTogR2l0aHViU3RlcENvbmZpZyB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN0ZXBzOiBbe1xuICAgICAgICBuYW1lOiAnVXBsb2FkIEFydGlmYWN0JyxcbiAgICAgICAgdXNlczogJ2FjdGlvbnMvdXBsb2FkLWFydGlmYWN0QHY0JyxcbiAgICAgICAgd2l0aDoge1xuICAgICAgICAgIG5hbWU6IHRoaXMuY29uZmlnLm5hbWUsXG4gICAgICAgICAgcGF0aDogdGhpcy5jb25maWcucGF0aCxcbiAgICAgICAgfSxcbiAgICAgIH1dLFxuICAgICAgbmVlZHM6IFtdLFxuICAgICAgZW52OiB7fSxcbiAgICB9O1xuICB9XG5cbn0iXX0=