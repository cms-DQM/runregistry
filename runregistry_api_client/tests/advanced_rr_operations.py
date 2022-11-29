
import sys, os
sys.path.append(os.path.dirname(os.path.realpath("../runregistry")))

import runregistry
runregistry.setup( "local" )

answer = runregistry.make_significant_runs( run=362761 )
print( answer, answer.text )

answer = runregistry.reset_RR_attributes_and_refresh_runs( run=362761 )
print( answer, answer.text )

answer = runregistry.move_runs( "OPEN", "SIGNOFF", run=362761 )
print( answer, answer.text )
