const { Dataset, Run, DatasetTripletCache, Sequelize } = require('../models');

const changeNameOfAllKeys = require('change-name-of-all-keys');
const { Op } = Sequelize;
const conversion_operator = {
  and: Op.and,
  or: Op.or,
  '>': Op.gt,
  '<': Op.lt,
  '>=': Op.gte,
  '<=': Op.lte,
  like: Op.iLike,
  notlike: Op.notILike,
  '=': Op.eq,
  '<>': Op.ne,
  // In uppercase as well:
  AND: Op.and,
  OR: Op.or,
  LIKE: Op.iLike,
  NOTLIKE: Op.notLike
};
const big_filter = {
  where: {
    and: [
      {
        or: [
          { name: '/PromptReco/Collisions2018A/DQM' },
          { name: '/PromptReco/Collisions2018B/DQM' },
          { name: '/PromptReco/Collisions2018C/DQM' },
          { name: '/PromptReco/Collisions2018D/DQM' },
          { name: '/PromptReco/Collisions2018E/DQM' },
          { name: '/PromptReco/Collisions2018F/DQM' }
        ]
      }
    ]
  },
  include: [
    {
      model: Run,
      where: {
        and: [
          { 'oms_attributes.energy': { '>=': 6000 } },
          { 'oms_attributes.energy': { '<=': 7000 } },
          { 'oms_attributes.b_field': { '>=': 3.7 } }
        ]
      }
    },
    {
      model: DatasetTripletCache,
      where: {
        'triplet_summary.dt-dt.GOOD': { '>': 0 },
        'triplet_summary.csc-csc.GOOD': { '>': 0 },
        'triplet_summary.l1t-l1tmu.GOOD': { '>': 0 },
        'triplet_summary.hlt-hlt.GOOD': { '>': 0 },
        'triplet_summary.tracker-pixel.GOOD': { '>': 0 },
        'triplet_summary.tracker-strip.GOOD': { '>': 0 },
        'triplet_summary.tracker-track.GOOD': { '>': 0 },
        'triplet_summary.ecal-ecal.GOOD': { '>': 0 },
        'triplet_summary.ecal-es.GOOD': { '>': 0 },
        'triplet_summary.hcal-hcal.GOOD': { '>': 0 },
        'triplet_summary.muon-muon.GOOD': { '>': 0 },
        'triplet_summary.jetmet-jetmet.GOOD': { '>': 0 },
        'triplet_summary.lumi-lumi.GOOD': { '>': 0 }
        // 'triplet_summary.dc-lowlumi.GOOD': { '=': 0 }
      }
    }
  ]
};

(async () => {
  const sequelize_filter = changeNameOfAllKeys(big_filter, conversion_operator);
  const datasets = await Dataset.findAll(sequelize_filter);
  console.log(datasets);
})();
