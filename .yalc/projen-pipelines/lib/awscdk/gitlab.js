"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitlabCDKPipeline = void 0;
const JSII_RTTI_SYMBOL_1 = Symbol.for("jsii.rtti");
const projen_1 = require("projen");
const base_1 = require("./base");
class GitlabCDKPipeline extends base_1.CDKPipeline {
    constructor(app, options) {
        super(app, options);
        this.options = options;
        this.deploymentStages = [];
        // TODO use existing config if possible
        this.config = new projen_1.gitlab.GitlabConfiguration(app, {
            stages: [],
            jobs: {},
        });
        this.needsVersionedArtifacts = false; // options.publishedCloudAssemblies ?? false;
        this.jobImage = options.image ?? 'image: jsii/superchain:1-buster-slim-node18';
        this.setupSnippets();
        this.createSynth();
        this.createAssetUpload();
        for (const stage of options.stages) {
            this.createDeployment(stage);
        }
    }
    setupSnippets() {
        this.config.addJobs({
            '.artifacts_cdk': {
                artifacts: {
                    when: projen_1.gitlab.CacheWhen.ON_SUCCESS,
                    expireIn: '30 days',
                    name: 'CDK Assembly - $CI_JOB_NAME-$CI_COMMIT_REF_SLUG',
                    untracked: false,
                    paths: ['cdk.out'],
                },
            },
            '.aws_base': {
                image: { name: this.jobImage },
                idTokens: {
                    AWS_TOKEN: {
                        aud: 'https://sts.amazonaws.com',
                    },
                },
                variables: {
                    CI: 'true',
                },
                beforeScript: [
                    `check_variables_defined() {
  for var in "$@"; do
    if [ -z "$(eval "echo \\$$var")" ]; then
      log_fatal "\${var} not defined";
    fi
  done
}

awslogin() {
  roleArn=\${1: -\${AWS_ROLE_ARN}}
  check_variables_defined roleArn AWS_TOKEN
  export $(printf "AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s AWS_SESSION_TOKEN=%s" $(aws sts assume-role-with-web-identity --role-arn \${roleArn} --role-session-name "GitLabRunner-\${CI_PROJECT_ID}-\${CI_PIPELINE_ID}" --web-identity-token \${AWS_TOKEN} --duration-seconds 3600 --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' --output text))
  # TODO CODE ARTIFACT
}
`,
                ],
            },
        });
    }
    createSynth() {
        const script = ['echo "Running CDK synth"'];
        if (this.options.iamRoleArns?.synth) {
            script.push(`awslogin '${this.options.iamRoleArns.synth}'`);
        }
        script.push(...this.renderSynthCommands());
        this.config.addStages('synth');
        this.config.addJobs({
            synth: {
                extends: ['.aws_base', '.artifacts_cdk'],
                stage: 'synth',
                script,
            },
        });
    }
    createAssetUpload() {
        const script = ['echo "Publish assets to AWS"'];
        if (this.options.iamRoleArns?.assetPublishing) {
            script.push(`awslogin '${this.options.iamRoleArns.assetPublishing}'`);
        }
        script.push(...this.getAssetUploadCommands(this.needsVersionedArtifacts));
        this.config.addStages('publish_assets');
        this.config.addJobs({
            publish_assets: {
                extends: ['.aws_base'],
                stage: 'publish_assets',
                needs: [{ job: 'synth', artifacts: true }],
                script,
            },
        });
    }
    createDeployment(stage) {
        const script = [];
        script.push(`awslogin '${this.options.iamRoleArns?.deployment?.[stage.name] ?? this.options.iamRoleArns?.default}'`);
        script.push(...this.renderInstallCommands());
        this.config.addStages(stage.name);
        this.config.addJobs({
            [`diff-${stage.name}`]: {
                extends: ['.aws_base'],
                stage: stage.name,
                only: {
                    refs: ['main'],
                },
                needs: [
                    { job: 'synth', artifacts: true },
                    { job: 'publish_assets' },
                ],
                script: [
                    `awslogin '${this.options.iamRoleArns?.deployment?.[stage.name] ?? this.options.iamRoleArns?.default}'`,
                    ...this.renderInstallCommands(),
                    ...this.renderDiffCommands(stage.name),
                ],
            },
            [`deploy-${stage.name}`]: {
                extends: ['.aws_base'],
                stage: stage.name,
                ...stage.manualApproval && {
                    when: projen_1.gitlab.JobWhen.MANUAL,
                },
                only: {
                    refs: ['main'],
                },
                needs: [
                    { job: 'synth', artifacts: true },
                    { job: 'publish_assets' },
                    { job: `diff-${stage.name}` },
                ],
                script: [
                    `awslogin '${this.options.iamRoleArns?.deployment?.[stage.name] ?? this.options.iamRoleArns?.default}'`,
                    ...this.renderInstallCommands(),
                    ...this.renderDeployCommands(stage.name),
                ],
            },
        });
        this.deploymentStages.push(stage.name);
    }
}
exports.GitlabCDKPipeline = GitlabCDKPipeline;
_a = JSII_RTTI_SYMBOL_1;
GitlabCDKPipeline[_a] = { fqn: "projen-pipelines.GitlabCDKPipeline", version: "0.0.0" };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0bGFiLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2F3c2Nkay9naXRsYWIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxtQ0FBd0M7QUFDeEMsaUNBQTBFO0FBZTFFLE1BQWEsaUJBQWtCLFNBQVEsa0JBQVc7SUFRaEQsWUFBWSxHQUErQixFQUFVLE9BQWlDO1FBQ3BGLEtBQUssQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFEK0IsWUFBTyxHQUFQLE9BQU8sQ0FBMEI7UUFGOUUscUJBQWdCLEdBQWEsRUFBRSxDQUFDO1FBS3RDLHVDQUF1QztRQUN2QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksZUFBTSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsRUFBRTtZQUNoRCxNQUFNLEVBQUUsRUFBRTtZQUNWLElBQUksRUFBRSxFQUFFO1NBQ1QsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHVCQUF1QixHQUFHLEtBQUssQ0FBQyxDQUFDLDZDQUE2QztRQUNuRixJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxLQUFLLElBQUksNkNBQTZDLENBQUM7UUFFL0UsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBRXJCLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUVuQixJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUV6QixLQUFLLE1BQU0sS0FBSyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUU7WUFDbEMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQzlCO0lBQ0gsQ0FBQztJQUVTLGFBQWE7UUFDckIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7WUFDbEIsZ0JBQWdCLEVBQUU7Z0JBQ2hCLFNBQVMsRUFBRTtvQkFDVCxJQUFJLEVBQUUsZUFBTSxDQUFDLFNBQVMsQ0FBQyxVQUFVO29CQUNqQyxRQUFRLEVBQUUsU0FBUztvQkFDbkIsSUFBSSxFQUFFLGlEQUFp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QUMsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxPQUFPLEdBQUc7b0JBQ3ZHLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixFQUFFO29CQUMvQixHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO2lCQUN6QzthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDekMsQ0FBQzs7QUEzSkgsOENBNkpDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgYXdzY2RrLCBnaXRsYWIgfSBmcm9tICdwcm9qZW4nO1xuaW1wb3J0IHsgQ0RLUGlwZWxpbmUsIENES1BpcGVsaW5lT3B0aW9ucywgRGVwbG95bWVudFN0YWdlIH0gZnJvbSAnLi9iYXNlJztcblxuZXhwb3J0IGludGVyZmFjZSBHaXRsYWJJYW1Sb2xlQ29uZmlnIHtcbiAgcmVhZG9ubHkgZGVmYXVsdD86IHN0cmluZztcbiAgcmVhZG9ubHkgc3ludGg/OiBzdHJpbmc7XG4gIHJlYWRvbmx5IGFzc2V0UHVibGlzaGluZz86IHN0cmluZztcbiAgcmVhZG9ubHkgZGVwbG95bWVudD86IHsgW3N0YWdlOiBzdHJpbmddOiBzdHJpbmcgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBHaXRsYWJDREtQaXBlbGluZU9wdGlvbnMgZXh0ZW5kcyBDREtQaXBlbGluZU9wdGlvbnMge1xuICByZWFkb25seSBpYW1Sb2xlQXJuczogR2l0bGFiSWFtUm9sZUNvbmZpZztcbiAgLy8gcmVhZG9ubHkgcHVibGlzaGVkQ2xvdWRBc3NlbWJsaWVzPzogYm9vbGVhbjtcbiAgcmVhZG9ubHkgaW1hZ2U/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBHaXRsYWJDREtQaXBlbGluZSBleHRlbmRzIENES1BpcGVsaW5lIHtcblxuICBwdWJsaWMgcmVhZG9ubHkgbmVlZHNWZXJzaW9uZWRBcnRpZmFjdHM6IGJvb2xlYW47XG4gIHB1YmxpYyByZWFkb25seSBqb2JJbWFnZTogc3RyaW5nO1xuICBwdWJsaWMgcmVhZG9ubHkgY29uZmlnOiBnaXRsYWIuR2l0bGFiQ29uZmlndXJhdGlvbjtcblxuICBwcml2YXRlIGRlcGxveW1lbnRTdGFnZXM6IHN0cmluZ1tdID0gW107XG5cbiAgY29uc3RydWN0b3IoYXBwOiBhd3NjZGsuQXdzQ2RrVHlwZVNjcmlwdEFwcCwgcHJpdmF0ZSBvcHRpb25zOiBHaXRsYWJDREtQaXBlbGluZU9wdGlvbnMpIHtcbiAgICBzdXBlcihhcHAsIG9wdGlvbnMpO1xuXG4gICAgLy8gVE9ETyB1c2UgZXhpc3RpbmcgY29uZmlnIGlmIHBvc3NpYmxlXG4gICAgdGhpcy5jb25maWcgPSBuZXcgZ2l0bGFiLkdpdGxhYkNvbmZpZ3VyYXRpb24oYXBwLCB7XG4gICAgICBzdGFnZXM6IFtdLFxuICAgICAgam9iczoge30sXG4gICAgfSk7XG5cbiAgICB0aGlzLm5lZWRzVmVyc2lvbmVkQXJ0aWZhY3RzID0gZmFsc2U7IC8vIG9wdGlvbnMucHVibGlzaGVkQ2xvdWRBc3NlbWJsaWVzID8/IGZhbHNlO1xuICAgIHRoaXMuam9iSW1hZ2UgPSBvcHRpb25zLmltYWdlID8/ICdpbWFnZToganNpaS9zdXBlcmNoYWluOjEtYnVzdGVyLXNsaW0tbm9kZTE4JztcblxuICAgIHRoaXMuc2V0dXBTbmlwcGV0cygpO1xuXG4gICAgdGhpcy5jcmVhdGVTeW50aCgpO1xuXG4gICAgdGhpcy5jcmVhdGVBc3NldFVwbG9hZCgpO1xuXG4gICAgZm9yIChjb25zdCBzdGFnZSBvZiBvcHRpb25zLnN0YWdlcykge1xuICAgICAgdGhpcy5jcmVhdGVEZXBsb3ltZW50KHN0YWdlKTtcbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgc2V0dXBTbmlwcGV0cygpIHtcbiAgICB0aGlzLmNvbmZpZy5hZGRKb2JzKHtcbiAgICAgICcuYXJ0aWZhY3RzX2Nkayc6IHtcbiAgICAgICAgYXJ0aWZhY3RzOiB7XG4gICAgICAgICAgd2hlbjogZ2l0bGFiLkNhY2hlV2hlbi5PTl9TVUNDRVNTLFxuICAgICAgICAgIGV4cGlyZUluOiAnMzAgZGF5cycsXG4gICAgICAgICAgbmFtZTogJ0NESyBBc3NlbWJseSAtICRDSV9KT0JfTkFNRS0kQ0lfQ09NTUlUX1JFRl9TTFVHJyxcbiAgICAgICAgICB1bnRyYWNrZWQ6IGZhbHNlLFxuICAgICAgICAgIHBhdGhzOlxuICAgICAgICAgICAgWydjZGsub3V0J10sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgJy5hd3NfYmFzZSc6IHtcbiAgICAgICAgaW1hZ2U6IHsgbmFtZTogdGhpcy5qb2JJbWFnZSB9LFxuICAgICAgICBpZFRva2Vuczoge1xuICAgICAgICAgIEFXU19UT0tFTjoge1xuICAgICAgICAgICAgYXVkOiAnaHR0cHM6Ly9zdHMuYW1hem9uYXdzLmNvbScsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgdmFyaWFibGVzOiB7XG4gICAgICAgICAgQ0k6ICd0cnVlJyxcbiAgICAgICAgICAvLyBOUE1fUkVHSVNUUlk6ICd4eHgnXG4gICAgICAgIH0sXG4gICAgICAgIGJlZm9yZVNjcmlwdDogW1xuICAgICAgICAgIGBjaGVja192YXJpYWJsZXNfZGVmaW5lZCgpIHtcbiAgZm9yIHZhciBpbiBcIiRAXCI7IGRvXG4gICAgaWYgWyAteiBcIiQoZXZhbCBcImVjaG8gXFxcXCQkdmFyXCIpXCIgXTsgdGhlblxuICAgICAgbG9nX2ZhdGFsIFwiXFwke3Zhcn0gbm90IGRlZmluZWRcIjtcbiAgICBmaVxuICBkb25lXG59XG5cbmF3c2xvZ2luKCkge1xuICByb2xlQXJuPVxcJHsxOiAtXFwke0FXU19ST0xFX0FSTn19XG4gIGNoZWNrX3ZhcmlhYmxlc19kZWZpbmVkIHJvbGVBcm4gQVdTX1RPS0VOXG4gIGV4cG9ydCAkKHByaW50ZiBcIkFXU19BQ0NFU1NfS0VZX0lEPSVzIEFXU19TRUNSRVRfQUNDRVNTX0tFWT0lcyBBV1NfU0VTU0lPTl9UT0tFTj0lc1wiICQoYXdzIHN0cyBhc3N1bWUtcm9sZS13aXRoLXdlYi1pZGVudGl0eSAtLXJvbGUtYXJuIFxcJHtyb2xlQXJufSAtLXJvbGUtc2Vzc2lvbi1uYW1lIFwiR2l0TGFiUnVubmVyLVxcJHtDSV9QUk9KRUNUX0lEfS1cXCR7Q0lfUElQRUxJTkVfSUR9XCIgLS13ZWItaWRlbnRpdHktdG9rZW4gXFwke0FXU19UT0tFTn0gLS1kdXJhdGlvbi1zZWNvbmRzIDM2MDAgLS1xdWVyeSAnQ3JlZGVudGlhbHMuW0FjY2Vzc0tleUlkLFNlY3JldEFjY2Vzc0tleSxTZXNzaW9uVG9rZW5dJyAtLW91dHB1dCB0ZXh0KSlcbiAgIyBUT0RPIENPREUgQVJUSUZBQ1Rcbn1cbmAsXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcHJvdGVjdGVkIGNyZWF0ZVN5bnRoKCk6IHZvaWQge1xuICAgIGNvbnN0IHNjcmlwdCA9IFsnZWNobyBcIlJ1bm5pbmcgQ0RLIHN5bnRoXCInXTtcbiAgICBpZiAodGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zPy5zeW50aCkge1xuICAgICAgc2NyaXB0LnB1c2goYGF3c2xvZ2luICcke3RoaXMub3B0aW9ucy5pYW1Sb2xlQXJucy5zeW50aH0nYCk7XG4gICAgfVxuICAgIHNjcmlwdC5wdXNoKC4uLnRoaXMucmVuZGVyU3ludGhDb21tYW5kcygpKTtcblxuICAgIHRoaXMuY29uZmlnLmFkZFN0YWdlcygnc3ludGgnKTtcbiAgICB0aGlzLmNvbmZpZy5hZGRKb2JzKHtcbiAgICAgIHN5bnRoOiB7XG4gICAgICAgIGV4dGVuZHM6IFsnLmF3c19iYXNlJywgJy5hcnRpZmFjdHNfY2RrJ10sXG4gICAgICAgIHN0YWdlOiAnc3ludGgnLFxuICAgICAgICBzY3JpcHQsXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcHJvdGVjdGVkIGNyZWF0ZUFzc2V0VXBsb2FkKCk6IHZvaWQge1xuICAgIGNvbnN0IHNjcmlwdCA9IFsnZWNobyBcIlB1Ymxpc2ggYXNzZXRzIHRvIEFXU1wiJ107XG4gICAgaWYgKHRoaXMub3B0aW9ucy5pYW1Sb2xlQXJucz8uYXNzZXRQdWJsaXNoaW5nKSB7XG4gICAgICBzY3JpcHQucHVzaChgYXdzbG9naW4gJyR7dGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zLmFzc2V0UHVibGlzaGluZ30nYCk7XG4gICAgfVxuICAgIHNjcmlwdC5wdXNoKC4uLnRoaXMuZ2V0QXNzZXRVcGxvYWRDb21tYW5kcyh0aGlzLm5lZWRzVmVyc2lvbmVkQXJ0aWZhY3RzKSk7XG5cbiAgICB0aGlzLmNvbmZpZy5hZGRTdGFnZXMoJ3B1Ymxpc2hfYXNzZXRzJyk7XG4gICAgdGhpcy5jb25maWcuYWRkSm9icyh7XG4gICAgICBwdWJsaXNoX2Fzc2V0czoge1xuICAgICAgICBleHRlbmRzOiBbJy5hd3NfYmFzZSddLFxuICAgICAgICBzdGFnZTogJ3B1Ymxpc2hfYXNzZXRzJyxcbiAgICAgICAgbmVlZHM6IFt7IGpvYjogJ3N5bnRoJywgYXJ0aWZhY3RzOiB0cnVlIH1dLFxuICAgICAgICBzY3JpcHQsXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgcHJvdGVjdGVkIGNyZWF0ZURlcGxveW1lbnQoc3RhZ2U6IERlcGxveW1lbnRTdGFnZSk6IHZvaWQge1xuICAgIGNvbnN0IHNjcmlwdCA9IFtdO1xuICAgIHNjcmlwdC5wdXNoKGBhd3Nsb2dpbiAnJHt0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LmRlcGxveW1lbnQ/LltzdGFnZS5uYW1lXSA/PyB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LmRlZmF1bHR9J2ApO1xuICAgIHNjcmlwdC5wdXNoKC4uLnRoaXMucmVuZGVySW5zdGFsbENvbW1hbmRzKCkpO1xuXG4gICAgdGhpcy5jb25maWcuYWRkU3RhZ2VzKHN0YWdlLm5hbWUpO1xuICAgIHRoaXMuY29uZmlnLmFkZEpvYnMoe1xuICAgICAgW2BkaWZmLSR7c3RhZ2UubmFtZX1gXToge1xuICAgICAgICBleHRlbmRzOiBbJy5hd3NfYmFzZSddLFxuICAgICAgICBzdGFnZTogc3RhZ2UubmFtZSxcbiAgICAgICAgb25seToge1xuICAgICAgICAgIHJlZnM6IFsnbWFpbiddLFxuICAgICAgICB9LFxuICAgICAgICBuZWVkczogW1xuICAgICAgICAgIHsgam9iOiAnc3ludGgnLCBhcnRpZmFjdHM6IHRydWUgfSxcbiAgICAgICAgICB7IGpvYjogJ3B1Ymxpc2hfYXNzZXRzJyB9LFxuICAgICAgICBdLFxuICAgICAgICBzY3JpcHQ6IFtcbiAgICAgICAgICBgYXdzbG9naW4gJyR7dGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zPy5kZXBsb3ltZW50Py5bc3RhZ2UubmFtZV0gPz8gdGhpcy5vcHRpb25zLmlhbVJvbGVBcm5zPy5kZWZhdWx0fSdgLFxuICAgICAgICAgIC4uLnRoaXMucmVuZGVySW5zdGFsbENvbW1hbmRzKCksXG4gICAgICAgICAgLi4udGhpcy5yZW5kZXJEaWZmQ29tbWFuZHMoc3RhZ2UubmFtZSksXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICAgW2BkZXBsb3ktJHtzdGFnZS5uYW1lfWBdOiB7XG4gICAgICAgIGV4dGVuZHM6IFsnLmF3c19iYXNlJ10sXG4gICAgICAgIHN0YWdlOiBzdGFnZS5uYW1lLFxuICAgICAgICAuLi5zdGFnZS5tYW51YWxBcHByb3ZhbCAmJiB7XG4gICAgICAgICAgd2hlbjogZ2l0bGFiLkpvYldoZW4uTUFOVUFMLFxuICAgICAgICB9LFxuICAgICAgICBvbmx5OiB7XG4gICAgICAgICAgcmVmczogWydtYWluJ10sXG4gICAgICAgIH0sXG4gICAgICAgIG5lZWRzOiBbXG4gICAgICAgICAgeyBqb2I6ICdzeW50aCcsIGFydGlmYWN0czogdHJ1ZSB9LFxuICAgICAgICAgIHsgam9iOiAncHVibGlzaF9hc3NldHMnIH0sXG4gICAgICAgICAgeyBqb2I6IGBkaWZmLSR7c3RhZ2UubmFtZX1gIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHNjcmlwdDogW1xuICAgICAgICAgIGBhd3Nsb2dpbiAnJHt0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LmRlcGxveW1lbnQ/LltzdGFnZS5uYW1lXSA/PyB0aGlzLm9wdGlvbnMuaWFtUm9sZUFybnM/LmRlZmF1bHR9J2AsXG4gICAgICAgICAgLi4udGhpcy5yZW5kZXJJbnN0YWxsQ29tbWFuZHMoKSxcbiAgICAgICAgICAuLi50aGlzLnJlbmRlckRlcGxveUNvbW1hbmRzKHN0YWdlLm5hbWUpLFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICB0aGlzLmRlcGxveW1lbnRTdGFnZXMucHVzaChzdGFnZS5uYW1lKTtcbiAgfVxuXG59XG5cbiJdfQ==