import sqlalchemy
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
import csv
import sys
from distutils.util import strtobool

engine = create_engine("postgresql://postgres@localhost:5432/postgres")
Session = sessionmaker(engine)

with engine.connect() as conn:
  session = Session(bind=conn)

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
    inpfile = open( "rr_db/" + table + '.csv', 'r')
    inpcsv = csv.reader(inpfile)

    print(table, "TABLE ====================")

    try:
      md = sqlalchemy.MetaData()
      table = sqlalchemy.Table(table, md, autoload=True, autoload_with=engine)
      columns = table.c
      for c in columns: 
        print( c.type )
    except: break

    def get_class( table_name ):
      from sqlalchemy.ext.declarative import declarative_base
      Base = declarative_base()
      class Records(Base):
        __table__ = sqlalchemy.Table(table_name, md, autoload=True, autoload_with=engine)
      return Records

    RecClass = get_class( table )

    keys = None
    for row in inpcsv:  
      if not keys : 
        keys = row
      else : 
        kkeys = ""
        for key in keys:
          kkeys += "\"" + key + "\","
        kkeys = kkeys[:-1]

        rec = RecClass( )
        for r, k, c in zip(row, keys, columns):
          val = r
          if c.type == "INTEGER": val = int(r)
          if str(c.type) == "BOOLEAN": val = strtobool(r)
          setattr(rec, k, val)

        try:
          session.add( rec )
          session.commit()
        except:
          session.rollback()

    inpfile.close()








