const { Version } = require('../models');

// Return promise
exports.create_new_version = ({
  req,
  transaction,
  comment,
  overwriteable_comment,
}) => {
  const options = {};
  if (transaction) {
    options.transaction = transaction;
  }
  const by = req.email || req.get('email');
  // overwriteable_comment has priority over the rest:
  comment =
    overwriteable_comment || req.comment || comment || req.get('comment');
  if (!by) {
    throw "The email of the author's action should be stated in request's header 'email'";
  }
  return Version.create(
    {
      by,
      comment,
    },
    options
  );
};

exports.getVersions = async (req, res) => {
  const { page, page_size } = req.body;
  const count = await Version.count();
  let pages = Math.ceil(count / page_size);
  let offset = page_size * page;
  const versions = await Version.findAll({
    limit: page_size,
    offset,
    order: [['atomic_version', 'DESC']],
  });

  res.json({ versions, pages, count });
};

exports.getVersion = async (req, res) => {
  const { atomic_version } = req.body;
  const events = await sequelize.query(
    `
        
    `,
    {
      type: sequelize.QueryTypes.SELECT,
      replacements: {
        atomic_version,
      },
    }
  );
};
