const Permission = require('../controllers/permission');
const requireAuth = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      // next();
      // return;
      // https://authorization-service-api.web.cern.ch/api/v1.0/Identity/current/groups?field=groupIdentifier
    }
    let authenticated = false;
    const email = req.get('email') || '';
    if (email.startsWith('auto@auto')) {
      // This would be the cron job re-classifying runs when they change from the API, no need to check for authentication:
      next();
      return;
    }
    const egroups = req.get('egroups');

    if (!egroups || !email) {
      next('Request must provide email and egroups');
      return;
    }

    const user_egroups_array = egroups.split(';');
    const permissions = await Permission.getAllPermissions();
    let egroups_needed = [];

    user_egroups_array.forEach((user_egroup) => {
      permissions.forEach(({ routes, egroup }) => {
        // Check if some regexp matches:
        if (routes.some((regexp) => RegExp(regexp).test(req.originalUrl))) {
          if (egroup === user_egroup && !authenticated) {
            authenticated = true;
            next();
          } else {
            if (!egroups_needed.includes(egroup)) {
              egroups_needed.push(egroup);
            }
          }
        }
      });
    });

    if (!authenticated) {
      // If it gets here, it means the user is not part of the egroup authorized to perform the action he desires
      // Therefore we will tell him which e-group he needs to be in so that he can fulfill his action

      // OR, it might happen that he is trying to perform an action which requires authorization but there is no egroup setup to handle this 'route' so we will instruct for user to file a JIRA ticket
      egroups_needed = egroups_needed.map((egroup) => {
        return `<a target="_blank" href=${`https://e-groups.cern.ch/e-groups/Egroup.do?egroupName=${egroup}&tab=3`}>${egroup}</a>`;
      });
      const error_message =
        egroups_needed.length > 0
          ? `User needs to be part of any of the following e-groups to fulfill this action (clickable links): <br/><br/><strong><i>${egroups_needed.join(
              '</i></strong><br/></br><strong><i>'
            )}</i></strong> <br/><br/> IMPORTANT: After being accepted to an e-group it is necessary to <a href="https://login.cern.ch/adfs/ls/?wa=wsignout1.0">log-out</a> and log-in again. `
          : `There is no egroup that is authorized to do this action. <br/><br/>Please file a JIRA ticket with the action you were trying to do.<br/><br/> Link here: <a target="_blank" href="https://its.cern.ch/jira/projects/NEWRUNREGISTRY/issues/NEWRUNREGISTRY-2?filter=allopenissues">RUN REGISTRY JIRA</a>`;
      res.status(401);
      res.json({ message: error_message });
    }
  } catch (err) {
    res.status(500);
    res.json({ err: err.message });
  }
};

module.exports = requireAuth;
