
import sys, os
sys.path.append(os.path.dirname(os.path.realpath("../runregistry")))

import runregistry
runregistry.setup( "development" )

#answer = runregistry.edit_rr_lumisections(363534, 101, 111, "gem", "GOOD", "API TEST")
#print( answer, answer.text )
#exit()

answer = runregistry.move_datasets( 'waiting dqm gui', 'OPEN', "/PromptReco/Commissioning2021/DQM", run=362874, workspace="global" )
print( answer, answer.text )

answer = runregistry.move_datasets( 'OPEN', 'SIGNOFF', "/PromptReco/Commissioning2021/DQM", run=362874, workspace="ctpps" )
print( answer, answer.text )

answer = runregistry.make_significant_runs( run=362761 )
print( answer, answer.text )

answer = runregistry.reset_RR_attributes_and_refresh_runs( run=362761 )
print( answer, answer.text )

answer = runregistry.move_runs( "OPEN", "SIGNOFF", run=362761 )
print( answer, answer.text )
