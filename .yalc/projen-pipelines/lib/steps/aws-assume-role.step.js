"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsAssumeRoleStep = void 0;
const JSII_RTTI_SYMBOL_1 = Symbol.for("jsii.rtti");
const workflows_model_1 = require("projen/lib/github/workflows-model");
const step_1 = require("./step");
/**
 * A step that assumes a role in AWS
 */
class AwsAssumeRoleStep extends step_1.PipelineStep {
    constructor(project, config) {
        super(project);
        this.config = config;
    }
    toGitlab() {
        return {
            env: {
                ...this.config.region ? { AWS_REGION: this.config.region } : {},
            },
            commands: [
                `awslogin ${this.config.roleArn} ${this.config.sessionName ?? ''}`,
            ],
            extensions: [],
            needs: [],
        };
    }
    toGithub() {
        return {
            steps: [{
                    name: 'AWS Credentials',
                    uses: 'aws-actions/configure-aws-credentials@v4',
                    with: {
                        'role-to-assume': this.config.roleArn,
                        'role-session-name': this.config.sessionName ?? 'GitHubAction',
                        ...this.config.region ? { 'aws-region': this.config.region } : { 'aws-region': 'us-east-1' },
                    },
                }],
            needs: [],
            env: {},
            permissions: {
                idToken: workflows_model_1.JobPermission.WRITE,
            },
        };
    }
}
exports.AwsAssumeRoleStep = AwsAssumeRoleStep;
_a = JSII_RTTI_SYMBOL_1;
AwsAssumeRoleStep[_a] = { fqn: "projen-pipelines.AwsAssumeRoleStep", version: "0.0.0" };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXdzLWFzc3VtZS1yb2xlLnN0ZXAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc3RlcHMvYXdzLWFzc3VtZS1yb2xlLnN0ZXAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFDQSx1RUFBa0U7QUFDbEUsaUNBQTBFO0FBZTFFOztHQUVHO0FBQ0gsTUFBYSxpQkFBa0IsU0FBUSxtQkFBWTtJQUVqRCxZQUFZLE9BQWdCLEVBQW1CLE1BQStCO1FBQzVFLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUQ4QixXQUFNLEdBQU4sTUFBTSxDQUF5QjtJQUU5RSxDQUFDO0lBRU0sUUFBUTtRQUNiLE9BQU87WUFDTCxHQUFHLEVBQUU7Z0JBQ0gsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxVQUFVLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRTthQUNoRTtZQUNELFFBQVEsRUFBRTtnQkFDUixZQUFZLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxJQUFJLEVBQUUsRUFBRTthQUNuRTtZQUNELFVBQVUsRUFBRSxFQUFFO1lBQ2QsS0FBSyxFQUFFLEVBQUU7U0FDVixDQUFDO0lBQ0osQ0FBQztJQUVNLFFBQVE7UUFDYixPQUFPO1lBQ0wsS0FBSyxFQUFFLENBQUM7b0JBQ04sSUFBSSxFQUFFLGlCQUFpQjtvQkFDdkIsSUFBSSxFQUFFLDBDQUEwQztvQkFDaEQsSUFBSSxFQUFFO3dCQUNKLGdCQUFnQixFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTzt3QkFDckMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLElBQUksY0FBYzt3QkFDOUQsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxZQUFZLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFO3FCQUM3RjtpQkFDRixDQUFDO1lBQ0YsS0FBSyxFQUFFLEVBQUU7WUFDVCxHQUFHLEVBQUUsRUFBRTtZQUNQLFdBQVcsRUFBRTtnQkFDWCxPQUFPLEVBQUUsK0JBQWEsQ0FBQyxLQUFLO2FBQzdCO1NBQ0YsQ0FBQztJQUNKLENBQUM7O0FBcENILDhDQXNDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFByb2plY3QgfSBmcm9tICdwcm9qZW4nO1xuaW1wb3J0IHsgSm9iUGVybWlzc2lvbiB9IGZyb20gJ3Byb2plbi9saWIvZ2l0aHViL3dvcmtmbG93cy1tb2RlbCc7XG5pbXBvcnQgeyBHaXRodWJTdGVwQ29uZmlnLCBHaXRsYWJTdGVwQ29uZmlnLCBQaXBlbGluZVN0ZXAgfSBmcm9tICcuL3N0ZXAnO1xuXG5cbi8qKlxuICogQ29uZmlndXJhdGlvbiBmb3IgYW4gQVdTIEFzc3VtZVJvbGVTdGVwXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQXdzQXNzdW1lUm9sZVN0ZXBDb25maWcge1xuICAvKiogVGhlIEFSTiBvZiB0aGUgcm9sZSB0byBhc3N1bWUgKi9cbiAgcmVhZG9ubHkgcm9sZUFybjogc3RyaW5nO1xuICAvKiogQW4gaWRlbnRpZmllciBmb3IgdGhlIGFzc3VtZWQgcm9sZSBzZXNzaW9uICovXG4gIHJlYWRvbmx5IHNlc3Npb25OYW1lPzogc3RyaW5nO1xuICAvKiogVGhlIEFXUyByZWdpb24gdGhhdCBzaG91bGQgYmUgc2V0ICovXG4gIHJlYWRvbmx5IHJlZ2lvbj86IHN0cmluZztcbn1cblxuLyoqXG4gKiBBIHN0ZXAgdGhhdCBhc3N1bWVzIGEgcm9sZSBpbiBBV1NcbiAqL1xuZXhwb3J0IGNsYXNzIEF3c0Fzc3VtZVJvbGVTdGVwIGV4dGVuZHMgUGlwZWxpbmVTdGVwIHtcblxuICBjb25zdHJ1Y3Rvcihwcm9qZWN0OiBQcm9qZWN0LCBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZzogQXdzQXNzdW1lUm9sZVN0ZXBDb25maWcpIHtcbiAgICBzdXBlcihwcm9qZWN0KTtcbiAgfVxuXG4gIHB1YmxpYyB0b0dpdGxhYigpOiBHaXRsYWJTdGVwQ29uZmlnIHtcbiAgICByZXR1cm4ge1xuICAgICAgZW52OiB7XG4gICAgICAgIC4uLnRoaXMuY29uZmlnLnJlZ2lvbiA/IHsgQVdTX1JFR0lPTjogdGhpcy5jb25maWcucmVnaW9uIH0gOiB7fSxcbiAgICAgIH0sXG4gICAgICBjb21tYW5kczogW1xuICAgICAgICBgYXdzbG9naW4gJHt0aGlzLmNvbmZpZy5yb2xlQXJufSAke3RoaXMuY29uZmlnLnNlc3Npb25OYW1lID8/ICcnfWAsXG4gICAgICBdLFxuICAgICAgZXh0ZW5zaW9uczogW10sXG4gICAgICBuZWVkczogW10sXG4gICAgfTtcbiAgfVxuXG4gIHB1YmxpYyB0b0dpdGh1YigpOiBHaXRodWJTdGVwQ29uZmlnIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3RlcHM6IFt7XG4gICAgICAgIG5hbWU6ICdBV1MgQ3JlZGVudGlhbHMnLFxuICAgICAgICB1c2VzOiAnYXdzLWFjdGlvbnMvY29uZmlndXJlLWF3cy1jcmVkZW50aWFsc0B2NCcsXG4gICAgICAgIHdpdGg6IHtcbiAgICAgICAgICAncm9sZS10by1hc3N1bWUnOiB0aGlzLmNvbmZpZy5yb2xlQXJuLFxuICAgICAgICAgICdyb2xlLXNlc3Npb24tbmFtZSc6IHRoaXMuY29uZmlnLnNlc3Npb25OYW1lID8/ICdHaXRIdWJBY3Rpb24nLFxuICAgICAgICAgIC4uLnRoaXMuY29uZmlnLnJlZ2lvbiA/IHsgJ2F3cy1yZWdpb24nOiB0aGlzLmNvbmZpZy5yZWdpb24gfSA6IHsgJ2F3cy1yZWdpb24nOiAndXMtZWFzdC0xJyB9LFxuICAgICAgICB9LFxuICAgICAgfV0sXG4gICAgICBuZWVkczogW10sXG4gICAgICBlbnY6IHt9LFxuICAgICAgcGVybWlzc2lvbnM6IHtcbiAgICAgICAgaWRUb2tlbjogSm9iUGVybWlzc2lvbi5XUklURSxcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG59Il19