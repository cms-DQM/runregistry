# Helper scripts

Helper scripts to be used during development. A python virtual environment is recommended to be created before running them:
```bash
python -m venv venv
source venv/bin/activate
python -m pip install -r requirements.txt
``` 

## `dump_db.py`

Script intended to dump data from a development or production Run Registry database. 
It dumps each table into separate .csv files under the `rr_db` directory.

It uses the following environmental variables:

- `DB_HOST_REMOTE`: The host where the database is served. 
- `DB_PORT_REMOTE`: The database's port to connect to.
- `DB_USERNAME_REMOTE`: The database's user.
- `DB_PASSWORD_REMOTE`: The user's password for the database.
- `DB_NAME_REMOTE` : The name of the database (e.g. `runregistry_database_dev`).

### Usage

```bash
export DB_HOST_REMOTE=...
export DB_PORT_REMOTE=...
...
python dump_db.py
```

## `import_db.py`

Script intended to load data from the .csv files created by `dump_db.py` into a local DB.

It creates the database, tables and columns as necessary.

It uses the following environmental variables:

- `DB_HOST_LOCAL`: The host where the database is served. 
- `DB_PORT_LOCAL`: The database's port to connect to.
- `DB_USERNAME_LOCAL`: The database's user.
- `DB_PASSWORD_LOCAL`: The user's password for the database.
- `DB_NAME_LOCAL` : The name of the database (e.g. `run_registry`).

### Usage

```bash
export DB_HOST_LOCAL=...
export DB_PORT_LOCAL=...
...
python import_db.py
```