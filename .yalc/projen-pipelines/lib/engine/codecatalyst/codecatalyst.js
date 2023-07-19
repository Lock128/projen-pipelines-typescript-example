"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeCatalyst = void 0;
const actions_provider_1 = require("projen/lib/github/actions-provider");
const workflow_1 = require("./workflow");
class CodeCatalyst {
    // constructor(project: Project, options: CodeCatalystProps = {}) {
    constructor(project) {
        this.workflowsEnabled = true;
        this.project = project;
        this.actions = new actions_provider_1.GitHubActionsProvider();
    }
    addWorkflow(workflowName) {
        return new workflow_1.CodeCatalystWorkflow(this, workflowName);
    }
}
exports.CodeCatalyst = CodeCatalyst;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29kZWNhdGFseXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2VuZ2luZS9jb2RlY2F0YWx5c3QvY29kZWNhdGFseXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlFQUEyRTtBQUUzRSx5Q0FBa0Q7QUFFbEQsTUFBYSxZQUFZO0lBT3ZCLG1FQUFtRTtJQUNuRSxZQUFZLE9BQWdCO1FBSDVCLHFCQUFnQixHQUF3QixJQUFJLENBQUM7UUFJM0MsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFDdkIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLHdDQUFxQixFQUFFLENBQUM7SUFDN0MsQ0FBQztJQUVELFdBQVcsQ0FBQyxZQUFvQjtRQUM5QixPQUFPLElBQUksK0JBQW9CLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQ3RELENBQUM7Q0FDRjtBQWhCRCxvQ0FnQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBHaXRIdWJBY3Rpb25zUHJvdmlkZXIgfSBmcm9tICdwcm9qZW4vbGliL2dpdGh1Yi9hY3Rpb25zLXByb3ZpZGVyJztcbmltcG9ydCB7IFByb2plY3QgfSBmcm9tICdwcm9qZW4vbGliL3Byb2plY3QnO1xuaW1wb3J0IHsgQ29kZUNhdGFseXN0V29ya2Zsb3cgfSBmcm9tICcuL3dvcmtmbG93JztcblxuZXhwb3J0IGNsYXNzIENvZGVDYXRhbHlzdCB7XG5cbiAgcHJvamVjdDogUHJvamVjdDtcbiAgcHJvamVuQ3JlZGVudGlhbHM6IGFueTtcbiAgYWN0aW9uczogYW55O1xuICB3b3JrZmxvd3NFbmFibGVkOiBib29sZWFuIHwgdW5kZWZpbmVkID0gdHJ1ZTtcblxuICAvLyBjb25zdHJ1Y3Rvcihwcm9qZWN0OiBQcm9qZWN0LCBvcHRpb25zOiBDb2RlQ2F0YWx5c3RQcm9wcyA9IHt9KSB7XG4gIGNvbnN0cnVjdG9yKHByb2plY3Q6IFByb2plY3QpIHtcbiAgICB0aGlzLnByb2plY3QgPSBwcm9qZWN0O1xuICAgIHRoaXMuYWN0aW9ucyA9IG5ldyBHaXRIdWJBY3Rpb25zUHJvdmlkZXIoKTtcbiAgfVxuXG4gIGFkZFdvcmtmbG93KHdvcmtmbG93TmFtZTogc3RyaW5nKTogQ29kZUNhdGFseXN0V29ya2Zsb3cge1xuICAgIHJldHVybiBuZXcgQ29kZUNhdGFseXN0V29ya2Zsb3codGhpcywgd29ya2Zsb3dOYW1lKTtcbiAgfVxufSJdfQ==