from sqlalchemy import create_engine
import csv
import sys

engine = create_engine("postgresql://CHANGME:CHANGEME@dbod-dqm-rr.cern.ch:6601/runregistry_database")

with engine.connect() as conn:

  tables = [ ["ClassClassifier", -1], ["ClassClassifierEntries", -1], ["ClassClassifierList", -1], ["ComponentClassifier", -1], ["ComponentClassifierEntries", -1], ["ComponentClassifierList", -1] ]
  tables += [ ["DatasetClassifier", -1], ["DatasetClassifierEntries", -1], ["DatasetClassifierList", -1], ["JsonClassifier", -1], ["JsonClassifierEntries", -1], ["JsonClassifierList", -1] ]
  tables += [ ["OfflineDatasetClassifier", -1], ["OfflineDatasetClassifierEntries", -1], ["OfflineDatasetClassifierList", -1], ["Permission", -1], ["PermissionEntries", -1], ["PermissionList", -1] ]
  tables += [ ["Version", 100, "ORDER BY \"createdAt\" DESC"], ["Workspace", -1], ["WorkspaceColumn", -1], ["Settings", -1], ["SequelizeMeta", -1], ["Cycle", -1] ]
  tables += [ ["Cycle", -1], ["CycleDataset", -1], ["Dataset", 100, "ORDER BY \"run_number\" DESC"], ["DatasetEvent", 100, "ORDER BY \"run_number\" DESC"] ]
  # ["", -1]

  # SELECT * FROM public."Version" ORDER BY "createdAt" DESC LIMIT 10;

  for dat in tables:
    table = dat[0]
    lim  = dat[1]
    postfix = dat[2] if len(dat) > 2 else ""
    outfile = open( table + '.csv', 'w')
    outcsv = csv.writer(outfile)
   
    if lim < 0 : lim = 99999999

    keys = conn.execute('SELECT * FROM public."' + str(table) + '"').keys()
    print( keys )

    results = conn.execute('SELECT * FROM public."' + str(table) + '" ' + postfix + ' LIMIT ' + str(lim) )
    print( results )
    #names = [row[0] for row in result]

    outcsv.writerow( x for x in keys )
    outcsv.writerows( results )

  outfile.close()

