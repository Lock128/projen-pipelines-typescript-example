import { Project } from 'projen/lib/project';
import { CodeCatalystWorkflow } from './workflow';
export declare class CodeCatalyst {
    project: Project;
    projenCredentials: any;
    actions: any;
    workflowsEnabled: boolean | undefined;
    addWorkflow(workflowName: string): CodeCatalystWorkflow;
}
