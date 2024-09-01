"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineEngine = void 0;
/**
 * The CI/CD tooling used to run your pipeline.
 * The component will render workflows for the given system
 */
var PipelineEngine;
(function (PipelineEngine) {
    /** Create GitHub actions */
    PipelineEngine[PipelineEngine["GITHUB"] = 0] = "GITHUB";
    /** Create a .gitlab-ci.yaml file */
    PipelineEngine[PipelineEngine["GITLAB"] = 1] = "GITLAB";
    // /** Create AWS CodeCatalyst workflows */
    PipelineEngine[PipelineEngine["CODE_CATALYST"] = 2] = "CODE_CATALYST";
    /** Create bash scripts */
    PipelineEngine[PipelineEngine["BASH"] = 3] = "BASH";
})(PipelineEngine || (exports.PipelineEngine = PipelineEngine = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW5naW5lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2VuZ2luZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQTs7O0dBR0c7QUFDSCxJQUFZLGNBU1g7QUFURCxXQUFZLGNBQWM7SUFDeEIsNEJBQTRCO0lBQzVCLHVEQUFNLENBQUE7SUFDTixvQ0FBb0M7SUFDcEMsdURBQU0sQ0FBQTtJQUNOLDJDQUEyQztJQUMxQyxxRUFBYSxDQUFBO0lBQ2QsMEJBQTBCO0lBQzFCLG1EQUFJLENBQUE7QUFDTixDQUFDLEVBVFcsY0FBYyw4QkFBZCxjQUFjLFFBU3pCIiwic291cmNlc0NvbnRlbnQiOlsiXG4vKipcbiAqIFRoZSBDSS9DRCB0b29saW5nIHVzZWQgdG8gcnVuIHlvdXIgcGlwZWxpbmUuXG4gKiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIHdvcmtmbG93cyBmb3IgdGhlIGdpdmVuIHN5c3RlbVxuICovXG5leHBvcnQgZW51bSBQaXBlbGluZUVuZ2luZSB7XG4gIC8qKiBDcmVhdGUgR2l0SHViIGFjdGlvbnMgKi9cbiAgR0lUSFVCLFxuICAvKiogQ3JlYXRlIGEgLmdpdGxhYi1jaS55YW1sIGZpbGUgKi9cbiAgR0lUTEFCLFxuICAvLyAvKiogQ3JlYXRlIEFXUyBDb2RlQ2F0YWx5c3Qgd29ya2Zsb3dzICovXG4gICBDT0RFX0NBVEFMWVNULFxuICAvKiogQ3JlYXRlIGJhc2ggc2NyaXB0cyAqL1xuICBCQVNILFxufSJdfQ==