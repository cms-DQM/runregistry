"""
Script for initializing and populating a local Postgres DB.
with data imported from CSV files created by the dump_db.py script.

Note: Before running this script, make sure you have started the runregistry_backend
once, with ENV=development, in order to initialize the local database.
"""

import csv
import os
import sqlalchemy
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy_utils import create_database, database_exists
from distutils.util import strtobool

# Default env vars, run "export <ENVVAR>=<NEWVALUE>" before the script to override.
# Those settings refer to your local DB, used for testing.
DEFAULT_ENV_VARS = {
    "DB_HOST_LOCAL": "localhost",  # The URL where the db is served
    "DB_PORT_LOCAL": 5432,  # The db port to connect to
    "DB_USERNAME_LOCAL": "postgres",  # The db username
    "DB_PASSWORD_LOCAL": "postgres",  # The password for the db user
    "DB_NAME_LOCAL": "run_registry",  # The name of the database
}


def main() -> None:
    # Find env vars for DB connection or use default ones
    env_vars = dict(os.environ)
    for k, v in DEFAULT_ENV_VARS.items():
        if k not in env_vars:
            env_vars[k] = v

    # Construct DB connection URL
    db_url = (
        f"postgresql://{env_vars.get('DB_USERNAME_LOCAL')}:{env_vars.get('DB_PASSWORD_LOCAL')}"
        f"@{env_vars.get('DB_HOST_LOCAL')}:{env_vars.get('DB_PORT_LOCAL')}"
        f"/{env_vars.get('DB_NAME_LOCAL')}"
    )
    print(f"Attempting connection to {db_url}")

    # Check if database exists, and create it if not
    if not database_exists(db_url):
        create_database(db_url)

    # Connect to it
    engine = create_engine(db_url)
    Session = sessionmaker(engine)

    with engine.connect() as conn:
        session = Session(bind=conn)
        # Run Registry DB tables
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
            columns, metadata = create_tables(engine, table)
            try:
                populate_table(engine, session, metadata, table, columns)
            except Exception as e:
                print(f"Error when populating table {table}: {repr(e)}")
                continue


def create_tables(engine: sqlalchemy.Engine, table_name: str) -> tuple:
    """
    Given a tables_config list, try to create
    """
    # Create the tables
    print(f"\n{table_name} TABLE ====================")
    columns = None
    metadata = None

    try:
        metadata = sqlalchemy.MetaData()
        insp = sqlalchemy.inspect(engine)
        if not insp.has_table(table_name):
            sqlalchemy.Table(table_name, metadata)
            metadata.create_all(engine)
        table = sqlalchemy.Table(table_name, metadata, autoload_with=engine)
        columns = table.c
        for c in columns:
            print(f"{c}| {c.type}")
    except Exception as e:
        print(f"Something bad happened when creating table {table_name}: {repr(e)}")
    return columns, metadata


def get_table_record(
    engine: sqlalchemy.Engine, table_name: str, metadata: sqlalchemy.MetaData
):
    """
    Returns a new Record, given a table name and the DB metadata.
    """
    from sqlalchemy.orm import declarative_base

    Base = declarative_base()

    class Record(Base):
        __table__ = sqlalchemy.Table(table_name, metadata, autoload_with=engine)

    return Record


def populate_table(
    engine: sqlalchemy.Engine,
    session,
    metadata: sqlalchemy.MetaData,
    table_name: str,
    columns: sqlalchemy.sql.base.ReadOnlyColumnCollection,
) -> None:
    """
    Given the name of a table and its columns, try to open an appropriately named csv file,
    and dump its data into the DB table.
    """
    filepath = os.path.join(os.path.dirname(__file__), "rr_db", f"{table_name}.csv")
    print(f"\nImporting data into table {table_name} from '{filepath}'\n")

    with open(filepath, "r") as inpfile:
        inpcsv = csv.reader(inpfile)
        Record = get_table_record(engine, table_name, metadata)

        # Populate the tables with data from the CSV
        keys = None
        for row in inpcsv:
            if not keys:
                keys = row  # First row of CSV as keys
            else:
                kkeys = ""
                for key in keys:
                    kkeys += '"' + key + '",'
                kkeys = kkeys[:-1]
                rec = Record()  # New record to insert to DB
                for r, k, c in zip(row, keys, columns):
                    val = r
                    if c.type == "INTEGER":
                        val = int(r)
                    elif str(c.type) == "BOOLEAN":
                        val = strtobool(r)
                    setattr(rec, k, val)

                try:
                    session.add(rec)
                    session.commit()
                except:
                    session.rollback()


if __name__ == "__main__":
    main()
