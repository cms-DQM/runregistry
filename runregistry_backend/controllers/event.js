const sequelize = require('../models').sequelize;
const { Version } = require('../models');

exports.getEvents = async (req, res) => {
    const { page, page_size } = req.body;
    const count = await Event.count();
    let pages = Math.ceil(count / page_size);
    let offset = page_size * page;

    const events = await sequelize.query(
        `
            SELECT "Event".*,
            	COALESCE("RunEvent"."run_number" , "DatasetEvent"."run_number" , rr_lumisections.run_number , oms_lumisections.run_number) as "run_number",
                COALESCE( "DatasetEvent"."name" , rr_lumisections."name" , oms_lumisections."name", 'online') as "name",
                
                -- The following run_numbers are to identify where did the event came from:
                "RunEvent"."run_number"  as "run_event", 
                "DatasetEvent"."run_number" as "dataset_event", 
                rr_lumisections.run_number as "rr_lumisection_event", 
                oms_lumisections.run_number as "oms_lumisection_event",

                
                "RunEvent"."oms_metadata" AS "oms_metadata",
                "RunEvent"."rr_metadata" AS "rr_metadata",
                "RunEvent"."deleted" AS "run_deleted",
                "RunEvent"."manual_change" AS "run_manual_change",
                "DatasetEvent"."dataset_metadata" AS "dataset_metadata",
                "DatasetEvent"."deleted" AS "dataset_deleted",
                rr_lumisections.start as "rr_lumisections_start",
                rr_lumisections.end as "rr_lumisections_end",
                oms_lumisections.start as "oms_lumisections_start",
                oms_lumisections.end as "oms_lumisections_end"
            FROM
            (SELECT "Event"."version",
                    "Event"."by",
                    "Event"."comment",
                    "Event"."createdAt"
            FROM "Event" AS "Event"
            ORDER BY "Event"."version" DESC
            LIMIT :limit
            OFFSET :offset
            ) AS "Event"
            LEFT OUTER JOIN "RunEvent" ON "Event"."version" = "RunEvent"."version"
            LEFT OUTER JOIN "DatasetEvent" ON "Event"."version" = "DatasetEvent"."version"
            LEFT OUTER JOIN
            (
                SELECT "LumisectionEvent".version,
                        "LumisectionEvent".run_number,
                        "LumisectionEvent".name,
                        min("LumisectionEventAssignation".lumisection_number) AS START, 
                        max("LumisectionEventAssignation".lumisection_number) AS END
                FROM "LumisectionEvent"
                INNER JOIN "LumisectionEventAssignation" 
                ON "LumisectionEvent".version = "LumisectionEventAssignation".version 
                GROUP BY run_number, name, "LumisectionEvent".version
            ) rr_lumisections ON "Event".version = rr_lumisections.version

            LEFT OUTER JOIN 

            (
                SELECT "OMSLumisectionEvent".version, 
                        "OMSLumisectionEvent".run_number,
                        "OMSLumisectionEvent".name,
                        min("OMSLumisectionEventAssignation".lumisection_number) as start,
                        max("OMSLumisectionEventAssignation".lumisection_number) as end
                FROM "OMSLumisectionEvent"
                INNER JOIN "OMSLumisectionEventAssignation" ON "OMSLumisectionEvent".version = "OMSLumisectionEventAssignation".version
                GROUP BY run_number, name, "OMSLumisectionEvent".version
            ) oms_lumisections ON "Event".version = oms_lumisections.version
            ORDER BY "Event"."version" DESC
      `,
        {
            type: sequelize.QueryTypes.SELECT,
            replacements: {
                limit: page_size,
                offset
            }
        }
    );
    res.json({ events, pages, count });
};

// Expanded history:
// SELECT "Version".*,
//     COALESCE("RunEvent"."run_number", "DatasetEvent"."run_number", rr_lumisections.run_number, oms_lumisections.run_number) as "run_number",
//     COALESCE("DatasetEvent"."name", rr_lumisections."name", oms_lumisections."name", 'online') as "name",

//     --The following run_numbers are to identify where did the event came from:
// "RunEvent"."run_number" as "run_event",
//     "DatasetEvent"."run_number" as "dataset_event",
//         rr_lumisections.run_number as "rr_lumisection_event",
//         oms_lumisections.run_number as "oms_lumisection_event",

//         "RunEvent"."oms_metadata" AS "oms_metadata",
//             "RunEvent"."rr_metadata" AS "rr_metadata",
//                 "RunEvent"."deleted" AS "run_deleted",
//                     "RunEvent"."manual_change" AS "run_manual_change",
//                         "DatasetEvent"."dataset_metadata" AS "dataset_metadata",
//                             "DatasetEvent"."deleted" AS "dataset_deleted",
//                                 rr_lumisections.start as "rr_lumisections_start",
//                                 rr_lumisections.end as "rr_lumisections_end",
//                                 oms_lumisections.start as "oms_lumisections_start",
//                                 oms_lumisections.end as "oms_lumisections_end"
// FROM
//     (SELECT "Version"."atomic_version",
//         "Version"."by",
//         "Version"."comment",
//         "Version"."createdAt"
//             FROM "Version" AS "Version"
//             ORDER BY "Version"."atomic_version" DESC
//             LIMIT 100
//             OFFSET 0
//     ) AS "Version"
// RIGHT OUTER JOIN "Event" ON "Version".atomic_version = "Version".atomic_version
// LEFT OUTER JOIN "RunEvent" ON "Event"."version" = "RunEvent"."version"
// LEFT OUTER JOIN "DatasetEvent" ON "Event"."version" = "DatasetEvent"."version"
// LEFT OUTER JOIN
//     (
//         SELECT "LumisectionEvent".version,
//         "LumisectionEvent".run_number,
//         "LumisectionEvent".name,
//         min("LumisectionEventAssignation".lumisection_number) AS START,
//         max("LumisectionEventAssignation".lumisection_number) AS END
//                 FROM "LumisectionEvent"
//                 INNER JOIN "LumisectionEventAssignation"
//                 ON "LumisectionEvent".version = "LumisectionEventAssignation".version
//                 GROUP BY run_number, name, "LumisectionEvent".version
//     ) rr_lumisections ON "Event".version = rr_lumisections.version

// LEFT OUTER JOIN

//     (
//         SELECT "OMSLumisectionEvent".version,
//         "OMSLumisectionEvent".run_number,
//         "OMSLumisectionEvent".name,
//         min("OMSLumisectionEventAssignation".lumisection_number) as start,
//         max("OMSLumisectionEventAssignation".lumisection_number) as end
//                 FROM "OMSLumisectionEvent"
//                 INNER JOIN "OMSLumisectionEventAssignation" ON "OMSLumisectionEvent".version = "OMSLumisectionEventAssignation".version
//                 GROUP BY run_number, name, "OMSLumisectionEvent".version
//     ) oms_lumisections ON "Event".version = oms_lumisections.version
// ORDER BY "Event"."version" DESC
