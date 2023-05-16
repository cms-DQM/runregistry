"""
Script for dumping data from a remote DB to .csv files.

To change connection settings to the DB, use the names used
as keys in DEFAULT_ENV_VARS.
"""

import os
import csv
from sqlalchemy import create_engine
from sqlalchemy import text

# Default env vars, run "export <ENVVAR>=<NEWVALUE>" before the script to override.
# Those settings refer to a remote Run Registry DB, to get the data from.
DEFAULT_ENV_VARS = {
    "DB_HOST_REMOTE": "dbod-dqm-rr.cern.ch",  # The URL where the db is served
    "DB_PORT_REMOTE": 6601,  # The db port to connect to
    "DB_USERNAME_REMOTE": "CHANGEME",  # The db username
    "DB_PASSWORD_REMOTE": "CHANGEME",  # The password for the db user
    "DB_NAME_REMOTE": "runregistry_database_dev",  # The name of the database
}


def main():
    # Find env vars for DB connection or use default ones
    env_vars = dict(os.environ)
    for k, v in DEFAULT_ENV_VARS.items():
        if k not in env_vars:
            env_vars[k] = v
    db_url = (
        f"postgresql://{env_vars.get('DB_USERNAME_REMOTE')}:{env_vars.get('DB_PASSWORD_REMOTE')}"
        f"@{env_vars.get('DB_HOST_REMOTE')}:{env_vars.get('DB_PORT_REMOTE')}"
        f"/{env_vars.get('DB_NAME_REMOTE')}"
    )
    print(f"Attempting connection to {db_url}")
    engine = create_engine(db_url)

    with engine.connect() as conn:
        tables = [
            ["ClassClassifier", -1],
            ["ClassClassifierEntries", -1],
            ["ClassClassifierList", -1],
            ["ComponentClassifier", -1],
            ["ComponentClassifierEntries", -1],
            ["ComponentClassifierList", -1],
            ["DatasetClassifier", -1],
            ["DatasetClassifierEntries", -1],
            ["DatasetClassifierList", -1],
            ["JsonClassifier", -1],
            ["JsonClassifierEntries", -1],
            ["JsonClassifierList", -1],
            ["OfflineDatasetClassifier", -1],
            ["OfflineDatasetClassifierEntries", -1],
            ["OfflineDatasetClassifierList", -1],
            ["Permission", -1],
            ["PermissionEntries", -1],
            ["PermissionList", -1],
            ["Version", 100, 'ORDER BY "createdAt" DESC'],
            ["Workspace", -1],
            ["WorkspaceColumn", -1],
            ["Settings", -1],
            ["SequelizeMeta", -1],
            ["Cycle", -1],
            ["Cycle", -1],
            ["CycleDataset", -1],
            ["Dataset", 100, 'ORDER BY "run_number" DESC'],
            ["DatasetEvent", 100, 'ORDER BY "run_number" DESC'],
        ]
        # ["", -1]

        # SELECT * FROM public."Version" ORDER BY "createdAt" DESC LIMIT 10;

        for dat in tables:
            table = dat[0]
            lim = dat[1]
            postfix = dat[2] if len(dat) > 2 else ""

            # Create one .csv file for each table
            with open(
                os.path.join(os.path.dirname(__file__), "rr_db", f"{table}.csv"), "w"
            ) as outfile:
                outcsv = csv.writer(outfile)

                if lim < 0:
                    lim = 99999999

                keys = conn.execute(text(f'SELECT * FROM public."{str(table)}"')).keys()
                print(keys)

                results = conn.execute(
                    text(
                        f'SELECT * FROM public."{str(table)}" {postfix} LIMIT {str(lim)}'
                    )
                )
                print(results)
                # names = [row[0] for row in result]

                outcsv.writerow(x for x in keys)
                outcsv.writerows(results)


if __name__ == "__main__":
    main()
