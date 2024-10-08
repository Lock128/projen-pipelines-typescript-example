"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBroadestPermission = exports.mergeJobPermissions = void 0;
const workflows_model_1 = require("projen/lib/github/workflows-model");
/**
 * Merge multiple GitHub JobPermissions. The broader permission per use case will win
 *
 * @param permissions the permissions to merge
 * @return the merged permission
 */
function mergeJobPermissions(...perms) {
    const permissions = { ...perms[0] };
    for (const permission of perms.slice(1)) {
        for (const [key, value] of Object.entries(permission)) {
            permissions[key] = getBroadestPermission(value, permissions[key] ?? workflows_model_1.JobPermission.NONE);
        }
    }
    return permissions;
}
exports.mergeJobPermissions = mergeJobPermissions;
/**
 * Merge two GitHub JobPermission values. The broader permission will win
 *
 * @param perms the permissions to merge
 * @return the broadest permission
 */
function getBroadestPermission(...perms) {
    if (!perms || perms.length === 0) {
        throw new Error('No permissions provided');
    }
    for (const perm of perms) {
        if (!Object.values(workflows_model_1.JobPermission).includes(perm)) {
            throw new Error(`Invalid permission value: ${perm}`);
        }
    }
    if (perms.includes(workflows_model_1.JobPermission.WRITE)) {
        return workflows_model_1.JobPermission.WRITE;
    }
    if (perms.includes(workflows_model_1.JobPermission.READ)) {
        return workflows_model_1.JobPermission.READ;
    }
    return workflows_model_1.JobPermission.NONE;
}
exports.getBroadestPermission = getBroadestPermission;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0aHViLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2VuZ2luZXMvZ2l0aHViLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHVFQUFrRjtBQUVsRjs7Ozs7R0FLRztBQUNILFNBQWdCLG1CQUFtQixDQUFDLEdBQUcsS0FBdUI7SUFDNUQsTUFBTSxXQUFXLEdBQXFDLEVBQUUsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUV0RSxLQUFLLE1BQU0sVUFBVSxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUN4QyxLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO1lBQ3RELFdBQVcsQ0FBQyxHQUFHLENBQUMsR0FBRyxxQkFBcUIsQ0FBQyxLQUFLLEVBQUUsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLCtCQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDMUYsQ0FBQztJQUNILENBQUM7SUFFRCxPQUFPLFdBQVcsQ0FBQztBQUNyQixDQUFDO0FBVkQsa0RBVUM7QUFFRDs7Ozs7R0FLRztBQUNILFNBQWdCLHFCQUFxQixDQUFDLEdBQUcsS0FBc0I7SUFDN0QsSUFBSSxDQUFDLEtBQUssSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQ2pDLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM3QyxDQUFDO0lBQ0QsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUUsQ0FBQztRQUN6QixJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQywrQkFBYSxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDakQsTUFBTSxJQUFJLEtBQUssQ0FBQyw2QkFBNkIsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUN2RCxDQUFDO0lBQ0gsQ0FBQztJQUVELElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQywrQkFBYSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDeEMsT0FBTywrQkFBYSxDQUFDLEtBQUssQ0FBQztJQUM3QixDQUFDO0lBQ0QsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLCtCQUFhLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUN2QyxPQUFPLCtCQUFhLENBQUMsSUFBSSxDQUFDO0lBQzVCLENBQUM7SUFDRCxPQUFPLCtCQUFhLENBQUMsSUFBSSxDQUFDO0FBQzVCLENBQUM7QUFqQkQsc0RBaUJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSm9iUGVybWlzc2lvbiwgSm9iUGVybWlzc2lvbnMgfSBmcm9tICdwcm9qZW4vbGliL2dpdGh1Yi93b3JrZmxvd3MtbW9kZWwnO1xuXG4vKipcbiAqIE1lcmdlIG11bHRpcGxlIEdpdEh1YiBKb2JQZXJtaXNzaW9ucy4gVGhlIGJyb2FkZXIgcGVybWlzc2lvbiBwZXIgdXNlIGNhc2Ugd2lsbCB3aW5cbiAqXG4gKiBAcGFyYW0gcGVybWlzc2lvbnMgdGhlIHBlcm1pc3Npb25zIHRvIG1lcmdlXG4gKiBAcmV0dXJuIHRoZSBtZXJnZWQgcGVybWlzc2lvblxuICovXG5leHBvcnQgZnVuY3Rpb24gbWVyZ2VKb2JQZXJtaXNzaW9ucyguLi5wZXJtczogSm9iUGVybWlzc2lvbnNbXSk6IEpvYlBlcm1pc3Npb25zIHtcbiAgY29uc3QgcGVybWlzc2lvbnM6IHsgW2tleTogc3RyaW5nXTogSm9iUGVybWlzc2lvbiB9ID0geyAuLi5wZXJtc1swXSB9O1xuXG4gIGZvciAoY29uc3QgcGVybWlzc2lvbiBvZiBwZXJtcy5zbGljZSgxKSkge1xuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHBlcm1pc3Npb24pKSB7XG4gICAgICBwZXJtaXNzaW9uc1trZXldID0gZ2V0QnJvYWRlc3RQZXJtaXNzaW9uKHZhbHVlLCBwZXJtaXNzaW9uc1trZXldID8/IEpvYlBlcm1pc3Npb24uTk9ORSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHBlcm1pc3Npb25zO1xufVxuXG4vKipcbiAqIE1lcmdlIHR3byBHaXRIdWIgSm9iUGVybWlzc2lvbiB2YWx1ZXMuIFRoZSBicm9hZGVyIHBlcm1pc3Npb24gd2lsbCB3aW5cbiAqXG4gKiBAcGFyYW0gcGVybXMgdGhlIHBlcm1pc3Npb25zIHRvIG1lcmdlXG4gKiBAcmV0dXJuIHRoZSBicm9hZGVzdCBwZXJtaXNzaW9uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRCcm9hZGVzdFBlcm1pc3Npb24oLi4ucGVybXM6IEpvYlBlcm1pc3Npb25bXSk6IEpvYlBlcm1pc3Npb24ge1xuICBpZiAoIXBlcm1zIHx8IHBlcm1zLmxlbmd0aCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignTm8gcGVybWlzc2lvbnMgcHJvdmlkZWQnKTtcbiAgfVxuICBmb3IgKGNvbnN0IHBlcm0gb2YgcGVybXMpIHtcbiAgICBpZiAoIU9iamVjdC52YWx1ZXMoSm9iUGVybWlzc2lvbikuaW5jbHVkZXMocGVybSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBwZXJtaXNzaW9uIHZhbHVlOiAke3Blcm19YCk7XG4gICAgfVxuICB9XG5cbiAgaWYgKHBlcm1zLmluY2x1ZGVzKEpvYlBlcm1pc3Npb24uV1JJVEUpKSB7XG4gICAgcmV0dXJuIEpvYlBlcm1pc3Npb24uV1JJVEU7XG4gIH1cbiAgaWYgKHBlcm1zLmluY2x1ZGVzKEpvYlBlcm1pc3Npb24uUkVBRCkpIHtcbiAgICByZXR1cm4gSm9iUGVybWlzc2lvbi5SRUFEO1xuICB9XG4gIHJldHVybiBKb2JQZXJtaXNzaW9uLk5PTkU7XG59XG4iXX0=