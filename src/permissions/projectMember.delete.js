import _ from 'lodash';
import util from '../util';
import models from '../models';
import {
  PROJECT_MEMBER_ROLE,
} from '../constants';


/**
 * Super admin, Topcoder Managers are allowed to edit any project
 * Rest can add members only if they are currently part of the project team.
 * @param {Object}    freq        the express request instance
 * @return {Promise}              Returns a promise
 */

module.exports = freq => new Promise((resolve, reject) => {
  const projectId = _.parseInt(freq.params.projectId);
  return models.ProjectMember.getActiveProjectMembers(projectId)
    .then((members) => {
      const req = freq;
      req.context = req.context || {};
      req.context.currentProjectMembers = members;
      const authMember = _.find(members, m => m.userId === req.authUser.userId);
      const prjMemberId = _.parseInt(req.params.id);
      const memberToBeRemoved = _.find(members, m => m.id === prjMemberId);
      // check if auth user has acecss to this project
      const hasAccess = util.hasAdminRole(req)
        || (authMember && memberToBeRemoved && ([
          PROJECT_MEMBER_ROLE.ACCOUNT_MANAGER,
          PROJECT_MEMBER_ROLE.MANAGER,
          PROJECT_MEMBER_ROLE.PROGRAM_MANAGER,
          PROJECT_MEMBER_ROLE.PROJECT_MANAGER,
          PROJECT_MEMBER_ROLE.SOLUTION_ARCHITECT,
        ].includes(authMember.role) ||
          (authMember.role === PROJECT_MEMBER_ROLE.CUSTOMER && authMember.isPrimary &&
            memberToBeRemoved.role === PROJECT_MEMBER_ROLE.CUSTOMER) ||
          memberToBeRemoved.userId === req.authUser.userId));

      if (!hasAccess) {
        // user is not an admin nor is a registered project member
        return reject(new Error('You do not have permissions to perform this action'));
      }
      return resolve(true);
    });
});
