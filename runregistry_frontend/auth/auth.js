export default function auth(getState, comment) {
  const state = getState();
  let email = state.info.email;
  let egroups = state.info.egroups;

  // Override user's egroups for development purposes
  if (process.env.NODE_ENV === 'development' ||
    process.env.ENV === 'development') {
    email = process.env.DEV_EMAIL || 'giannopoulos-aggelopoulos@cern.ch';
    egroups = process.env.DEV_EGROUPS || 'cms-dqm-runregistry-experts';
  }
  const options = {
    headers: { egroups, email },
  };
  if (comment) {
    options.headers.comment = comment;
  }
  return options;
}
