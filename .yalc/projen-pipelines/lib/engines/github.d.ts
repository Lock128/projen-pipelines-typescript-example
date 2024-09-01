import { JobPermission, JobPermissions } from 'projen/lib/github/workflows-model';
/**
 * Merge multiple GitHub JobPermissions. The broader permission per use case will win
 *
 * @param permissions the permissions to merge
 * @return the merged permission
 */
export declare function mergeJobPermissions(...perms: JobPermissions[]): JobPermissions;
/**
 * Merge two GitHub JobPermission values. The broader permission will win
 *
 * @param perms the permissions to merge
 * @return the broadest permission
 */
export declare function getBroadestPermission(...perms: JobPermission[]): JobPermission;
