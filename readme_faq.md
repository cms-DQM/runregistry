# FAQ

## Main workflows

### Update runs

Entry point - get some runs from OMS:
https://github.com/cms-DQM/runregistry/blob/e941fe70a419629796dfeed9803b26dc8ee9dc25/runregistry_backend/cron/1.get_runs.js#L28

Somehow calculate how many we would like to update and update:
https://github.com/cms-DQM/runregistry/blob/e941fe70a419629796dfeed9803b26dc8ee9dc25/runregistry_backend/cron/1.get_runs.js#L89

Update OMS atributes and bits per lumisection:
https://github.com/cms-DQM/runregistry/blob/e941fe70a419629796dfeed9803b26dc8ee9dc25/runregistry_backend/cron/2.save_or_update_runs.js#L142-L143

Update RR attributes and bits per lumisection:
https://github.com/cms-DQM/runregistry/blob/e941fe70a419629796dfeed9803b26dc8ee9dc25/runregistry_backend/cron/2.save_or_update_runs.js#L150

Put the all OMS & RR info to the our server using link:
https://github.com/cms-DQM/runregistry/blob/e941fe70a419629796dfeed9803b26dc8ee9dc25/runregistry_backend/cron/2.save_or_update_runs.js#L164

Actually function is:
https://github.com/cms-DQM/runregistry/blob/3169ae5b2cf923218d2f845839c6d5c2aef260fe/runregistry_backend/controllers/run.js#L257

### Frontend

It is based on React.

## Some operations tasks

### Connect to DB

Via `psql`:

```bash
psql -h dbod-gc005.cern.ch -p 6601 -U username
```

using password & username obtained from DQM core.

You can also use `pgadmin4` for convenience.

### Delete a run from the DB

```sql
DO $$
DECLARE
	run_number_to_delete integer := 382656;
BEGIN
	EXECUTE 'SELECT * FROM public."Run" WHERE run_number = $1' USING run_number_to_delete;
	EXECUTE 'DELETE FROM public."DatasetEvent" WHERE run_number = $1' USING run_number_to_delete;
	EXECUTE 'DELETE FROM public."DatasetTripletCache" WHERE run_number = $1' USING run_number_to_delete;
	EXECUTE 'DELETE FROM public."LumisectionEvent" WHERE run_number = $1' USING run_number_to_delete;
	EXECUTE 'DELETE FROM public."OMSLumisectionEvent" WHERE run_number = $1' USING run_number_to_delete;
	EXECUTE 'DELETE FROM public."Dataset" WHERE run_number = $1' USING run_number_to_delete;
	EXECUTE 'DELETE FROM public."Run" WHERE run_number = $1' USING run_number_to_delete;
 	EXECUTE 'DELETE FROM public."RunEvent" WHERE run_number = $1' USING run_number_to_delete;
END $$;
```

### Add e-group into DB

```sql
INSERT INTO public."Permission" VALUES (40, 'cms-dqm-runregistry-offline-gem-certifiers', '["/datasets/gem/move_dataset/OPEN/SIGNOFF", "/datasets/gem/move_dataset/OPEN/COMPLETED", "/datasets/gem/move_dataset/SIGNOFF/COMPLETED", "/datasets/gem/move_dataset/COMPLETED/SIGNOFF", "/dataset_lumisections/gem.*", "/cycles/move_dataset/gem/.*", "/json_portal/generate"]', NOW());
INSERT INTO public."PermissionEntries" VALUES (40, 1);
```

### Add new Offline classifier

For example, to add a new one with `id = 36`:

```sql
INSERT INTO public."OfflineDatasetClassifier" VALUES (36, '{"if": [{"and": [{"in": ["Prompt", {"var": "name"}]}]}, true, false]}', 'gem', true, NOW(), 'pmandrik', 'pmandrik@cern.ch' );
```

`OfflineDatasetClassifierList` - list of versions, add new version:

```sql
INSERT INTO public."OfflineDatasetClassifierList" VALUES (20);
```

`OfflineDatasetClassifierEntries`: entries associated with version, add entries from `OfflineDatasetClassifier` into new version we created above:

```sql
INSERT INTO public."OfflineDatasetClassifierEntries" VALUES (2, 20), (3, 20), (4, 20), (6, 20), (7, 20), (8, 20), (9, 20), (10, 20), (11, 20), (12, 20), (13, 20), (14, 20), (15, 20), (16, 20), (18, 20), (34, 20), (35, 20), (36, 20);
```

### Change DB password

Follow:
https://dbod-user-guide.web.cern.ch/getting_started/PostgreSQL/postgresql/#setting-or-changing-the-password

### User authorization

https://auth.docs.cern.ch/user-documentation/faqs/

### Add logic to GEM RR attributes

```json
{"and": [{"var": "gem_included"}, {"or": [{"==": [{"var": "gemp_ready"}, false]}, {"==": [{"var": "gemm_ready"}, false]}]}]}
{"and": [{"var": "gem_included"}, {"and": [{"==": [{"var": "gemp_ready"}, true]}, {"==": [{"var": "gemm_ready"}, true]}]}]}
```

### Creating docker images and deploying on Openshift

Each `package.json` contains shorthand commands for building and pushing docker images to registry.cern.ch, as well as redeploying them on Openshift.

Check the Wiki for more information.

### Redis server

REDIS server is used by BULL JS package to store configs used to generate JSONs in a queue

```bash
sudo yum install redis
sudo nano /etc/redis.conf
supervised no -> supervised systemd
sudo systemctl restart redis.service
```

Check that it's running:

```bash
redis-cli
ping
```

Set `REDIS_HOST`, `REDIS_PORT` and `REDIS_PASSWORD` to match your redis server (Usually `127.0.0.1`, `6379` and no password).

### Upload LS from brilcalc

Split brilcalc csv to store information per run

```bash
awk -F', ' '{ date = substr($1,0,6) } !(date in outfile) { outfile[date] = date".csv" } { print > (outfile[date]) }' 2022_lumi_355100_357900.csv
```

In the `runregistry` VM, put files into `/srv/runregistry/runregistry_backend/uploader/luminosity`. Execute the updater:

```bash
cd /srv
source setup_prod.sh
cd /srv/runregistry/runregistry_backend/uploader/
node upload_lumisection_luminosity_brilcalc.js
```

### Antd style fix

Frontend uses the `antd` js library for some GUI stuff, e.g. dropboxes & breadcrumbs. The style of the original library is overwritten in `public/static/ant-modified.min.css`.

For example in the commit https://github.com/cms-DQM/runregistry/commit/431550037f28e7953b68db7955faa4caedf20c76
we remove the new lines and enumeration from ordered list as it is expected to be done in antd style we overwrite..

### How are specific actions mapped to specific e-groups?

In the `Permissions` table, each e-group is given access to specific `routes`.
